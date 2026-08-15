import type {
  CreateIncidentInput,
  IncidentDetailRecord,
  IncidentPriority,
  IncidentStatus,
  IncidentSummaryRecord,
  TeamRecord,
  UpdateIncidentInput,
} from "./types.js";

export class ResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found`);
    this.name = "ResourceNotFoundError";
  }
}

export interface IncidentRepository {
  listTeams(organizationSlug: string): Promise<TeamRecord[]>;
  listIncidents(organizationSlug: string): Promise<IncidentSummaryRecord[]>;
  getIncident(
    organizationSlug: string,
    incidentId: string,
  ): Promise<IncidentDetailRecord>;
  createIncident(
    organizationSlug: string,
    input: CreateIncidentInput,
  ): Promise<IncidentDetailRecord>;
  updateIncident(
    organizationSlug: string,
    incidentId: string,
    input: UpdateIncidentInput,
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
