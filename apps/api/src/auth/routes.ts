import type { FastifyInstance } from "fastify";

import { sendValidationError } from "../http/responses.js";
import { requirePermission } from "./permissions.js";
import { extractSessionToken } from "./request.js";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationTokenParamsSchema,
  loginSchema,
  memberIdParamsSchema,
  switchOrganizationSchema,
  teamMembershipParamsSchema,
  updateMemberSchema,
} from "./schemas.js";
import type { AuthService } from "./service.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: { authService: AuthService },
) {
  const { authService } = options;

  app.post("/v1/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const session = await authService.login({
      ...body.data,
      clientAddress: request.ip,
    });
    return reply.header("cache-control", "no-store").send({ session });
  });

  app.get("/v1/auth/session", async (request, reply) =>
    reply.header("cache-control", "no-store").send({ session: request.auth }),
  );

  app.get("/v1/auth/organizations", async (request) => ({
    organizations: await authService.listOrganizations(request.auth),
  }));

  app.post("/v1/auth/logout", async (request, reply) => {
    await authService.logout(extractSessionToken(request));
    return reply.code(204).send();
  });

  app.post("/v1/auth/switch-organization", async (request, reply) => {
    const body = switchOrganizationSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const session = await authService.switchOrganization(
      extractSessionToken(request),
      body.data.organizationSlug,
    );
    return reply.header("cache-control", "no-store").send({ session });
  });

  app.get("/v1/members", async (request) => {
    requirePermission(request.auth, "members.read");
    return { members: await authService.listMembers(request.auth) };
  });

  app.post("/v1/invitations", async (request, reply) => {
    requirePermission(request.auth, "members.manage");
    const body = createInvitationSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const invitation = await authService.createInvitation(request.auth, body.data);
    return reply.code(201).header("cache-control", "no-store").send({ invitation });
  });

  app.get("/v1/invitations/:token", async (request, reply) => {
    const params = invitationTokenParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    const invitation = await authService.getInvitation(params.data.token);
    return reply.header("cache-control", "no-store").send({ invitation });
  });

  app.post("/v1/invitations/:token/accept", async (request, reply) => {
    const params = invitationTokenParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    const body = acceptInvitationSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const session = await authService.acceptInvitation(params.data.token, body.data);
    return reply.header("cache-control", "no-store").send({ session });
  });

  app.patch("/v1/members/:userId", async (request, reply) => {
    requirePermission(request.auth, "members.manage");
    const params = memberIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    const body = updateMemberSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    return {
      member: await authService.updateMember(request.auth, params.data.userId, body.data),
    };
  });

  app.put("/v1/teams/:teamId/members/:userId", async (request, reply) => {
    requirePermission(request.auth, "members.manage");
    const params = teamMembershipParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    await authService.addTeamMember(request.auth, params.data.teamId, params.data.userId);
    return reply.code(204).send();
  });

  app.delete("/v1/teams/:teamId/members/:userId", async (request, reply) => {
    requirePermission(request.auth, "members.manage");
    const params = teamMembershipParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    await authService.removeTeamMember(request.auth, params.data.teamId, params.data.userId);
    return reply.code(204).send();
  });
}
