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
import { sendApiError } from "./http/responses.js";
import {
  ResourceConflictError,
  ResourceNotFoundError,
  type IncidentRepository,
} from "./incidents/repository.js";
import { registerIncidentRoutes } from "./incidents/routes.js";
import {
  NoopRealtimePublisher,
  NoopRealtimeSessionRevoker,
  type RealtimePublisher,
  type RealtimeSessionRevoker,
} from "./realtime/publisher.js";
import type { ServiceRepository } from "./services/repository.js";
import { registerServiceRoutes } from "./services/routes.js";

type BuildAppOptions = {
  incidentRepository?: IncidentRepository;
  serviceRepository?: ServiceRepository;
  authService?: AuthService;
  realtimePublisher?: RealtimePublisher;
  realtimeSessionRevoker?: RealtimeSessionRevoker;
  testAuthContext?: AuthContext;
  logger?: boolean;
  webOrigin?: string;
  readinessCheck?: () => Promise<void>;
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
    reply.header("x-request-id", String(request.id));
    if (request.url.split("?", 1)[0]!.startsWith("/v1/")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "incidentflow-api",
  }));

  app.get("/ready", async (request, reply) => {
    try {
      await options.readinessCheck?.();
      return { status: "ready", service: "incidentflow-api" };
    } catch (error) {
      const dependencyErrorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "dependency_unavailable";
      request.log.warn({
        event: "readiness_check_failed",
        dependency: "postgresql",
        errorCode: dependencyErrorCode,
      });
      return reply.status(503).send({
        status: "not_ready",
        service: "incidentflow-api",
      });
    }
  });

  app.decorateRequest("auth");
  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?", 1)[0]!;
    const isPublic =
      path === "/health" ||
      path === "/ready" ||
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
    void app.register(registerAuthRoutes, {
      authService: options.authService,
      realtimeSessionRevoker:
        options.realtimeSessionRevoker ?? new NoopRealtimeSessionRevoker(),
    });
  }

  if (options.incidentRepository) {
    void app.register(registerIncidentRoutes, {
      repository: options.incidentRepository,
      realtimePublisher: options.realtimePublisher ?? new NoopRealtimePublisher(),
    });
  }

  if (options.serviceRepository) {
    void app.register(registerServiceRoutes, {
      repository: options.serviceRepository,
    });
  }

  app.setNotFoundHandler((request, reply) =>
    sendApiError(reply, 404, "not_found", `${request.method} ${request.url} was not found`),
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthenticationError) {
      return sendApiError(reply, 401, "authentication_required", error.message);
    }

    if (error instanceof AuthorizationError) {
      return sendApiError(reply, 403, "permission_denied", error.message);
    }

    if (error instanceof LoginRateLimitError) {
      reply.header("retry-after", String(error.retryAfterSeconds));
      return sendApiError(reply, 429, "rate_limited", error.message);
    }
    if (error instanceof ResourceNotFoundError) {
      return sendApiError(reply, 404, "not_found", error.message);
    }

    if (error instanceof ResourceConflictError) {
      return sendApiError(reply, 409, "conflict", error.message);
    }

    if ((error as { statusCode?: number }).statusCode === 400) {
      return sendApiError(reply, 400, "invalid_request", "Request body is invalid");
    }

    app.log.error(error);
    return sendApiError(reply, 500, "internal_error", "Internal server error");
  });

  return app;
}
