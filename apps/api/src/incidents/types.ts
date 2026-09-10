export const incidentStatuses = ["open", "acknowledged", "resolved"] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const incidentPriorities = ["low", "medium", "high", "critical"] as const;
export type IncidentPriority = (typeof incidentPriorities)[number];

export type TeamRecord = {
  id: string;
  name: string;
  slug: string;
};

export type AffectedServiceRecord = {
  id: string;
  name: string;
  slug: string;
  type: "application" | "api" | "platform" | "infrastructure" | "business" | "external";
  tier: "critical" | "high" | "medium" | "low";
  status: "operational" | "degraded" | "disrupted" | "maintenance";
  isPrimary: boolean;
};

export type IncidentActivityRecord = {
  id: string;
  type:
    | "created"
    | "status_changed"
    | "team_assigned"
    | "affected_services_changed";
  message: string;
  fromValue: string | null;
  toValue: string | null;
  actor: { id: string; displayName: string } | null;
  createdAt: string;
};

export type IncidentSummaryRecord = {
  id: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  team: TeamRecord | null;
  affectedServices: AffectedServiceRecord[];
  version: number;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentDetailRecord = IncidentSummaryRecord & {
  activity: IncidentActivityRecord[];
};

export type CreateIncidentInput = {
  title: string;
  description?: string | null;
  priority: IncidentPriority;
  teamId?: string | null;
  serviceIds: string[];
  primaryServiceId?: string | null;
};

export type UpdateIncidentInput = {
  status?: IncidentStatus;
  teamId?: string | null;
  serviceIds?: string[];
  primaryServiceId?: string | null;
};

export type IncidentListFilters = {
  serviceId?: string;
  teamId?: string;
  status?: IncidentStatus;
  priority?: IncidentPriority;
  page: number;
  pageSize: number;
};

export type IncidentListResult = {
  incidents: IncidentSummaryRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export const incidentMutationChanges = [
  "created",
  "status",
  "assignment",
  "affected_services",
  "activity",
] as const;
export type IncidentMutationChange = (typeof incidentMutationChanges)[number];

export type IncidentMutationResult = {
  incident: IncidentDetailRecord;
  changes: IncidentMutationChange[];
};
