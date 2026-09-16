import { z } from "zod";

import { incidentPriorities, incidentStatuses } from "./types.js";

export const incidentIdParamsSchema = z.object({
  incidentId: z.string().uuid(),
});

export const createIncidentSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(5_000).nullable().optional(),
    priority: z.enum(incidentPriorities).default("medium"),
    teamId: z.string().uuid().nullable().optional(),
    serviceIds: z.array(z.uuid()).min(1).max(20),
    primaryServiceId: z.uuid().nullable().optional(),
  })
  .refine(
    (input) =>
      !input.primaryServiceId ||
      input.serviceIds.includes(input.primaryServiceId),
    {
      path: ["primaryServiceId"],
      message: "Primary service must be included in affected services",
    },
  )
  .refine(
    (input) => new Set(input.serviceIds).size === input.serviceIds.length,
    {
      path: ["serviceIds"],
      message: "Affected services must be unique",
    },
  );

export const listIncidentsQuerySchema = z.object({
  serviceId: z.uuid().optional(),
  teamId: z.uuid().optional(),
  status: z.enum(incidentStatuses).optional(),
  priority: z.enum(incidentPriorities).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export const updateIncidentSchema = z
  .object({
    status: z.enum(incidentStatuses).optional(),
    teamId: z.string().uuid().nullable().optional(),
    serviceIds: z.array(z.uuid()).min(1).max(20).optional(),
    primaryServiceId: z.uuid().nullable().optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "At least one field must be provided",
    },
  )
  .refine(
    (input) =>
      input.primaryServiceId === undefined ||
      input.primaryServiceId === null ||
      (input.serviceIds !== undefined &&
        input.serviceIds.includes(input.primaryServiceId)),
    {
      path: ["primaryServiceId"],
      message: "Primary service must be included in affected services",
    },
  )
  .refine(
    (input) =>
      input.serviceIds === undefined ||
      new Set(input.serviceIds).size === input.serviceIds.length,
    {
      path: ["serviceIds"],
      message: "Affected services must be unique",
    },
  );
