import { z } from "zod";

import { teamSummarySchema } from "./identity.js";
import { serviceTypeSchema, serviceStatusSchema } from "./services.js";

export const incidentStatuses = ["open", "acknowledged", "resolved"] as const;
export const incidentStatusSchema = z.enum(incidentStatuses);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const incidentPriorities = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export const incidentPrioritySchema = z.enum(incidentPriorities);
export type IncidentPriority = z.infer<typeof incidentPrioritySchema>;

export const incidentTiers = ["low", "medium", "high", "critical"] as const;
export const incidentTierSchema = z.enum(incidentTiers);
export type IncidentTier = z.infer<typeof incidentTierSchema>;

export const affectedServiceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  type: serviceTypeSchema,
  tier: incidentTierSchema,
  status: serviceStatusSchema,
  isPrimary: z.boolean(),
});
export type AffectedService = z.infer<typeof affectedServiceSchema>;

export const indidentActivityTypes = [
  "created",
  "status_changed",
  "team_assigned",
  "affected_services_changed",
] as const;
export const incidentActivityTypeSchema = z.enum(indidentActivityTypes);
export type IncidentActivityType = z.infer<typeof incidentActivityTypeSchema>;

export const incidentActivitySchema = z.object({
  id: z.uuid(),
  type: incidentActivityTypeSchema,
  message: z.string().min(1),
  fromValue: z.string().nullable(),
  toValue: z.string().nullable(),
  actor: z
    .object({
      id: z.uuid(),
      displayName: z.string().min(1),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
});
export type IncidentActivity = z.infer<typeof incidentActivitySchema>;

export const incidentSummarySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: incidentStatusSchema,
  priority: incidentPrioritySchema,
  team: teamSummarySchema.nullable(),
  affectedServices: z.array(affectedServiceSchema),
  version: z.number().int().positive(),
  resolvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type IncidentSummary = z.infer<typeof incidentSummarySchema>;

export const incidentDetailSchema = incidentSummarySchema.extend({
  activity: z.array(incidentActivitySchema),
});
export type IncidentDetail = z.infer<typeof incidentDetailSchema>;

export const incidentPaginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});
export type IncidentPagination = z.infer<typeof incidentPaginationSchema>;

export const incidentsResponseSchema = z.object({
  incidents: z.array(incidentSummarySchema),
  pagination: incidentPaginationSchema,
});

export const incidentResponseSchema = z.object({
  incident: incidentDetailSchema,
});
