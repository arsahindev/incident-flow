import { z } from "zod";

import {
  serviceEnvironmentKinds,
  serviceStatuses,
  serviceTiers,
  serviceTypes,
} from "./types.js";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens",
  );

const nullableUuid = z.uuid().nullable().optional();

export const serviceIdParamsSchema = z.object({ serviceId: z.uuid() });
export const serviceEnvironmentIdParamsSchema = serviceIdParamsSchema.extend({
  environmentId: z.uuid(),
});

export const createServiceEnvironmentSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: slugSchema,
    kind: z.enum(serviceEnvironmentKinds),
    isEphemeral: z.boolean().default(false),
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .refine((input) => input.isEphemeral || !input.expiresAt, {
    path: ["expiresAt"],
    message: "Only ephemeral environments may have an expiry time",
  });

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  description: z.string().trim().max(2_000).nullable().optional(),
  type: z.enum(serviceTypes),
  tier: z.enum(serviceTiers).default("medium"),
  ownerTeamId: nullableUuid,
  environments: z.array(createServiceEnvironmentSchema).min(1).max(20),
});

export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    type: z.enum(serviceTypes).optional(),
    tier: z.enum(serviceTiers).optional(),
    status: z.enum(serviceStatuses).optional(),
    ownerTeamId: nullableUuid,
    archived: z.boolean().optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "At least one field must be provided",
    },
  );

export const updateServiceEnvironmentSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: slugSchema.optional(),
    kind: z.enum(serviceEnvironmentKinds).optional(),
    isEphemeral: z.boolean().optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "At least one field must be provided",
    },
  )
  .refine((input) => input.isEphemeral !== false || !input.expiresAt, {
    path: ["expiresAt"],
    message: "Only ephemeral environments may have an expiry time",
  });
