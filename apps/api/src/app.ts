import cors from "@fastify/cors";
import Fastify from "fastify";

import {
  ResourceNotFoundError,
  type IncidentRepository,
} from "./incidents/repository.js";
import { registerIncidentRoutes } from "./incidents/routes.js";

type BuildAppOptions = {
  incidentRepository?: IncidentRepository;
  organizationSlug?: string;
  logger?: boolean;
  webOrigin?: string;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });

  void app.register(cors, {
    origin: options.webOrigin ?? "http://localhost:3000",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "incidentflow-api",
  }));

  if (options.incidentRepository) {
    void app.register(registerIncidentRoutes, {
      repository: options.incidentRepository,
      organizationSlug: options.organizationSlug ?? "incidentflow-dev",
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ResourceNotFoundError) {
      return reply.code(404).send({ error: error.message });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
