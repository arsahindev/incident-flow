import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";

import { hash } from "@node-rs/argon2";

import { buildApp } from "./app.js";
import { PrismaAuthService } from "./auth/service.js";
import { loadDatabaseConfig } from "./config.js";
import { createPrismaClient } from "./database.js";
import { PrismaIncidentRepository } from "./incidents/prisma-repository.js";
import { PrismaServiceRepository } from "./services/prisma-repository.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const passwordPepper = Buffer.alloc(32, 3);

function databaseUrl() {
  return loadDatabaseConfig().DATABASE_URL;
}

function sessionHeader(token: string) {
  return { authorization: `Session ${token}` };
}

test(
  "authenticated tenant context, roles, invitations, audit actors, and revocation",
  { skip: !runDatabaseTests },
  async () => {
    const prisma = createPrismaClient(databaseUrl());
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const ownerId = randomUUID();
    const teamId = randomUUID();
    const serviceId = randomUUID();
    const otherIncidentId = randomUUID();
    const organizationSlug = `identity-${organizationId}`;
    const ownerEmail = `owner-${ownerId}@example.com`;
    const ownerPassword = "Owner-Integration-2026!";
    const invitedEmail = `viewer-${randomUUID()}@example.com`;
    const invitedPassword = "Viewer-Integration-2026!";
    const disconnectedSessions: string[] = [];
    const disconnectedUsers: Array<{ organizationId: string; userId: string }> = [];
    const app = buildApp({
      authService: new PrismaAuthService(prisma, passwordPepper),
      incidentRepository: new PrismaIncidentRepository(prisma),
      serviceRepository: new PrismaServiceRepository(prisma),
      realtimeSessionRevoker: {
        async disconnectSession(sessionId) {
          disconnectedSessions.push(sessionId);
        },
        async disconnectUser(disconnectedOrganizationId, userId) {
          disconnectedUsers.push({
            organizationId: disconnectedOrganizationId,
            userId,
          });
        },
      },
      logger: false,
    });

    try {
      await prisma.organization.createMany({
        data: [
          { id: organizationId, name: "Identity tenant", slug: organizationSlug },
          {
            id: otherOrganizationId,
            name: "Other identity tenant",
            slug: `other-${otherOrganizationId}`,
          },
        ],
      });
      await prisma.user.create({
        data: {
          id: ownerId,
          email: ownerEmail,
          displayName: "Integration Owner",
          passwordHash: await hash(ownerPassword, {
            memoryCost: 19_456,
            timeCost: 2,
            parallelism: 1,
          }),
          organizationMemberships: {
            create: { organizationId, role: "OWNER" },
          },
        },
      });
      await prisma.team.create({
        data: { id: teamId, organizationId, name: "Response", slug: "response" },
      });
      await prisma.service.create({
        data: {
          id: serviceId,
          organizationId,
          ownerTeamId: teamId,
          name: "Identity API",
          slug: "identity-api",
          type: "API",
        },
      });
      await prisma.incident.create({
        data: {
          id: otherIncidentId,
          organizationId: otherOrganizationId,
          title: "Other tenant incident",
        },
      });

      const login = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: ownerEmail, password: ownerPassword },
      });
      assert.equal(login.statusCode, 200);
      assert.match(
        (await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).passwordHash,
        /^argon2id-pepper-v1:/,
      );
      const ownerToken = login.json().session.token as string;

      const session = await app.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: sessionHeader(ownerToken),
      });
      assert.equal(session.statusCode, 200);
      assert.equal(session.json().session.organizationId, organizationId);
      assert.equal(session.json().session.role, "owner");

      const crossTenant = await app.inject({
        method: "GET",
        url: `/v1/incidents/${otherIncidentId}`,
        headers: sessionHeader(ownerToken),
      });
      assert.equal(crossTenant.statusCode, 404);

      const createdIncident = await app.inject({
        method: "POST",
        url: "/v1/incidents",
        headers: sessionHeader(ownerToken),
        payload: {
          title: "Authenticated incident",
          teamId,
          serviceIds: [serviceId],
        },
      });
      assert.equal(createdIncident.statusCode, 201);
      const incidentId = createdIncident.json().incident.id as string;
      assert.equal(createdIncident.json().incident.version, 1);
      assert.equal(
        await prisma.incidentActivity.count({ where: { incidentId, actorUserId: ownerId } }),
        3,
      );

      const updatedIncident = await app.inject({
        method: "PATCH",
        url: `/v1/incidents/${incidentId}`,
        headers: sessionHeader(ownerToken),
        payload: { status: "acknowledged" },
      });
      assert.equal(updatedIncident.statusCode, 200);
      assert.equal(updatedIncident.json().incident.version, 2);

      const noOpUpdate = await app.inject({
        method: "PATCH",
        url: `/v1/incidents/${incidentId}`,
        headers: sessionHeader(ownerToken),
        payload: { status: "acknowledged" },
      });
      assert.equal(noOpUpdate.statusCode, 200);
      assert.equal(noOpUpdate.json().incident.version, 2);

      const invitationResponse = await app.inject({
        method: "POST",
        url: "/v1/invitations",
        headers: sessionHeader(ownerToken),
        payload: { email: invitedEmail, role: "viewer" },
      });
      assert.equal(invitationResponse.statusCode, 201);
      const invitationToken = invitationResponse.json().invitation.token as string;

      const acceptance = await app.inject({
        method: "POST",
        url: `/v1/invitations/${invitationToken}/accept`,
        payload: {
          displayName: "Integration Viewer",
          password: invitedPassword,
        },
      });
      assert.equal(acceptance.statusCode, 200);
      const viewerToken = acceptance.json().session.token as string;
      const viewerId = acceptance.json().session.context.userId as string;

      const viewerRead = await app.inject({
        method: "GET",
        url: "/v1/services",
        headers: sessionHeader(viewerToken),
      });
      assert.equal(viewerRead.statusCode, 200);
      const viewerWrite = await app.inject({
        method: "POST",
        url: "/v1/services",
        headers: sessionHeader(viewerToken),
        payload: {},
      });
      assert.equal(viewerWrite.statusCode, 403);

      const addViewerToTeam = await app.inject({
        method: "PUT",
        url: `/v1/teams/${teamId}/members/${viewerId}`,
        headers: sessionHeader(ownerToken),
      });
      assert.equal(addViewerToTeam.statusCode, 204);
      assert.equal(
        await prisma.teamMembership.count({
          where: { organizationId, teamId, userId: viewerId },
        }),
        1,
      );

      const lastOwnerChange = await app.inject({
        method: "PATCH",
        url: `/v1/members/${ownerId}`,
        headers: sessionHeader(ownerToken),
        payload: { role: "admin" },
      });
      assert.equal(lastOwnerChange.statusCode, 409);

      const suspendViewer = await app.inject({
        method: "PATCH",
        url: `/v1/members/${viewerId}`,
        headers: sessionHeader(ownerToken),
        payload: { status: "suspended" },
      });
      assert.equal(suspendViewer.statusCode, 200);
      assert.deepEqual(disconnectedUsers, [{ organizationId, userId: viewerId }]);
      const suspendedSession = await app.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: sessionHeader(viewerToken),
      });
      assert.equal(suspendedSession.statusCode, 401);

      assert.ok(
        await prisma.auditLog.count({
          where: { organizationId, actorUserId: ownerId, action: "member.invited" },
        }),
      );

      await prisma.organizationMembership.create({
        data: { organizationId: otherOrganizationId, userId: ownerId, role: "OWNER" },
      });
      const organizationAccess = await app.inject({
        method: "GET",
        url: "/v1/auth/organizations",
        headers: sessionHeader(ownerToken),
      });
      assert.equal(organizationAccess.statusCode, 200);
      assert.equal(organizationAccess.json().organizations.length, 2);
      const switched = await app.inject({
        method: "POST",
        url: "/v1/auth/switch-organization",
        headers: sessionHeader(ownerToken),
        payload: { organizationSlug: `other-${otherOrganizationId}` },
      });
      assert.equal(switched.statusCode, 200);
      assert.deepEqual(disconnectedSessions, [
        login.json().session.context.sessionId,
      ]);
      const rotatedOwnerToken = switched.json().session.token as string;
      assert.notEqual(rotatedOwnerToken, ownerToken);
      assert.equal(switched.json().session.context.organizationId, otherOrganizationId);

      const revokedByRotation = await app.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: sessionHeader(ownerToken),
      });
      assert.equal(revokedByRotation.statusCode, 401);

      await prisma.user.update({ where: { id: ownerId }, data: { status: "DISABLED" } });
      const disabledSession = await app.inject({
        method: "GET",
        url: "/v1/auth/session",
        headers: sessionHeader(rotatedOwnerToken),
      });
      assert.equal(disabledSession.statusCode, 401);
    } finally {
      await app.close();
      await prisma.organization.deleteMany({
        where: { id: { in: [organizationId, otherOrganizationId] } },
      });
      await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, invitedEmail] } } });
      await prisma.$disconnect();
    }
  },
);

test(
  "login throttling locks repeated invalid credentials",
  { skip: !runDatabaseTests },
  async () => {
    const prisma = createPrismaClient(databaseUrl());
    const authService = new PrismaAuthService(prisma, passwordPepper);
    const app = buildApp({ authService, logger: false });
    const email = `missing-${randomUUID()}@example.com`;
    const keyHash = createHash("sha256")
      .update(`${email}:127.0.0.1`)
      .digest("hex");
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await app.inject({
          method: "POST",
          url: "/v1/auth/login",
          payload: { email, password: "Wrong-Password-2026!" },
        });
        assert.equal(response.statusCode, 401);
      }
      const locked = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email, password: "Wrong-Password-2026!" },
      });
      assert.equal(locked.statusCode, 429);
      assert.ok(locked.headers["retry-after"]);
    } finally {
      await app.close();
      await prisma.loginThrottle.deleteMany({ where: { keyHash } });
      await prisma.$disconnect();
    }
  },
);
