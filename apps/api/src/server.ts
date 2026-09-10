import { buildApp } from "./app.js";
import {
  ConfigurationError,
  configurationFailureLog,
  loadConfig,
} from "./config.js";
import { createPrismaClient } from "./database.js";

import { PrismaAuthService } from "./auth/service.js";
import { PrismaIncidentRepository } from "./incidents/prisma-repository.js";
import { PrismaServiceRepository } from "./services/prisma-repository.js";

import { PrismaRealtimeRoomAuthorizer } from "./realtime/room-authorizer.js";
import { SocketIoRealtimeAdapter } from "./realtime/socket-io-adapter.js";

async function startServer() {
  const config = loadConfig(process.env);
  const prisma = createPrismaClient(config.DATABASE_URL);
  const authService = new PrismaAuthService(prisma, config.PASSWORD_PEPPER);
  const realtime = new SocketIoRealtimeAdapter({
    authService,
    roomAuthorizer: new PrismaRealtimeRoomAuthorizer(prisma),
    webOrigin: config.WEB_ORIGIN,
    maxInboundPayloadBytes: config.REALTIME_MAX_INBOUND_BYTES,
    maxOutboundPayloadBytes: config.REALTIME_MAX_OUTBOUND_BYTES,
    maxIncidentRoomsPerSocket: config.REALTIME_MAX_INCIDENT_ROOMS,
    maxPendingPackets: config.REALTIME_MAX_PENDING_PACKETS,
    sessionValidationIntervalMs: config.REALTIME_SESSION_REVALIDATE_MS,
  });
  const app = buildApp({
    authService,
    incidentRepository: new PrismaIncidentRepository(prisma),
    serviceRepository: new PrismaServiceRepository(prisma),
    realtimePublisher: realtime,
    realtimeSessionRevoker: realtime,
    webOrigin: config.WEB_ORIGIN,
    readinessCheck: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  });

  realtime.attach(app.server);

  app.addHook("preClose", async () => {
    await realtime.close();
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
}

try {
  await startServer();
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(JSON.stringify(configurationFailureLog(error)));
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
