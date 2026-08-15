export const incidentStatuses = ["open", "acknowledged", "resolved"] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const incidentPriorities = ["low", "medium", "high", "critical"] as const;
export type IncidentPriority = (typeof incidentPriorities)[number];

export type TeamRecord = {
  id: string;
  name: string;
  slug: string;
};

export type IncidentActivityRecord = {
  id: string;
  type: "created" | "status_changed" | "team_assigned";
  message: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

export type IncidentSummaryRecord = {
  id: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  team: TeamRecord | null;
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
};

export type UpdateIncidentInput = {
  status?: IncidentStatus;
  teamId?: string | null;
};
