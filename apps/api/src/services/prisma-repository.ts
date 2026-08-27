import type {
  Prisma,
  PrismaClient,
  ServiceEnvironmentKind as PrismaEnvironmentKind,
  ServiceEnvironmentStatus as PrismaEnvironmentStatus,
  ServiceStatus as PrismaServiceStatus,
  ServiceTier as PrismaServiceTier,
  ServiceType as PrismaServiceType,
} from "../generated/prisma/client.js";
import {
  ResourceConflictError,
  ResourceNotFoundError,
} from "../incidents/repository.js";
import type { ServiceRepository } from "./repository.js";
import type {
  CreateServiceEnvironmentInput,
  CreateServiceInput,
  ServiceDetailRecord,
  ServiceEnvironmentKind,
  ServiceEnvironmentRecord,
  ServiceEnvironmentStatus,
  ServiceRecord,
  ServiceStatus,
  ServiceTier,
  ServiceType,
  UpdateServiceEnvironmentInput,
  UpdateServiceInput,
} from "./types.js";

const serviceInclude = {
  ownerTeam: { select: { id: true, name: true, slug: true } },
  environments: { orderBy: [{ status: "asc" as const }, { name: "asc" as const }] },
  _count: { select: { affectedIncidents: true } },
} satisfies Prisma.ServiceInclude;

const serviceDetailInclude = {
  ...serviceInclude,
  affectedIncidents: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: {
      incident: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceInclude;

type PrismaServiceRecord = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;
type PrismaServiceDetail = Prisma.ServiceGetPayload<{
  include: typeof serviceDetailInclude;
}>;

const serviceTypeToPrisma: Record<ServiceType, PrismaServiceType> = {
  application: "APPLICATION",
  api: "API",
  platform: "PLATFORM",
  infrastructure: "INFRASTRUCTURE",
  business: "BUSINESS",
  external: "EXTERNAL",
};

const serviceTierToPrisma: Record<ServiceTier, PrismaServiceTier> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

const serviceStatusToPrisma: Record<ServiceStatus, PrismaServiceStatus> = {
  operational: "OPERATIONAL",
  degraded: "DEGRADED",
  disrupted: "DISRUPTED",
  maintenance: "MAINTENANCE",
};

const environmentKindToPrisma: Record<
  ServiceEnvironmentKind,
  PrismaEnvironmentKind
> = {
  development: "DEVELOPMENT",
  test: "TEST",
  staging: "STAGING",
  production: "PRODUCTION",
  preview: "PREVIEW",
  other: "OTHER",
};

const environmentStatusToPrisma: Record<
  ServiceEnvironmentStatus,
  PrismaEnvironmentStatus
> = {
  active: "ACTIVE",
  archived: "ARCHIVED",
};

function lower<T extends string>(value: string) {
  return value.toLowerCase() as T;
}

function toEnvironment(
  environment: Prisma.ServiceEnvironmentGetPayload<Record<string, never>>,
): ServiceEnvironmentRecord {
  return {
    id: environment.id,
    name: environment.name,
    slug: environment.slug,
    kind: lower<ServiceEnvironmentKind>(environment.kind),
    isEphemeral: environment.isEphemeral,
    expiresAt: environment.expiresAt?.toISOString() ?? null,
    status: lower<ServiceEnvironmentStatus>(environment.status),
    createdAt: environment.createdAt.toISOString(),
    updatedAt: environment.updatedAt.toISOString(),
  };
}

function toService(service: PrismaServiceRecord): ServiceRecord {
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    type: lower<ServiceType>(service.type),
    tier: lower<ServiceTier>(service.tier),
    status: lower<ServiceStatus>(service.status),
    ownerTeam: service.ownerTeam,
    environments: service.environments.map(toEnvironment),
    incidentCount: service._count.affectedIncidents,
    archivedAt: service.archivedAt?.toISOString() ?? null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

function toServiceDetail(service: PrismaServiceDetail): ServiceDetailRecord {
  return {
    ...toService(service),
    recentIncidents: service.affectedIncidents.map((affected) => ({
      id: affected.incident.id,
      title: affected.incident.title,
      status: lower(affected.incident.status),
      priority: lower(affected.incident.priority),
      isPrimary: affected.isPrimary,
      createdAt: affected.incident.createdAt.toISOString(),
    })),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listServices(organizationSlug: string) {
    const services = await this.prisma.service.findMany({
      where: {
        organization: { slug: organizationSlug },
        archivedAt: null,
      },
      include: serviceInclude,
      orderBy: { name: "asc" },
    });
    return services.map(toService);
  }

  async getService(organizationSlug: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, organization: { slug: organizationSlug } },
      include: serviceDetailInclude,
    });
    if (!service) throw new ResourceNotFoundError("Service");
    return toServiceDetail(service);
  }

  async createService(
    organizationSlug: string,
    input: CreateServiceInput,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const organization = await transaction.organization.findUnique({
          where: { slug: organizationSlug },
          select: { id: true },
        });
        if (!organization) throw new ResourceNotFoundError("Organization");
        await this.assertTeam(transaction, organization.id, input.ownerTeamId);

        const service = await transaction.service.create({
          data: {
            organizationId: organization.id,
            ownerTeamId: input.ownerTeamId,
            name: input.name,
            slug: input.slug,
            description: input.description || null,
            type: serviceTypeToPrisma[input.type],
            tier: serviceTierToPrisma[input.tier],
          },
          select: { id: true },
        });

        await transaction.serviceEnvironment.createMany({
          data: input.environments.map((environment) => ({
            organizationId: organization.id,
            serviceId: service.id,
            name: environment.name,
            slug: environment.slug,
            kind: environmentKindToPrisma[environment.kind],
            isEphemeral: environment.isEphemeral,
            expiresAt: environment.expiresAt ? new Date(environment.expiresAt) : null,
          })),
        });

        await transaction.auditLog.create({
          data: {
            organizationId: organization.id,
            actorUserId,
            action: "service.created",
            entityType: "service",
            entityId: service.id,
            metadata: { name: input.name, type: input.type, tier: input.tier },
          },
        });

        return this.getServiceInTransaction(transaction, organization.id, service.id);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ResourceConflictError(
          "A service or environment with that slug already exists",
        );
      }
      throw error;
    }
  }

  async updateService(
    organizationSlug: string,
    serviceId: string,
    input: UpdateServiceInput,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.service.findFirst({
          where: { id: serviceId, organization: { slug: organizationSlug } },
          select: { id: true, organizationId: true },
        });
        if (!existing) throw new ResourceNotFoundError("Service");
        await this.assertTeam(transaction, existing.organizationId, input.ownerTeamId);

        await transaction.service.update({
          where: {
            organizationId_id: {
              organizationId: existing.organizationId,
              id: serviceId,
            },
          },
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description,
            type: input.type ? serviceTypeToPrisma[input.type] : undefined,
            tier: input.tier ? serviceTierToPrisma[input.tier] : undefined,
            status: input.status ? serviceStatusToPrisma[input.status] : undefined,
            ownerTeamId: input.ownerTeamId,
            archivedAt:
              input.archived === undefined
                ? undefined
                : input.archived
                  ? new Date()
                  : null,
          },
        });

        if (input.archived) {
          await transaction.serviceEnvironment.updateMany({
            where: { organizationId: existing.organizationId, serviceId },
            data: { status: "ARCHIVED" },
          });
        }

        await transaction.auditLog.create({
          data: {
            organizationId: existing.organizationId,
            actorUserId,
            action: input.archived ? "service.archived" : "service.updated",
            entityType: "service",
            entityId: serviceId,
            metadata: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
          },
        });

        return this.getServiceInTransaction(
          transaction,
          existing.organizationId,
          serviceId,
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ResourceConflictError("A service with that slug already exists");
      }
      throw error;
    }
  }

  async createEnvironment(
    organizationSlug: string,
    serviceId: string,
    input: CreateServiceEnvironmentInput,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const service = await transaction.service.findFirst({
          where: { id: serviceId, organization: { slug: organizationSlug } },
          select: { id: true, organizationId: true, archivedAt: true },
        });
        if (!service) throw new ResourceNotFoundError("Service");
        if (service.archivedAt) {
          throw new ResourceConflictError("Archived services cannot add environments");
        }

        const environment = await transaction.serviceEnvironment.create({
          data: {
            organizationId: service.organizationId,
            serviceId,
            name: input.name,
            slug: input.slug,
            kind: environmentKindToPrisma[input.kind],
            isEphemeral: input.isEphemeral,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: service.organizationId,
            actorUserId,
            action: "service_environment.created",
            entityType: "service_environment",
            entityId: environment.id,
            metadata: { serviceId, name: input.name, kind: input.kind },
          },
        });
        return toEnvironment(environment);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ResourceConflictError(
          "An environment with that slug already exists for this service",
        );
      }
      throw error;
    }
  }

  async updateEnvironment(
    organizationSlug: string,
    serviceId: string,
    environmentId: string,
    input: UpdateServiceEnvironmentInput,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.serviceEnvironment.findFirst({
          where: {
            id: environmentId,
            serviceId,
            organization: { slug: organizationSlug },
          },
        });
        if (!existing) throw new ResourceNotFoundError("Service environment");

        const nextIsEphemeral = input.isEphemeral ?? existing.isEphemeral;
        const nextExpiresAt =
          input.expiresAt === undefined
            ? existing.expiresAt
            : input.expiresAt
              ? new Date(input.expiresAt)
              : null;
        if (!nextIsEphemeral && nextExpiresAt) {
          throw new ResourceConflictError(
            "Only ephemeral environments may have an expiry time",
          );
        }

        const environment = await transaction.serviceEnvironment.update({
          where: { id: environmentId },
          data: {
            name: input.name,
            slug: input.slug,
            kind: input.kind ? environmentKindToPrisma[input.kind] : undefined,
            isEphemeral: input.isEphemeral,
            expiresAt: nextExpiresAt,
            status: input.status
              ? environmentStatusToPrisma[input.status]
              : undefined,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: existing.organizationId,
            actorUserId,
            action: "service_environment.updated",
            entityType: "service_environment",
            entityId: environmentId,
            metadata: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
          },
        });
        return toEnvironment(environment);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ResourceConflictError(
          "An environment with that slug already exists for this service",
        );
      }
      throw error;
    }
  }

  private async assertTeam(
    transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    organizationId: string,
    teamId: string | null | undefined,
  ) {
    if (!teamId) return;
    const team = await transaction.team.findFirst({
      where: { id: teamId, organizationId },
      select: { id: true },
    });
    if (!team) throw new ResourceNotFoundError("Team");
  }

  private async getServiceInTransaction(
    transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    organizationId: string,
    serviceId: string,
  ) {
    const service = await transaction.service.findUniqueOrThrow({
      where: { organizationId_id: { organizationId, id: serviceId } },
      include: serviceDetailInclude,
    });
    return toServiceDetail(service);
  }
}
