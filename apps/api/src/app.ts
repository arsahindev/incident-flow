import cors from "@fastify/cors";
import Fastify from "fastify";

import {
  AuthenticationError,
  AuthorizationError,
  LoginRateLimitError,
} from "./auth/errors.js";
import { extractSessionToken } from "./auth/request.js";
import { registerAuthRoutes } from "./auth/routes.js";
import type { AuthService } from "./auth/service.js";
import type { AuthContext } from "./auth/types.js";
import {
  ResourceConflictError,
  ResourceNotFoundError,
  type IncidentRepository,
} from "./incidents/repository.js";
import { registerIncidentRoutes } from "./incidents/routes.js";
import type { ServiceRepository } from "./services/repository.js";
import { registerServiceRoutes } from "./services/routes.js";

type BuildAppOptions = {
  incidentRepository?: IncidentRepository;
  serviceRepository?: ServiceRepository;
  authService?: AuthService;
  testAuthContext?: AuthContext;
  logger?: boolean;
  webOrigin?: string;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });

  if (
    (options.incidentRepository || options.serviceRepository) &&
    !options.authService &&
    !options.testAuthContext
  ) {
    throw new Error("Protected repositories require an authentication service");
  }

  void app.register(cors, {
    origin: options.webOrigin ?? "http://localhost:3000",
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.split("?", 1)[0]!.startsWith("/v1/")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "incidentflow-api",
  }));

  app.decorateRequest("auth");
  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?", 1)[0]!;
    const isPublic =
      path === "/health" ||
      (request.method === "POST" && path === "/v1/auth/login") ||
      (request.method === "GET" && /^\/v1\/invitations\/[^/]+$/.test(path)) ||
      (request.method === "POST" && /^\/v1\/invitations\/[^/]+\/accept$/.test(path));
    if (isPublic) return;

    if (options.testAuthContext) {
      request.auth = options.testAuthContext;
      return;
    }
    if (!options.authService) throw new AuthenticationError();
    request.auth = await options.authService.authenticateToken(extractSessionToken(request));
  });

  if (options.authService) {
    void app.register(registerAuthRoutes, { authService: options.authService });
  }

  if (options.incidentRepository) {
    void app.register(registerIncidentRoutes, {
      repository: options.incidentRepository,
    });
  }

  if (options.serviceRepository) {
    void app.register(registerServiceRoutes, {
      repository: options.serviceRepository,
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthenticationError) {
      return reply.code(401).send({ error: error.message });
    }

    if (error instanceof AuthorizationError) {
      return reply.code(403).send({ error: error.message });
    }

    if (error instanceof LoginRateLimitError) {
      return reply
        .code(429)
        .header("retry-after", String(error.retryAfterSeconds))
        .send({ error: error.message });
    }
    if (error instanceof ResourceNotFoundError) {
      return reply.code(404).send({ error: error.message });
    }

    if (error instanceof ResourceConflictError) {
      return reply.code(409).send({ error: error.message });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
