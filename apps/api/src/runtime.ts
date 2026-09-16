import type { loadConfig } from "./config.js";
import { createApplicationRuntime } from "./application-runtime.js";
import { PrismaRealtimeRoomAuthorizer } from "./realtime/room-authorizer.js";
import { SocketIoRealtimeAdapter } from "./realtime/socket-io-adapter.js";
import { AblyRealtimeAdapter } from "./realtime/ably-adapter.js";

export function createRuntime(config: ReturnType<typeof loadConfig>) {
  return createApplicationRuntime(config, ({ prisma, authService }) =>
    config.REALTIME_TRANSPORT === "ably"
      ? new AblyRealtimeAdapter({
          apiKey: config.ABLY_API_KEY!,
          maxOutboundPayloadBytes: config.REALTIME_MAX_OUTBOUND_BYTES,
        })
      : new SocketIoRealtimeAdapter({
          authService,
          roomAuthorizer: new PrismaRealtimeRoomAuthorizer(prisma),
          webOrigin: config.WEB_ORIGIN,
          maxInboundPayloadBytes: config.REALTIME_MAX_INBOUND_BYTES,
          maxOutboundPayloadBytes: config.REALTIME_MAX_OUTBOUND_BYTES,
          maxIncidentRoomsPerSocket: config.REALTIME_MAX_INCIDENT_ROOMS,
          maxPendingPackets: config.REALTIME_MAX_PENDING_PACKETS,
          sessionValidationIntervalMs: config.REALTIME_SESSION_REVALIDATE_MS,
        }),
  );
}
