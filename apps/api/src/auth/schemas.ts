import { z } from "zod";

import { membershipStatuses, organizationRoles } from "./types.js";

const passwordSchema = z
  .string()
  .min(12)
  .max(200)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(200),
  organizationSlug: z.string().trim().min(2).max(100).optional(),
});

export const switchOrganizationSchema = z.object({
  organizationSlug: z.string().trim().min(2).max(100),
});

export const invitationTokenParamsSchema = z.object({
  token: z.string().min(32).max(200),
});

export const createInvitationSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(organizationRoles).refine((role) => role !== "owner", {
    message: "Owner access must be granted through an audited role change",
  }),
});

export const acceptInvitationSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  password: passwordSchema,
});

export const memberIdParamsSchema = z.object({ userId: z.uuid() });

export const updateMemberSchema = z
  .object({
    role: z.enum(organizationRoles).optional(),
    status: z.enum(membershipStatuses).optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    {
      message: "At least one field must be provided",
    },
  );

export const teamMembershipParamsSchema = z.object({
  teamId: z.uuid(),
  userId: z.uuid(),
});
