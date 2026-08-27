export const organizationRoles = ["owner", "admin", "responder", "viewer"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const membershipStatuses = ["active", "suspended"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const permissions = [
  "incidents.read",
  "incidents.manage",
  "services.read",
  "services.manage",
  "teams.read",
  "members.read",
  "members.manage",
] as const;
export type Permission = (typeof permissions)[number];

export type AuthContext = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: OrganizationRole;
  permissions: Permission[];
};

export type SessionResult = {
  token: string;
  expiresAt: string;
  context: AuthContext;
};

export type OrganizationAccess = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

export type MemberRecord = {
  userId: string;
  email: string;
  displayName: string;
  userStatus: "active" | "disabled";
  role: OrganizationRole;
  membershipStatus: MembershipStatus;
  teams: Array<{ id: string; name: string; slug: string }>;
  createdAt: string;
};

export type InvitationRecord = {
  id: string;
  email: string;
  role: OrganizationRole;
  organizationName: string;
  organizationSlug: string;
  expiresAt: string;
};

export type CreatedInvitation = InvitationRecord & { token: string };
