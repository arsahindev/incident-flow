import { z } from "zod";

export const organizationRoles = [
  "owner",
  "admin",
  "responder",
  "viewer",
] as const;
export const organizationRoleSchema = z.enum(organizationRoles);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const userStatuses = ["active", "disabled"] as const;
export const userStatusSchema = z.enum(userStatuses);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const membershipStatuses = ["active", "suspended"] as const;
export const membershipStatusSchema = z.enum(membershipStatuses);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const permissions = [
  "incidents.read",
  "incidents.manage",
  "services.read",
  "services.manage",
  "teams.read",
  "members.read",
  "members.manage",
] as const;
export const permissionSchema = z.enum(permissions);
export type Permission = z.infer<typeof permissionSchema>;

export const teamSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type TeamSummary = z.infer<typeof teamSummarySchema>;

export const authContextSchema = z.object({
  sessionId: z.uuid(),
  userId: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  organizationId: z.uuid(),
  organizationSlug: z.string().min(1),
  organizationName: z.string().min(1),
  role: organizationRoleSchema,
  permissions: z.array(permissionSchema),
});
export type AuthContext = z.infer<typeof authContextSchema>;

export const sessionResultSchema = z.object({
  token: z.string().min(32),
  expiresAt: z.iso.datetime(),
  context: authContextSchema,
});
export type SessionResult = z.infer<typeof sessionResultSchema>;

export const authSessionResponseSchema = z.object({
  session: authContextSchema,
});
export const sessionResultResponseSchema = z.object({
  session: sessionResultSchema,
});

export const organizationAccessSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  role: organizationRoleSchema,
});
export type OrganizationAccess = z.infer<typeof organizationAccessSchema>;
export const organizationsResponseSchema = z.object({
  organizations: z.array(organizationAccessSchema),
});

export const organizationMemberSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  userStatus: userStatusSchema,
  role: organizationRoleSchema,
  membershipStatus: membershipStatusSchema,
  teams: z.array(teamSummarySchema),
  createdAt: z.iso.datetime(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export const membersResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
});
export const memberResponseSchema = z.object({
  member: organizationMemberSchema,
});

export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: organizationRoleSchema,
  organizationName: z.string().min(1),
  organizationSlug: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
export type Invitation = z.infer<typeof invitationSchema>;
export const createdInvitationSchema = invitationSchema.extend({
  token: z.string().min(32),
});
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;
export const invitationResponseSchema = z.object({
  invitation: invitationSchema,
});
export const createdInvitationResponseSchema = z.object({
  invitation: createdInvitationSchema,
});
