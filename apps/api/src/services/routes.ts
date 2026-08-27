import type { FastifyInstance } from "fastify";

import { requirePermission } from "../auth/permissions.js";
import { sendValidationError } from "../http/responses.js";
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
};

export async function registerServiceRoutes(
  app: FastifyInstance,
  options: ServiceRouteOptions,
) {
  const { repository } = options;

  app.get("/v1/services", async (request) => {
    requirePermission(request.auth, "services.read");
    return { services: await repository.listServices(request.auth.organizationSlug) };
  });

  app.post("/v1/services", async (request, reply) => {
    requirePermission(request.auth, "services.manage");
    const body = createServiceSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const service = await repository.createService(
      request.auth.organizationSlug,
      body.data,
      request.auth.userId,
    );
    return reply.code(201).send({ service });
  });

  app.get("/v1/services/:serviceId", async (request, reply) => {
    requirePermission(request.auth, "services.read");
    const params = serviceIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    return {
      service: await repository.getService(
        request.auth.organizationSlug,
        params.data.serviceId,
      ),
    };
  });

  app.patch("/v1/services/:serviceId", async (request, reply) => {
    requirePermission(request.auth, "services.manage");
    const params = serviceIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    const body = updateServiceSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    return {
      service: await repository.updateService(
        request.auth.organizationSlug,
        params.data.serviceId,
        body.data,
        request.auth.userId,
      ),
    };
  });

  app.post("/v1/services/:serviceId/environments", async (request, reply) => {
    requirePermission(request.auth, "services.manage");
    const params = serviceIdParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error);
    const body = createServiceEnvironmentSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error);
    const environment = await repository.createEnvironment(
      request.auth.organizationSlug,
      params.data.serviceId,
      body.data,
      request.auth.userId,
    );
    return reply.code(201).send({ environment });
  });

  app.patch(
    "/v1/services/:serviceId/environments/:environmentId",
    async (request, reply) => {
      requirePermission(request.auth, "services.manage");
      const params = serviceEnvironmentIdParamsSchema.safeParse(request.params);
      if (!params.success) return sendValidationError(reply, params.error);
      const body = updateServiceEnvironmentSchema.safeParse(request.body);
      if (!body.success) return sendValidationError(reply, body.error);
      return {
        environment: await repository.updateEnvironment(
          request.auth.organizationSlug,
          params.data.serviceId,
          params.data.environmentId,
          body.data,
          request.auth.userId,
        ),
      };
    },
  );
}
