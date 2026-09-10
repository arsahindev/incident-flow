import type {
  IncidentActivityType as PrismaActivityType,
  IncidentPriority as PrismaPriority,
  IncidentStatus as PrismaStatus,
  Prisma,
  PrismaClient,
} from "../generated/prisma/client.js";
import {
  priorityLabels,
  statusLabels,
  ResourceNotFoundError,
  type IncidentRepository,
} from "./repository.js";
import type {
  CreateIncidentInput,
  IncidentDetailRecord,
  IncidentListFilters,
  IncidentMutationChange,
  IncidentPriority,
  IncidentStatus,
  IncidentSummaryRecord,
  UpdateIncidentInput,
} from "./types.js";

const incidentSummaryInclude = {
  team: { select: { id: true, name: true, slug: true } },
  affectedServices: {
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
    include: {
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          tier: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.IncidentInclude;

const incidentDetailInclude = {
  ...incidentSummaryInclude,
  activity: {
    orderBy: { createdAt: "desc" as const },
    include: { actor: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.IncidentInclude;

type PrismaIncidentSummary = Prisma.IncidentGetPayload<{
  include: typeof incidentSummaryInclude;
}>;
type PrismaIncidentDetail = Prisma.IncidentGetPayload<{
  include: typeof incidentDetailInclude;
}>;

const statusToPrisma: Record<IncidentStatus, PrismaStatus> = {
  open: "OPEN",
  acknowledged: "ACKNOWLEDGED",
  resolved: "RESOLVED",
};

const priorityToPrisma: Record<IncidentPriority, PrismaPriority> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

function fromPrismaStatus(status: PrismaStatus): IncidentStatus {
  return status.toLowerCase() as IncidentStatus;
}

function fromPrismaPriority(priority: PrismaPriority): IncidentPriority {
  return priority.toLowerCase() as IncidentPriority;
}

function toSummary(incident: PrismaIncidentSummary): IncidentSummaryRecord {
  return {
    id: incident.id,
    title: incident.title,
    description: incident.description,
    status: fromPrismaStatus(incident.status),
    priority: fromPrismaPriority(incident.priority),
    team: incident.team,
    affectedServices: incident.affectedServices.map((affected) => ({
      id: affected.service.id,
      name: affected.service.name,
      slug: affected.service.slug,
      type: affected.service.type.toLowerCase() as IncidentSummaryRecord["affectedServices"][number]["type"],
      tier: affected.service.tier.toLowerCase() as IncidentSummaryRecord["affectedServices"][number]["tier"],
      status: affected.service.status.toLowerCase() as IncidentSummaryRecord["affectedServices"][number]["status"],
      isPrimary: affected.isPrimary,
    })),
    version: incident.version,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

function toDetail(incident: PrismaIncidentDetail): IncidentDetailRecord {
  return {
    ...toSummary(incident),
    activity: incident.activity.map((entry) => ({
      id: entry.id,
      type: entry.type.toLowerCase() as IncidentDetailRecord["activity"][number]["type"],
      message: entry.message,
      fromValue: entry.fromValue,
      toValue: entry.toValue,
      actor: entry.actor,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export class PrismaIncidentRepository implements IncidentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listTeams(organizationSlug: string) {
    return this.prisma.team.findMany({
      where: { organization: { slug: organizationSlug } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }

  async listIncidents(organizationSlug: string, filters: IncidentListFilters) {
    const where = {
      organization: { slug: organizationSlug },
      teamId: filters.teamId,
      status: filters.status ? statusToPrisma[filters.status] : undefined,
      priority: filters.priority ? priorityToPrisma[filters.priority] : undefined,
      affectedServices: filters.serviceId
        ? { some: { serviceId: filters.serviceId } }
        : undefined,
    } satisfies Prisma.IncidentWhereInput;
    const [incidents, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include: incidentSummaryInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      incidents: incidents.map(toSummary),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    };
  }

  async getIncident(organizationSlug: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organization: { slug: organizationSlug } },
      include: incidentDetailInclude,
    });

    if (!incident) throw new ResourceNotFoundError("Incident");
    return toDetail(incident);
  }

  async createIncident(
    organizationSlug: string,
    input: CreateIncidentInput,
    actorUserId: string,
  ) {
    const incidentId = await this.prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.findUnique({
        where: { slug: organizationSlug },
        select: { id: true },
      });
      if (!organization) throw new ResourceNotFoundError("Organization");

      const team = input.teamId
        ? await transaction.team.findFirst({
            where: { id: input.teamId, organizationId: organization.id },
            select: { id: true, name: true },
          })
        : null;
      if (input.teamId && !team) throw new ResourceNotFoundError("Team");

      const services = await this.getAffectedServices(
        transaction,
        organization.id,
        input.serviceIds,
      );

      const incident = await transaction.incident.create({
        data: {
          organizationId: organization.id,
          teamId: team?.id,
          title: input.title,
          description: input.description || null,
          priority: priorityToPrisma[input.priority],
        },
      });

      await transaction.incidentAffectedService.createMany({
        data: services.map((service) => ({
          organizationId: organization.id,
          incidentId: incident.id,
          serviceId: service.id,
          isPrimary: service.id === (input.primaryServiceId ?? services[0]?.id),
        })),
      });

      await transaction.incidentActivity.create({
        data: {
          organizationId: organization.id,
          incidentId: incident.id,
          actorUserId,
          type: "CREATED",
          message: `Incident created with ${priorityLabels[input.priority]} priority`,
          toValue: input.priority,
        },
      });

      if (team) {
        await transaction.incidentActivity.create({
          data: {
            organizationId: organization.id,
            incidentId: incident.id,
            actorUserId,
            type: "TEAM_ASSIGNED",
            message: `Assigned to ${team.name}`,
            toValue: team.id,
          },
        });
      }

      await transaction.incidentActivity.create({
        data: {
          organizationId: organization.id,
          incidentId: incident.id,
          actorUserId,
          type: "AFFECTED_SERVICES_CHANGED",
          message: `Affected services set to ${services.map((service) => service.name).join(", ")}; primary: ${services.find((service) => service.id === (input.primaryServiceId ?? services[0]?.id))?.name}`,
          toValue: JSON.stringify(services.map((service) => service.id)),
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId,
          action: "incident.created",
          entityType: "incident",
          entityId: incident.id,
          metadata: { priority: input.priority, serviceIds: input.serviceIds },
        },
      });

      return incident.id;
    });
    const incident = await this.getIncident(organizationSlug, incidentId);
    const changes: IncidentMutationChange[] = [
      "created",
      ...(input.teamId ? (["assignment"] as const) : []),
      "affected_services",
      "activity",
    ];
    return {
      incident,
      changes,
    };
  }

  async updateIncident(
    organizationSlug: string,
    incidentId: string,
    input: UpdateIncidentInput,
    actorUserId: string,
  ) {
    const changes = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.incident.findFirst({
        where: { id: incidentId, organization: { slug: organizationSlug } },
        include: incidentSummaryInclude,
      });
      if (!existing) throw new ResourceNotFoundError("Incident");

      const nextTeam =
        input.teamId === undefined || input.teamId === null
          ? null
          : await transaction.team.findFirst({
              where: {
                id: input.teamId,
                organizationId: existing.organizationId,
              },
              select: { id: true, name: true },
            });
      if (input.teamId && !nextTeam) throw new ResourceNotFoundError("Team");

      const activity: Array<{
        organizationId: string;
        incidentId: string;
        actorUserId: string;
        type: PrismaActivityType;
        message: string;
        fromValue: string | null;
        toValue: string | null;
      }> = [];
      const mutationChanges: IncidentMutationChange[] = [];

      const currentStatus = fromPrismaStatus(existing.status);
      const statusChanged = input.status !== undefined && input.status !== currentStatus;
      if (statusChanged && input.status) {
        mutationChanges.push("status");
        activity.push({
          organizationId: existing.organizationId,
          incidentId,
          actorUserId,
          type: "STATUS_CHANGED",
          message: `Status changed from ${statusLabels[currentStatus]} to ${statusLabels[input.status]}`,
          fromValue: currentStatus,
          toValue: input.status,
        });
      }

      const requestedTeamId = input.teamId === undefined ? existing.teamId : input.teamId;
      if (input.teamId !== undefined && requestedTeamId !== existing.teamId) {
        mutationChanges.push("assignment");
        activity.push({
          organizationId: existing.organizationId,
          incidentId,
          actorUserId,
          type: "TEAM_ASSIGNED",
          message: nextTeam ? `Assigned to ${nextTeam.name}` : "Team assignment removed",
          fromValue: existing.teamId,
          toValue: requestedTeamId ?? null,
        });
      }

      if (input.serviceIds !== undefined) {
        const nextServices = await this.getAffectedServices(
          transaction,
          existing.organizationId,
          input.serviceIds,
        );
        const currentServiceIds = existing.affectedServices.map(
          (affected) => affected.serviceId,
        );
        const nextServiceIds = nextServices.map((service) => service.id);
        const currentPrimaryId = existing.affectedServices.find(
          (affected) => affected.isPrimary,
        )?.serviceId;
        const nextPrimaryId = input.primaryServiceId ?? nextServices[0]?.id;
        const servicesChanged =
          currentPrimaryId !== nextPrimaryId ||
          currentServiceIds.length !== nextServiceIds.length ||
          currentServiceIds.some((id) => !nextServiceIds.includes(id));

        if (servicesChanged) {
          mutationChanges.push("affected_services");
          await transaction.incidentAffectedService.deleteMany({
            where: {
              organizationId: existing.organizationId,
              incidentId,
            },
          });
          await transaction.incidentAffectedService.createMany({
            data: nextServices.map((service) => ({
              organizationId: existing.organizationId,
              incidentId,
              serviceId: service.id,
              isPrimary: service.id === nextPrimaryId,
            })),
          });
          activity.push({
            organizationId: existing.organizationId,
            incidentId,
            actorUserId,
            type: "AFFECTED_SERVICES_CHANGED",
            message: `Affected services changed to ${nextServices
              .map((service) => service.name)
              .join(", ")}; primary: ${nextServices.find((service) => service.id === nextPrimaryId)?.name}`,
            fromValue: JSON.stringify(currentServiceIds),
            toValue: JSON.stringify(nextServiceIds),
          });
        }
      }

      if (activity.length > 0) {
        mutationChanges.push("activity");
        await transaction.incident.update({
          where: {
            organizationId_id: {
              organizationId: existing.organizationId,
              id: incidentId,
            },
          },
          data: {
            status: input.status ? statusToPrisma[input.status] : undefined,
            teamId: input.teamId,
            resolvedAt:
              statusChanged && input.status === "resolved"
                ? new Date()
                : statusChanged
                  ? null
                  : undefined,
            version: { increment: 1 },
          },
        });
        await transaction.incidentActivity.createMany({ data: activity });
        await transaction.auditLog.create({
          data: {
            organizationId: existing.organizationId,
            actorUserId,
            action: "incident.updated",
            entityType: "incident",
            entityId: incidentId,
            metadata: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
          },
        });
      }
      return mutationChanges;
    });
    return {
      incident: await this.getIncident(organizationSlug, incidentId),
      changes,
    };
  }

  private async getAffectedServices(
    transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    organizationId: string,
    serviceIds: string[],
  ) {
    const uniqueServiceIds = [...new Set(serviceIds)];
    if (uniqueServiceIds.length !== serviceIds.length) {
      throw new ResourceNotFoundError("Affected service");
    }
    const services = await transaction.service.findMany({
      where: {
        organizationId,
        id: { in: uniqueServiceIds },
        archivedAt: null,
      },
      select: { id: true, name: true },
    });
    if (services.length !== uniqueServiceIds.length) {
      throw new ResourceNotFoundError("Affected service");
    }
    const serviceById = new Map(services.map((service) => [service.id, service]));
    return uniqueServiceIds.map((id) => serviceById.get(id)!);
  }
}
