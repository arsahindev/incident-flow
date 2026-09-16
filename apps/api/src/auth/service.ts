import { createHash, randomBytes } from "node:crypto";

import type {
  MembershipStatus as PrismaMembershipStatus,
  OrganizationRole as PrismaOrganizationRole,
  Prisma,
  PrismaClient,
} from "../generated/prisma/client.js";
import {
  ResourceConflictError,
  ResourceNotFoundError,
} from "../incidents/repository.js";
import { AuthenticationError, LoginRateLimitError } from "./errors.js";
import { hashPassword, verifyPasswordHash } from "./passwords.js";
import { permissionsForRole } from "./permissions.js";
import type {
  AuthContext,
  CreatedInvitation,
  InvitationRecord,
  MemberRecord,
  MembershipStatus,
  OrganizationAccess,
  OrganizationRole,
  SessionResult,
} from "./types.js";

const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1_000;
const invitationLifetimeMs = 48 * 60 * 60 * 1_000;
const throttleWindowMs = 15 * 60 * 1_000;
const throttleLockMs = 15 * 60 * 1_000;
const maxLoginAttempts = 5;
const dummyPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$tYnlbxVo24Ohopnd8MKzSw$ly22QRd3EUk/V0jPrhEZ5103eveL7jRPY2xTg6d5MDo";

const roleToPrisma: Record<OrganizationRole, PrismaOrganizationRole> = {
  owner: "OWNER",
  admin: "ADMIN",
  responder: "RESPONDER",
  viewer: "VIEWER",
};

const statusToPrisma: Record<MembershipStatus, PrismaMembershipStatus> = {
  active: "ACTIVE",
  suspended: "SUSPENDED",
};

function lower<T extends string>(value: string) {
  return value.toLowerCase() as T;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

type SessionContextData = {
  user: { id: string; email: string; displayName: string };
  organization: { id: string; slug: string; name: string };
  membership: { role: PrismaOrganizationRole };
};

function toContext(session: { id: string } & SessionContextData): AuthContext {
  const role = lower<OrganizationRole>(session.membership.role);
  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    organizationId: session.organization.id,
    organizationSlug: session.organization.slug,
    organizationName: session.organization.name,
    role,
    permissions: permissionsForRole(role),
  };
}

const sessionInclude = {
  user: { select: { id: true, email: true, displayName: true, status: true } },
  organization: { select: { id: true, slug: true, name: true } },
  membership: { select: { role: true, status: true } },
} satisfies Prisma.SessionInclude;

export interface AuthService {
  authenticateToken(token: string): Promise<AuthContext>;
  login(input: {
    email: string;
    password: string;
    organizationSlug?: string;
    clientAddress: string;
  }): Promise<SessionResult>;
  logout(token: string): Promise<void>;
  switchOrganization(
    token: string,
    organizationSlug: string,
  ): Promise<SessionResult>;
  listOrganizations(context: AuthContext): Promise<OrganizationAccess[]>;
  listMembers(context: AuthContext): Promise<MemberRecord[]>;
  createInvitation(
    context: AuthContext,
    input: { email: string; role: OrganizationRole },
  ): Promise<CreatedInvitation>;
  getInvitation(token: string): Promise<InvitationRecord>;
  acceptInvitation(
    token: string,
    input: { displayName: string; password: string },
  ): Promise<SessionResult>;
  updateMember(
    context: AuthContext,
    userId: string,
    input: { role?: OrganizationRole; status?: MembershipStatus },
  ): Promise<MemberRecord>;
  addTeamMember(
    context: AuthContext,
    teamId: string,
    userId: string,
  ): Promise<void>;
  removeTeamMember(
    context: AuthContext,
    teamId: string,
    userId: string,
  ): Promise<void>;
}

export class PrismaAuthService implements AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly passwordPepper: Uint8Array,
  ) {}

  async authenticateToken(token: string) {
    if (!token) throw new AuthenticationError();
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: digest(token) },
      include: sessionInclude,
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== "ACTIVE" ||
      session.membership.status !== "ACTIVE"
    ) {
      throw new AuthenticationError("Session is invalid or expired");
    }

    if (session.lastUsedAt.getTime() < now.getTime() - 5 * 60 * 1_000) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      });
    }
    return toContext(session);
  }

  async login(input: {
    email: string;
    password: string;
    organizationSlug?: string;
    clientAddress: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const throttleKey = digest(`${email}:${input.clientAddress}`);
    await this.assertLoginAllowed(throttleKey);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        organizationMemberships: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          include: { organization: true },
        },
      },
    });
    // do this calculation regardless of whether the user exists or not to avoid timing attacks
    const { matches, needsRehash } = await verifyPasswordHash(
      user?.passwordHash ?? dummyPasswordHash,
      input.password,
      this.passwordPepper,
    );

    if (!user || user.status !== "ACTIVE") {
      await this.recordLoginFailure(throttleKey);
      throw new AuthenticationError("Invalid email or password");
    }

    if (matches && needsRehash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(input.password, this.passwordPepper),
        },
      });
    }

    const membership = input.organizationSlug
      ? user?.organizationMemberships.find(
          (candidate) => candidate.organization.slug === input.organizationSlug,
        )
      : user?.organizationMemberships[0];
    if (!matches || !membership) {
      await this.recordLoginFailure(throttleKey);
      throw new AuthenticationError("Invalid email or password");
    }

    await this.prisma.loginThrottle.deleteMany({
      where: { keyHash: throttleKey },
    });
    return this.createSession({
      user,
      organization: membership.organization,
      membership,
    });
  }

  async logout(token: string) {
    if (!token) return;
    await this.prisma.session.updateMany({
      where: { tokenHash: digest(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async switchOrganization(token: string, organizationSlug: string) {
    const context = await this.authenticateToken(token);
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: context.userId,
        status: "ACTIVE",
        organization: { slug: organizationSlug },
      },
      select: {
        role: true,
        organization: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!membership) throw new ResourceNotFoundError("Organization membership");

    await this.prisma.session.update({
      where: { id: context.sessionId },
      data: { revokedAt: new Date() },
    });
    return this.createSession({
      user: {
        id: context.userId,
        email: context.email,
        displayName: context.displayName,
      },
      organization: membership.organization,
      membership,
    });
  }

  async listOrganizations(context: AuthContext) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId: context.userId, status: "ACTIVE" },
      include: { organization: true },
      orderBy: { organization: { name: "asc" } },
    });
    return memberships.map((membership) => ({
      id: membership.organizationId,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: lower<OrganizationRole>(membership.role),
    }));
  }

  async listMembers(context: AuthContext) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId: context.organizationId },
      include: {
        user: true,
        teamMemberships: {
          include: { team: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: [{ role: "asc" }, { user: { displayName: "asc" } }],
    });
    return memberships.map((membership) => this.toMember(membership));
  }

  async createInvitation(
    context: AuthContext,
    input: { email: string; role: OrganizationRole },
  ) {
    const email = input.email.trim().toLowerCase();
    const existingMember = await this.prisma.organizationMembership.findFirst({
      where: { organizationId: context.organizationId, user: { email } },
      select: { userId: true },
    });
    if (existingMember) {
      throw new ResourceConflictError(
        "That email already belongs to this organization",
      );
    }

    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + invitationLifetimeMs);
    const invitation = await this.prisma.$transaction(async (transaction) => {
      await transaction.invitation.updateMany({
        where: {
          organizationId: context.organizationId,
          email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      const created = await transaction.invitation.create({
        data: {
          organizationId: context.organizationId,
          email,
          role: roleToPrisma[input.role],
          tokenHash: digest(token),
          invitedByUserId: context.userId,
          expiresAt,
        },
        include: { organization: true },
      });
      await this.writeAudit(transaction, context, {
        action: "member.invited",
        entityType: "invitation",
        entityId: created.id,
        metadata: { email, role: input.role },
      });
      return created;
    });

    return {
      ...this.toInvitation(invitation),
      token,
    };
  }

  async getInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: digest(token) },
      include: { organization: true },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new ResourceNotFoundError("Invitation");
    }
    return this.toInvitation(invitation);
  }

  async acceptInvitation(
    token: string,
    input: { displayName: string; password: string },
  ) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: digest(token) },
      include: { organization: true },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new ResourceNotFoundError("Invitation");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    let existingPasswordNeedsRehash = false;
    if (existingUser) {
      const passwordVerification = await verifyPasswordHash(
        existingUser.passwordHash,
        input.password,
        this.passwordPepper,
      );
      if (!passwordVerification.matches || existingUser.status !== "ACTIVE") {
        throw new AuthenticationError(
          "Existing account credentials are invalid",
        );
      }
      existingPasswordNeedsRehash = passwordVerification.needsRehash;
    }
    const passwordHash =
      existingUser && !existingPasswordNeedsRehash
        ? existingUser.passwordHash
        : await hashPassword(input.password, this.passwordPepper);
    const sessionToken = createOpaqueToken();
    const sessionExpiresAt = new Date(Date.now() + sessionLifetimeMs);

    const acceptance = await this.prisma.$transaction(async (transaction) => {
      const accepted = await transaction.invitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (accepted.count !== 1) throw new ResourceNotFoundError("Invitation");

      const user = existingUser
        ? existingPasswordNeedsRehash
          ? await transaction.user.update({
              where: { id: existingUser.id },
              data: { passwordHash },
            })
          : existingUser
        : await transaction.user.create({
            data: {
              email: invitation.email,
              displayName: input.displayName,
              passwordHash,
            },
          });
      await transaction.organizationMembership.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        },
      });
      const createdSession = await transaction.session.create({
        data: {
          tokenHash: digest(sessionToken),
          userId: user.id,
          organizationId: invitation.organizationId,
          expiresAt: sessionExpiresAt,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorUserId: user.id,
          action: "member.invitation_accepted",
          entityType: "user",
          entityId: user.id,
          metadata: { invitationId: invitation.id },
        },
      });
      return { session: createdSession, user };
    });

    return {
      token: sessionToken,
      expiresAt: sessionExpiresAt.toISOString(),
      context: toContext({
        id: acceptance.session.id,
        user: acceptance.user,
        organization: invitation.organization,
        membership: invitation,
      }),
    };
  }

  async updateMember(
    context: AuthContext,
    userId: string,
    input: { role?: OrganizationRole; status?: MembershipStatus },
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: context.organizationId,
            userId,
          },
        },
        include: {
          user: true,
          teamMemberships: {
            include: { team: { select: { id: true, name: true, slug: true } } },
          },
        },
      });
      if (!membership) throw new ResourceNotFoundError("Organization member");

      const removesOwner =
        membership.role === "OWNER" &&
        ((input.role !== undefined && input.role !== "owner") ||
          input.status === "suspended");
      if (removesOwner) {
        const activeOwners = await transaction.organizationMembership.count({
          where: {
            organizationId: context.organizationId,
            role: "OWNER",
            status: "ACTIVE",
          },
        });
        if (activeOwners <= 1) {
          throw new ResourceConflictError(
            "The organization must keep one active owner",
          );
        }
      }

      const updated = await transaction.organizationMembership.update({
        where: {
          organizationId_userId: {
            organizationId: context.organizationId,
            userId,
          },
        },
        data: {
          role: input.role ? roleToPrisma[input.role] : undefined,
          status: input.status ? statusToPrisma[input.status] : undefined,
        },
        include: {
          user: true,
          teamMemberships: {
            include: { team: { select: { id: true, name: true, slug: true } } },
          },
        },
      });
      if (input.status === "suspended") {
        await transaction.session.updateMany({
          where: {
            organizationId: context.organizationId,
            userId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
      await this.writeAudit(transaction, context, {
        action: "member.updated",
        entityType: "user",
        entityId: userId,
        metadata: input,
      });
      return this.toMember(updated);
    });
  }

  async addTeamMember(context: AuthContext, teamId: string, userId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const team = await transaction.team.findUnique({
        where: {
          organizationId_id: {
            organizationId: context.organizationId,
            id: teamId,
          },
        },
        select: { id: true },
      });
      const membership = await transaction.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: context.organizationId,
            userId,
          },
        },
        select: { userId: true, status: true },
      });
      if (!team) throw new ResourceNotFoundError("Team");
      if (!membership || membership.status !== "ACTIVE") {
        throw new ResourceNotFoundError("Active organization member");
      }
      await transaction.teamMembership.upsert({
        where: {
          organizationId_teamId_userId: {
            organizationId: context.organizationId,
            teamId,
            userId,
          },
        },
        update: {},
        create: { organizationId: context.organizationId, teamId, userId },
      });
      await this.writeAudit(transaction, context, {
        action: "team.member_added",
        entityType: "team",
        entityId: teamId,
        metadata: { userId },
      });
    });
  }

  async removeTeamMember(context: AuthContext, teamId: string, userId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const removed = await transaction.teamMembership.deleteMany({
        where: { organizationId: context.organizationId, teamId, userId },
      });
      if (removed.count === 0)
        throw new ResourceNotFoundError("Team membership");
      await this.writeAudit(transaction, context, {
        action: "team.member_removed",
        entityType: "team",
        entityId: teamId,
        metadata: { userId },
      });
    });
  }

  private async createSession(contextData: SessionContextData) {
    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    const session = await this.prisma.session.create({
      data: {
        tokenHash: digest(token),
        userId: contextData.user.id,
        organizationId: contextData.organization.id,
        expiresAt,
      },
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      context: toContext({ id: session.id, ...contextData }),
    };
  }

  private async assertLoginAllowed(keyHash: string) {
    const throttle = await this.prisma.loginThrottle.findUnique({
      where: { keyHash },
    });

    const now = new Date();
    if (throttle?.lockedUntil && now < throttle.lockedUntil) {
      throw new LoginRateLimitError(
        Math.max(
          1,
          Math.ceil((throttle.lockedUntil.getTime() - Date.now()) / 1_000),
        ),
      );
    }
  }

  private async recordLoginFailure(keyHash: string) {
    const now = new Date();
    const current = await this.prisma.loginThrottle.findUnique({
      where: { keyHash },
    });
    const windowExpired =
      !current ||
      current.windowStartedAt.getTime() <= now.getTime() - throttleWindowMs;
    const attemptCount = windowExpired ? 1 : current.attemptCount + 1;
    await this.prisma.loginThrottle.upsert({
      where: { keyHash },
      create: {
        keyHash,
        attemptCount,
        windowStartedAt: now,
        lockedUntil:
          attemptCount >= maxLoginAttempts
            ? new Date(now.getTime() + throttleLockMs)
            : null,
      },
      update: {
        attemptCount,
        windowStartedAt: windowExpired ? now : undefined,
        lockedUntil:
          attemptCount >= maxLoginAttempts
            ? new Date(now.getTime() + throttleLockMs)
            : null,
      },
    });
  }

  private toMember(membership: {
    userId: string;
    role: PrismaOrganizationRole;
    status: PrismaMembershipStatus;
    createdAt: Date;
    user: { email: string; displayName: string; status: string };
    teamMemberships: Array<{
      team: { id: string; name: string; slug: string };
    }>;
  }): MemberRecord {
    return {
      userId: membership.userId,
      email: membership.user.email,
      displayName: membership.user.displayName,
      userStatus: lower(membership.user.status),
      role: lower(membership.role),
      membershipStatus: lower(membership.status),
      teams: membership.teamMemberships.map((entry) => entry.team),
      createdAt: membership.createdAt.toISOString(),
    };
  }

  private toInvitation(invitation: {
    id: string;
    email: string;
    role: PrismaOrganizationRole;
    expiresAt: Date;
    organization: { name: string; slug: string };
  }): InvitationRecord {
    return {
      id: invitation.id,
      email: invitation.email,
      role: lower(invitation.role),
      organizationName: invitation.organization.name,
      organizationSlug: invitation.organization.slug,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  private writeAudit(
    transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    context: AuthContext,
    entry: {
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return transaction.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  }
}
