import { z } from "zod";

import { incidentPriorities, incidentStatuses } from "./types.js";

export const incidentIdParamsSchema = z.object({
  incidentId: z.string().uuid(),
});

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(5_000).nullable().optional(),
  priority: z.enum(incidentPriorities).default("medium"),
  teamId: z.string().uuid().nullable().optional(),
});

export const updateIncidentSchema = z
  .object({
    status: z.enum(incidentStatuses).optional(),
    teamId: z.string().uuid().nullable().optional(),
  })
  .refine((input) => input.status !== undefined || input.teamId !== undefined, {
    message: "At least one field must be provided",
  });
