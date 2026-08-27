import type {
  CreateIncidentInput,
  IncidentDetailRecord,
  IncidentPriority,
  IncidentStatus,
  IncidentListFilters,
  IncidentListResult,
  TeamRecord,
  UpdateIncidentInput,
} from "./types.js";

export class ResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found`);
    this.name = "ResourceNotFoundError";
  }
}

export class ResourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceConflictError";
  }
}

export interface IncidentRepository {
  listTeams(organizationSlug: string): Promise<TeamRecord[]>;
  listIncidents(
    organizationSlug: string,
    filters: IncidentListFilters,
  ): Promise<IncidentListResult>;
  getIncident(
    organizationSlug: string,
    incidentId: string,
  ): Promise<IncidentDetailRecord>;
  createIncident(
    organizationSlug: string,
    input: CreateIncidentInput,
    actorUserId: string,
  ): Promise<IncidentDetailRecord>;
  updateIncident(
    organizationSlug: string,
    incidentId: string,
    input: UpdateIncidentInput,
    actorUserId: string,
  ): Promise<IncidentDetailRecord>;
}

export const statusLabels: Record<IncidentStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

export const priorityLabels: Record<IncidentPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
