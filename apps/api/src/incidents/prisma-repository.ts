import type {
  IncidentActivityType as PrismaActivityType,
  IncidentPriority as PrismaPriority,
  IncidentStatus as PrismaStatus,
  Prisma,
  PrismaClient,
} from "../generated/prisma/client.js";
import {
  priorityLabels,
  ResourceNotFoundError,
  statusLabels,
  type IncidentRepository,
} from "./repository.js";
import type {
  CreateIncidentInput,
  IncidentDetailRecord,
  IncidentPriority,
  IncidentStatus,
  IncidentSummaryRecord,
  UpdateIncidentInput,
} from "./types.js";

const incidentSummaryInclude = {
  team: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.IncidentInclude;

const incidentDetailInclude = {
  ...incidentSummaryInclude,
  activity: { orderBy: { createdAt: "desc" as const } },
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

  async listIncidents(organizationSlug: string) {
    const incidents = await this.prisma.incident.findMany({
      where: { organization: { slug: organizationSlug } },
      include: incidentSummaryInclude,
      orderBy: { createdAt: "desc" },
    });

    return incidents.map(toSummary);
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
  ) {
    return this.prisma.$transaction(async (transaction) => {
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

      const incident = await transaction.incident.create({
        data: {
          organizationId: organization.id,
          teamId: team?.id,
          title: input.title,
          description: input.description || null,
          priority: priorityToPrisma[input.priority],
        },
      });

      await transaction.incidentActivity.create({
        data: {
          organizationId: organization.id,
          incidentId: incident.id,
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
            type: "TEAM_ASSIGNED",
            message: `Assigned to ${team.name}`,
            toValue: team.id,
          },
        });
      }

      return this.getIncidentInTransaction(
        transaction,
        organization.id,
        incident.id,
      );
    });
  }

  async updateIncident(
    organizationSlug: string,
    incidentId: string,
    input: UpdateIncidentInput,
  ) {
    return this.prisma.$transaction(async (transaction) => {
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
        type: PrismaActivityType;
        message: string;
        fromValue: string | null;
        toValue: string | null;
      }> = [];

      const currentStatus = fromPrismaStatus(existing.status);
      const statusChanged = input.status !== undefined && input.status !== currentStatus;
      if (statusChanged && input.status) {
        activity.push({
          organizationId: existing.organizationId,
          incidentId,
          type: "STATUS_CHANGED",
          message: `Status changed from ${statusLabels[currentStatus]} to ${statusLabels[input.status]}`,
          fromValue: currentStatus,
          toValue: input.status,
        });
      }

      const requestedTeamId = input.teamId === undefined ? existing.teamId : input.teamId;
      if (input.teamId !== undefined && requestedTeamId !== existing.teamId) {
        activity.push({
          organizationId: existing.organizationId,
          incidentId,
          type: "TEAM_ASSIGNED",
          message: nextTeam ? `Assigned to ${nextTeam.name}` : "Team assignment removed",
          fromValue: existing.teamId,
          toValue: requestedTeamId ?? null,
        });
      }

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
        },
      });

      if (activity.length > 0) {
        await transaction.incidentActivity.createMany({ data: activity });
      }

      return this.getIncidentInTransaction(
        transaction,
        existing.organizationId,
        incidentId,
      );
    });
  }

  private async getIncidentInTransaction(
    transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    organizationId: string,
    incidentId: string,
  ) {
    const incident = await transaction.incident.findUniqueOrThrow({
      where: { organizationId_id: { organizationId, id: incidentId } },
      include: incidentDetailInclude,
    });
    return toDetail(incident);
  }
}
