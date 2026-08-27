import type { AuthContext, OrganizationRole, Permission } from "./types.js";
import { AuthorizationError } from "./errors.js";

const rolePermissions: Record<OrganizationRole, readonly Permission[]> = {
  owner: [
    "incidents.read",
    "incidents.manage",
    "services.read",
    "services.manage",
    "teams.read",
    "members.read",
    "members.manage",
  ],
  admin: [
    "incidents.read",
    "incidents.manage",
    "services.read",
    "services.manage",
    "teams.read",
    "members.read",
    "members.manage",
  ],
  responder: [
    "incidents.read",
    "incidents.manage",
    "services.read",
    "teams.read",
    "members.read",
  ],
  viewer: ["incidents.read", "services.read", "teams.read", "members.read"],
};

export function permissionsForRole(role: OrganizationRole): Permission[] {
  return [...rolePermissions[role]];
}

export function requirePermission(context: AuthContext, permission: Permission) {
  if (!context.permissions.includes(permission)) {
    throw new AuthorizationError();
  }
}
