import type { Server } from "node:http";
import { buildApp } from "./app.js";
import type { loadConfig } from "./config.js";
import { createPrismaClient } from "./database.js";
import { PrismaAuthService } from "./auth/service.js";
import { PrismaIncidentRepository } from "./incidents/prisma-repository.js";
import { PrismaServiceRepository } from "./services/prisma-repository.js";
import type { RealtimePublisher, RealtimeSessionRevoker } from "./realtime/publisher.js";
import type { RealtimeTokenIssuer } from "./realtime/token-issuer.js";

type RuntimeRealtime = RealtimePublisher & RealtimeSessionRevoker & Partial<RealtimeTokenIssuer> & {
  attach?: (server: Server) => void;
  close?: () => Promise<void>;
};

export function createApplicationRuntime(
  config: ReturnType<typeof loadConfig>,
  createRealtime: (dependencies: {
    prisma: ReturnType<typeof createPrismaClient>;
    authService: PrismaAuthService;
  }) => RuntimeRealtime,
) {
  const prisma = createPrismaClient(config.DATABASE_URL, { vercel: config.VERCEL === "1" });
  const authService = new PrismaAuthService(prisma, config.PASSWORD_PEPPER);
  const realtime = createRealtime({ prisma, authService });
  const app = buildApp({
    authService,
    incidentRepository: new PrismaIncidentRepository(prisma),
    serviceRepository: new PrismaServiceRepository(prisma),
    realtimePublisher: realtime,
    realtimeSessionRevoker: realtime,
    realtimeTokenIssuer: realtime.issueToken
      ? { issueToken: (auth) => realtime.issueToken!(auth) }
      : undefined,
    webOrigin: config.WEB_ORIGIN,
    readinessCheck: async () => { await prisma.$queryRaw`SELECT 1`; },
  });
  realtime.attach?.(app.server);
  app.addHook("preClose", async () => { await realtime.close?.(); });
  app.addHook("onClose", async () => { await prisma.$disconnect(); });
  return app;
}
