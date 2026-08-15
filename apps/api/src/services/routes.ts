import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodError } from "zod";

import type { ServiceRepository } from "./repository.js";
import {
  createServiceEnvironmentSchema,
  createServiceSchema,
  serviceEnvironmentIdParamsSchema,
  serviceIdParamsSchema,
  updateServiceEnvironmentSchema,
  updateServiceSchema,
} from "./schemas.js";

type ServiceRouteOptions = {
  repository: ServiceRepository;
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

export async function registerServiceRoutes(
  app: FastifyInstance,
  options: ServiceRouteOptions,
) {
  const { repository, organizationSlug } = options;

  app.get("/v1/services", async () => ({
    services: await repository.listServices(organizationSlug),
  }));

  app.post("/v1/services", async (request, reply) => {
    const body = createServiceSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const service = await repository.createService(organizationSlug, body.data);
    return reply.code(201).send({ service });
  });

  app.get("/v1/services/:serviceId", async (request, reply) => {
    const params = serviceIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    return {
      service: await repository.getService(organizationSlug, params.data.serviceId),
    };
  });

  app.patch("/v1/services/:serviceId", async (request, reply) => {
    const params = serviceIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    const body = updateServiceSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    return {
      service: await repository.updateService(
        organizationSlug,
        params.data.serviceId,
        body.data,
      ),
    };
  });

  app.post("/v1/services/:serviceId/environments", async (request, reply) => {
    const params = serviceIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    const body = createServiceEnvironmentSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const environment = await repository.createEnvironment(
      organizationSlug,
      params.data.serviceId,
      body.data,
    );
    return reply.code(201).send({ environment });
  });

  app.patch(
    "/v1/services/:serviceId/environments/:environmentId",
    async (request, reply) => {
      const params = serviceEnvironmentIdParamsSchema.safeParse(request.params);
      if (!params.success) return sendValidationError(reply, params.error);
      const body = updateServiceEnvironmentSchema.safeParse(request.body);
      if (!body.success) return sendValidationError(reply, body.error);
      return {
        environment: await repository.updateEnvironment(
          organizationSlug,
          params.data.serviceId,
          params.data.environmentId,
          body.data,
        ),
      };
    },
  );
}
