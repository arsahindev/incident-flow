import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodError } from "zod";

import type { IncidentRepository } from "./repository.js";
import {
  createIncidentSchema,
  incidentIdParamsSchema,
  updateIncidentSchema,
} from "./schemas.js";

type IncidentRouteOptions = {
  repository: IncidentRepository;
  organizationSlug: string;
};

function sendValidationError(reply: FastifyReply, error: ZodError) {
  return reply.code(400).send({
    error: "Validation failed",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function registerIncidentRoutes(
  app: FastifyInstance,
  options: IncidentRouteOptions,
) {
  const { repository, organizationSlug } = options;

  app.get("/v1/teams", async () => ({
    teams: await repository.listTeams(organizationSlug),
  }));

  app.get("/v1/incidents", async () => ({
    incidents: await repository.listIncidents(organizationSlug),
  }));

  app.post("/v1/incidents", async (request, reply) => {
    const parsed = createIncidentSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const incident = await repository.createIncident(organizationSlug, parsed.data);
    return reply.code(201).send({ incident });
  });

  app.get("/v1/incidents/:incidentId", async (request, reply) => {
    const params = incidentIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);

    return {
      incident: await repository.getIncident(
        organizationSlug,
        params.data.incidentId,
      ),
    };
  });

  app.patch("/v1/incidents/:incidentId", async (request, reply) => {
    const params = incidentIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);

    const body = updateIncidentSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);

    return {
      incident: await repository.updateIncident(
        organizationSlug,
        params.data.incidentId,
        body.data,
      ),
    };
  });
}
