import type {
  AuthContext,
  AffectedService as SharedAffectedService,
  CreatedInvitation as SharedCreatedInvitation,
  IncidentActivity as SharedIncidentActivity,
  IncidentDetail as SharedIncidentDetail,
  IncidentPagination as SharedIncidentPagination,
  IncidentPriority as SharedIncidentPriority,
  IncidentStatus as SharedIncidentStatus,
  IncidentSummary as SharedIncidentSummary,
  Invitation as SharedInvitation,
  OrganizationAccess as SharedOrganizationAccess,
  OrganizationMember as SharedOrganizationMember,
  Permission as SharedPermission,
  SessionResult as SharedSessionResult,
  TeamSummary,
} from "@incidentflow/contracts";

export type IncidentStatus = SharedIncidentStatus;
export type IncidentPriority = SharedIncidentPriority;

export type Team = TeamSummary;
export type Permission = SharedPermission;
export type AuthSession = AuthContext;
export type OrganizationAccess = SharedOrganizationAccess;
export type SessionResult = SharedSessionResult;
export type OrganizationMember = SharedOrganizationMember;
export type Invitation = SharedInvitation;
export type CreatedInvitation = SharedCreatedInvitation;

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

export type AffectedService = SharedAffectedService;
export type IncidentSummary = SharedIncidentSummary;
export type IncidentActivity = SharedIncidentActivity;
export type IncidentDetail = SharedIncidentDetail;
export type IncidentPagination = SharedIncidentPagination;
