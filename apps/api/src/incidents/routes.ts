import type { FastifyInstance } from "fastify";

import { requirePermission } from "../auth/permissions.js";
import { sendValidationError } from "../http/responses.js";
import type { RealtimePublisher } from "../realtime/publisher.js";
import type { IncidentRepository } from "./repository.js";
import {
  createIncidentSchema,
  incidentIdParamsSchema,
  listIncidentsQuerySchema,
  updateIncidentSchema,
} from "./schemas.js";
import { IncidentApplicationService } from "./service.js";

type IncidentRouteOptions = {
  repository: IncidentRepository;
  realtimePublisher: RealtimePublisher;
};

export async function registerIncidentRoutes(
  app: FastifyInstance,
  options: IncidentRouteOptions,
) {
  const { repository } = options;
  const incidentService = new IncidentApplicationService(
    repository,
    options.realtimePublisher,
    (error) => app.log.error({ err: error }, "Realtime incident publication failed"),
  );

  app.get("/v1/teams", async (request) => {
    requirePermission(request.auth, "teams.read");
    return { teams: await repository.listTeams(request.auth.organizationSlug) };
  });

  app.get("/v1/incidents", async (request, reply) => {
    requirePermission(request.auth, "incidents.read");
    const query = listIncidentsQuerySchema.safeParse(request.query);
    if (!query.success) return sendValidationError(reply, query.error);
    return repository.listIncidents(request.auth.organizationSlug, query.data);
  });

  app.post("/v1/incidents", async (request, reply) => {
    requirePermission(request.auth, "incidents.manage");
    const parsed = createIncidentSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const incident = await incidentService.createIncident(request.auth, parsed.data);
    return reply.code(201).send({ incident });
  });

  app.get("/v1/incidents/:incidentId", async (request, reply) => {
    requirePermission(request.auth, "incidents.read");
    const params = incidentIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);

    return {
      incident: await repository.getIncident(
        request.auth.organizationSlug,
        params.data.incidentId,
      ),
    };
  });

  app.patch("/v1/incidents/:incidentId", async (request, reply) => {
    requirePermission(request.auth, "incidents.manage");
    const params = incidentIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);

    const body = updateIncidentSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);

    return {
      incident: await incidentService.updateIncident(
        request.auth,
        params.data.incidentId,
        body.data,
      ),
    };
  });
}
