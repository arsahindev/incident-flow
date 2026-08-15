export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IncidentPriority = "low" | "medium" | "high" | "critical";

export type Team = { id: string; name: string; slug: string };

export type ServiceEnvironment = {
  id: string;
  name: string;
  slug: string;
  kind: "development" | "test" | "staging" | "production" | "preview" | "other";
  isEphemeral: boolean;
  expiresAt: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "application" | "api" | "platform" | "infrastructure" | "business" | "external";
  tier: "critical" | "high" | "medium" | "low";
  status: "operational" | "degraded" | "disrupted" | "maintenance";
  ownerTeam: Team | null;
  environments: ServiceEnvironment[];
  incidentCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceDetail = Service & {
  recentIncidents: Array<{
    id: string;
    title: string;
    status: IncidentStatus;
    priority: IncidentPriority;
    isPrimary: boolean;
    createdAt: string;
  }>;
};

export type AffectedService = Pick<
  Service,
  "id" | "name" | "slug" | "type" | "tier" | "status"
> & { isPrimary: boolean };

export type IncidentSummary = {
  id: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  team: Team | null;
  affectedServices: AffectedService[];
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentActivity = {
  id: string;
  type:
    | "created"
    | "status_changed"
    | "team_assigned"
    | "affected_services_changed";
  message: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

export type IncidentDetail = IncidentSummary & {
  activity: IncidentActivity[];
};

export type IncidentPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
