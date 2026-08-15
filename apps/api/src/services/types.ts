import type { IncidentPriority, IncidentStatus, TeamRecord } from "../incidents/types.js";

export const serviceTypes = [
  "application",
  "api",
  "platform",
  "infrastructure",
  "business",
  "external",
] as const;
export type ServiceType = (typeof serviceTypes)[number];

export const serviceTiers = ["critical", "high", "medium", "low"] as const;
export type ServiceTier = (typeof serviceTiers)[number];

export const serviceStatuses = [
  "operational",
  "degraded",
  "disrupted",
  "maintenance",
] as const;
export type ServiceStatus = (typeof serviceStatuses)[number];

export const serviceEnvironmentKinds = [
  "development",
  "test",
  "staging",
  "production",
  "preview",
  "other",
] as const;
export type ServiceEnvironmentKind = (typeof serviceEnvironmentKinds)[number];

export type ServiceEnvironmentStatus = "active" | "archived";

export type ServiceEnvironmentRecord = {
  id: string;
  name: string;
  slug: string;
  kind: ServiceEnvironmentKind;
  isEphemeral: boolean;
  expiresAt: string | null;
  status: ServiceEnvironmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: ServiceType;
  tier: ServiceTier;
  status: ServiceStatus;
  ownerTeam: TeamRecord | null;
  environments: ServiceEnvironmentRecord[];
  incidentCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceIncidentRecord = {
  id: string;
  title: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  isPrimary: boolean;
  createdAt: string;
};

export type ServiceDetailRecord = ServiceRecord & {
  recentIncidents: ServiceIncidentRecord[];
};

export type CreateServiceEnvironmentInput = {
  name: string;
  slug: string;
  kind: ServiceEnvironmentKind;
  isEphemeral: boolean;
  expiresAt?: string | null;
};

export type CreateServiceInput = {
  name: string;
  slug: string;
  description?: string | null;
  type: ServiceType;
  tier: ServiceTier;
  ownerTeamId?: string | null;
  environments: CreateServiceEnvironmentInput[];
};

export type UpdateServiceInput = Partial<
  Pick<CreateServiceInput, "name" | "slug" | "description" | "type" | "tier" | "ownerTeamId">
> & {
  status?: ServiceStatus;
  archived?: boolean;
};

export type UpdateServiceEnvironmentInput = Partial<CreateServiceEnvironmentInput> & {
  status?: ServiceEnvironmentStatus;
};
