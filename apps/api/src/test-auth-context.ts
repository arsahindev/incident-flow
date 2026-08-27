import { permissionsForRole } from "./auth/permissions.js";
import type { AuthContext } from "./auth/types.js";

export const ownerTestAuthContext: AuthContext = {
  sessionId: "77777777-7777-4777-8777-777777777777",
  userId: "88888888-8888-4888-8888-888888888888",
  email: "owner@example.com",
  displayName: "Test Owner",
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationSlug: "incidentflow-dev",
  organizationName: "IncidentFlow Development",
  role: "owner",
  permissions: permissionsForRole("owner"),
};
