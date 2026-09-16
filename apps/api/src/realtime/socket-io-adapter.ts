import type { Server as HttpServer } from "node:http";

import {
  realtimeIncidentSignalSchema,
  realtimeJoinIncidentRequestSchema,
  type AuthContext,
  type RealtimeIncidentSignal,
  type RealtimeJoinIncidentResult,
  type RealtimeSessionRevokedSignal,
} from "@incidentflow/contracts";
import { Server, type Socket } from "socket.io";
import { z } from "zod";

import type { AuthService } from "../auth/service.js";
import type { RealtimeMetrics } from "./metrics.js";
import { NoopRealtimeMetrics } from "./metrics.js";
import type { RealtimePublisher, RealtimeSessionRevoker } from "./publisher.js";
import type { RealtimeRoomAuthorizer } from "./room-authorizer.js";

type JoinIncidentAck = (result: RealtimeJoinIncidentResult) => void;

type ClientToServerEvents = {
  "realtime:join-incident": (
    payload: unknown,
    acknowledge?: JoinIncidentAck,
  ) => void;
  "realtime:leave-incident": (
    payload: unknown,
    acknowledge?: JoinIncidentAck,
  ) => void;
};

type ServerToClientEvents = {
  "realtime:incident": (signal: RealtimeIncidentSignal) => void;
  "realtime:session-revoked": (signal: RealtimeSessionRevokedSignal) => void;
};

type SocketData = {
  auth: AuthContext;
  sessionToken: string;
  consecutiveBackpressureDrops: number;
};

type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

type SocketIoRealtimeAdapterOptions = {
  authService: Pick<AuthService, "authenticateToken">;
  roomAuthorizer: RealtimeRoomAuthorizer;
  webOrigin: string;
  sessionCookieName?: string;
  metrics?: RealtimeMetrics;
  sessionValidationIntervalMs?: number;
  maxInboundPayloadBytes?: number;
  maxOutboundPayloadBytes?: number;
  maxIncidentRoomsPerSocket?: number;
  maxPendingPackets?: number;
  disconnectAfterBackpressureDrops?: number;
};

const uuidSchema = z.uuid();

function organizationRoom(organizationId: string) {
  return `organization:${organizationId}`;
}

function incidentRoom(incidentId: string) {
  return `incident:${incidentId}`;
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

function readCookie(header: string | undefined, cookieName: string) {
  if (!header || header.length > 4_096) return null;
  const matches = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName}=`));
  if (matches.length !== 1) return null;
  const encodedValue = matches[0]!.slice(cookieName.length + 1);
  try {
    const value = decodeURIComponent(encodedValue);
    return value.length >= 32 && value.length <= 256 ? value : null;
  } catch {
    return null;
  }
}

function authenticationError() {
  const error = new Error("Authentication required") as Error & {
    data?: { code: string };
  };
  error.data = { code: "authentication_required" };
  return error;
}

function pendingPacketCount(socket: RealtimeSocket) {
  const connection = socket.conn as unknown as { writeBuffer?: unknown[] };
  return Array.isArray(connection.writeBuffer)
    ? connection.writeBuffer.length
    : 0;
}

export class SocketIoRealtimeAdapter
  implements RealtimePublisher, RealtimeSessionRevoker
{
  private readonly io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >;
  private readonly metrics: RealtimeMetrics;
  private readonly sessionCookieName: string;
  private readonly maxOutboundPayloadBytes: number;
  private readonly maxIncidentRoomsPerSocket: number;
  private readonly maxPendingPackets: number;
  private readonly disconnectAfterBackpressureDrops: number;
  private readonly socketsBySession = new Map<string, Set<string>>();
  private readonly validationTimer: NodeJS.Timeout;

  constructor(private readonly options: SocketIoRealtimeAdapterOptions) {
    this.metrics = options.metrics ?? new NoopRealtimeMetrics();
    this.sessionCookieName =
      options.sessionCookieName ?? "incidentflow_session";
    this.maxOutboundPayloadBytes = options.maxOutboundPayloadBytes ?? 1_024;
    this.maxIncidentRoomsPerSocket = options.maxIncidentRoomsPerSocket ?? 10;
    this.maxPendingPackets = options.maxPendingPackets ?? 20;
    this.disconnectAfterBackpressureDrops =
      options.disconnectAfterBackpressureDrops ?? 3;

    this.io = new Server({
      serveClient: false,
      cors: { origin: options.webOrigin, credentials: true },
      allowRequest: (request, callback) => {
        callback(null, request.headers.origin === options.webOrigin);
      },
      maxHttpBufferSize: options.maxInboundPayloadBytes ?? 4_096,
      perMessageDeflate: false,
    });

    this.io.use(async (socket, next) => {
      const token = readCookie(
        socket.request.headers.cookie,
        this.sessionCookieName,
      );
      if (!token) {
        this.metrics.authenticationRejected();
        next(authenticationError());
        return;
      }
      try {
        const auth = await options.authService.authenticateToken(token);
        socket.data = {
          auth,
          sessionToken: token,
          consecutiveBackpressureDrops: 0,
        };
        next();
      } catch {
        this.metrics.authenticationRejected();
        next(authenticationError());
      }
    });

    this.io.on("connection", (socket) => this.handleConnection(socket));

    this.validationTimer = setInterval(
      () => void this.revalidateConnectedSessions(),
      options.sessionValidationIntervalMs ?? 60_000,
    );
    this.validationTimer.unref();
  }

  attach(server: HttpServer) {
    this.io.attach(server);
  }

  async close() {
    clearInterval(this.validationTimer);
    this.io.disconnectSockets(true);
    this.io.engine.close();
  }

  async publishIncidentSignal(
    organizationId: string,
    incidentId: string,
    signal: RealtimeIncidentSignal,
  ) {
    const parsed = realtimeIncidentSignalSchema.safeParse(signal);
    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(incidentId).success ||
      !parsed.success ||
      parsed.data.incidentId !== incidentId
    ) {
      this.metrics.signalDropped("invalid_payload");
      throw new Error("Realtime publication is invalid");
    }
    if (
      Buffer.byteLength(JSON.stringify(parsed.data), "utf8") >
      this.maxOutboundPayloadBytes
    ) {
      this.metrics.signalDropped("payload_too_large");
      throw new Error("Realtime publication exceeds the payload limit");
    }

    const socketIds = new Set<string>();
    for (const room of [
      organizationRoom(organizationId),
      incidentRoom(incidentId),
    ]) {
      for (const socketId of this.io.sockets.adapter.rooms.get(room) ?? []) {
        socketIds.add(socketId);
      }
    }

    for (const socketId of socketIds) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket || socket.data.auth.organizationId !== organizationId)
        continue;
      if (
        !socket.conn.transport.writable ||
        pendingPacketCount(socket) >= this.maxPendingPackets
      ) {
        this.metrics.signalDropped("backpressure");
        socket.data.consecutiveBackpressureDrops += 1;
        if (
          socket.data.consecutiveBackpressureDrops >=
          this.disconnectAfterBackpressureDrops
        ) {
          this.disconnectSocket(socket);
        }
        continue;
      }
      socket.data.consecutiveBackpressureDrops = 0;
      socket.volatile.emit("realtime:incident", parsed.data);
    }
    this.metrics.signalPublished(parsed.data.type);
  }

  async disconnectSession(sessionId: string) {
    const socketIds = [...(this.socketsBySession.get(sessionId) ?? [])];
    for (const socketId of socketIds) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) this.disconnectSocket(socket);
    }
  }

  async disconnectUser(organizationId: string, userId: string) {
    for (const socket of this.io.sockets.sockets.values()) {
      if (
        socket.data.auth.organizationId === organizationId &&
        socket.data.auth.userId === userId
      ) {
        this.disconnectSocket(socket);
      }
    }
  }

  private handleConnection(socket: RealtimeSocket) {
    const { auth } = socket.data;
    const sessionSockets =
      this.socketsBySession.get(auth.sessionId) ?? new Set();
    sessionSockets.add(socket.id);
    this.socketsBySession.set(auth.sessionId, sessionSockets);

    void socket.join([
      organizationRoom(auth.organizationId),
      userRoom(auth.userId),
    ]);
    this.metrics.connectionOpened();
    this.metrics.roomJoined("organization");
    this.metrics.roomJoined("user");

    socket.on("realtime:join-incident", (payload, acknowledge) => {
      void this.joinIncident(socket, payload, acknowledge);
    });
    socket.on("realtime:leave-incident", (payload, acknowledge) => {
      const parsed = realtimeJoinIncidentRequestSchema.safeParse(payload);
      if (!parsed.success) {
        this.metrics.roomRejected("invalid_request");
        acknowledge?.({ ok: false, code: "invalid_request" });
        return;
      }
      void socket.leave(incidentRoom(parsed.data.incidentId));
      acknowledge?.({ ok: true });
    });
    socket.on("disconnect", () => {
      const sockets = this.socketsBySession.get(auth.sessionId);
      sockets?.delete(socket.id);
      if (sockets?.size === 0) this.socketsBySession.delete(auth.sessionId);
      this.metrics.connectionClosed();
    });
  }

  private async joinIncident(
    socket: RealtimeSocket,
    payload: unknown,
    acknowledge?: JoinIncidentAck,
  ) {
    const parsed = realtimeJoinIncidentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      this.metrics.roomRejected("invalid_request");
      acknowledge?.({ ok: false, code: "invalid_request" });
      return;
    }

    const incidentRoomCount = [...socket.rooms].filter((room) =>
      room.startsWith("incident:"),
    ).length;
    if (
      !socket.rooms.has(incidentRoom(parsed.data.incidentId)) &&
      incidentRoomCount >= this.maxIncidentRoomsPerSocket
    ) {
      this.metrics.roomRejected("room_limit");
      acknowledge?.({ ok: false, code: "room_limit" });
      return;
    }

    try {
      const currentAuth = await this.options.authService.authenticateToken(
        socket.data.sessionToken,
      );
      if (
        currentAuth.sessionId !== socket.data.auth.sessionId ||
        currentAuth.organizationId !== socket.data.auth.organizationId ||
        currentAuth.userId !== socket.data.auth.userId
      ) {
        this.disconnectSocket(socket);
        return;
      }
      const authorized = await this.options.roomAuthorizer.canJoinIncident(
        currentAuth,
        parsed.data.incidentId,
      );
      if (!authorized) {
        this.metrics.roomRejected("permission_denied");
        acknowledge?.({ ok: false, code: "permission_denied" });
        return;
      }
      await socket.join(incidentRoom(parsed.data.incidentId));
      this.metrics.roomJoined("incident");
      acknowledge?.({ ok: true });
    } catch {
      this.disconnectSocket(socket);
    }
  }

  private async revalidateConnectedSessions() {
    await Promise.allSettled(
      [...this.io.sockets.sockets.values()].map(async (socket) => {
        try {
          const currentAuth = await this.options.authService.authenticateToken(
            socket.data.sessionToken,
          );
          if (
            currentAuth.sessionId !== socket.data.auth.sessionId ||
            currentAuth.organizationId !== socket.data.auth.organizationId ||
            currentAuth.userId !== socket.data.auth.userId
          ) {
            this.disconnectSocket(socket);
          }
        } catch {
          this.disconnectSocket(socket);
        }
      }),
    );
  }

  private disconnectSocket(socket: RealtimeSocket) {
    if (!socket.connected) return;
    socket.emit("realtime:session-revoked", { reason: "session_revoked" });
    this.metrics.sessionDisconnected();
    socket.disconnect(true);
  }
}
