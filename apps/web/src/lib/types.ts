export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IncidentPriority = "low" | "medium" | "high" | "critical";

export type Team = { id: string; name: string; slug: string };

export type IncidentSummary = {
  id: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  team: Team | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentActivity = {
  id: string;
  type: "created" | "status_changed" | "team_assigned";
  message: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

export type IncidentDetail = IncidentSummary & {
  activity: IncidentActivity[];
};
