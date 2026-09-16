import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import { test } from "node:test";

import type {
  AuthContext,
  RealtimeIncidentSignal,
} from "@incidentflow/contracts";
import {
  io as createClient,
  type Socket as ClientSocket,
} from "socket.io-client";

import { AuthenticationError } from "../auth/errors.js";
import { permissionsForRole } from "../auth/permissions.js";
import { InMemoryRealtimeMetrics } from "./metrics.js";
import type { RealtimeRoomAuthorizer } from "./room-authorizer.js";
import { SocketIoRealtimeAdapter } from "./socket-io-adapter.js";

const webOrigin = "http://localhost:3000";
const organizationA = "11111111-1111-4111-8111-111111111111";
const organizationB = "11111111-1111-4111-8111-111111111112";
const userA = "88888888-8888-4888-8888-888888888881";
const userB = "88888888-8888-4888-8888-888888888882";
const sessionA = "77777777-7777-4777-8777-777777777771";
const sessionB = "77777777-7777-4777-8777-777777777772";
const incidentA = "33333333-3333-4333-8333-333333333331";
const incidentA2 = "33333333-3333-4333-8333-333333333333";
const incidentB = "33333333-3333-4333-8333-333333333332";
const tokenA = "a".repeat(43);
const tokenB = "b".repeat(43);

function authContext(
  organizationId: string,
  userId: string,
  sessionId: string,
): AuthContext {
  return {
    sessionId,
    userId,
    email: `${userId.slice(0, 4)}@example.com`,
    displayName: "Realtime User",
    organizationId,
    organizationSlug:
      organizationId === organizationA ? "organization-a" : "organization-b",
    organizationName:
      organizationId === organizationA ? "Organization A" : "Organization B",
    role: "viewer",
    permissions: permissionsForRole("viewer"),
  };
}

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 2_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once(event, handler);
  });
}

function connect(socket: ClientSocket) {
  if (socket.connected) return Promise.resolve();
  const connected = waitForEvent<void>(socket, "connect");
  socket.connect();
  return connected;
}

async function startAdapter(
  options: Partial<
    ConstructorParameters<typeof SocketIoRealtimeAdapter>[0]
  > = {},
) {
  let revokedToken: string | null = null;
  const contexts = new Map([
    [tokenA, authContext(organizationA, userA, sessionA)],
    [tokenB, authContext(organizationB, userB, sessionB)],
  ]);
  const metrics = new InMemoryRealtimeMetrics();
  const roomAuthorizer: RealtimeRoomAuthorizer = {
    async canJoinIncident(context, incidentId) {
      return (
        (context.organizationId === organizationA &&
          (incidentId === incidentA || incidentId === incidentA2)) ||
        (context.organizationId === organizationB && incidentId === incidentB)
      );
    },
  };
  const adapter = new SocketIoRealtimeAdapter({
    authService: {
      async authenticateToken(token) {
        const context = contexts.get(token);
        if (!context || token === revokedToken) throw new AuthenticationError();
        return context;
      },
    },
    roomAuthorizer,
    webOrigin,
    metrics,
    ...options,
  });
  const server = createServer();
  adapter.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server did not bind");
  return {
    adapter,
    metrics,
    server,
    url: `http://127.0.0.1:${address.port}`,
    revoke(token: string) {
      revokedToken = token;
    },
  };
}

function client(url: string, token?: string, origin = webOrigin) {
  return createClient(url, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
    extraHeaders: {
      Origin: origin,
      ...(token ? { Cookie: `incidentflow_session=${token}` } : {}),
    },
  });
}

async function close(
  adapter: SocketIoRealtimeAdapter,
  server: HttpServer,
  sockets: ClientSocket[],
) {
  for (const socket of sockets) socket.close();
  await adapter.close();
  if (server.listening) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("socket authentication and incident joins are tenant-authorized", async () => {
  const runtime = await startAdapter();
  const socketA = client(runtime.url, tokenA);
  const socketB = client(runtime.url, tokenB);

  try {
    await Promise.all([connect(socketA), connect(socketB)]);
    const authorized = await socketA
      .timeout(1_000)
      .emitWithAck("realtime:join-incident", { incidentId: incidentA });
    const crossTenant = await socketB
      .timeout(1_000)
      .emitWithAck("realtime:join-incident", { incidentId: incidentA });
    const forgedTenant = await socketA
      .timeout(1_000)
      .emitWithAck("realtime:join-incident", {
        incidentId: incidentA,
        organizationId: organizationB,
      });

    assert.deepEqual(authorized, { ok: true });
    assert.deepEqual(crossTenant, { ok: false, code: "permission_denied" });
    assert.deepEqual(forgedTenant, { ok: false, code: "invalid_request" });
    assert.equal(runtime.metrics.snapshot().joinedRooms.incident, 1);
    assert.equal(runtime.metrics.snapshot().rejectedRooms.permission_denied, 1);
  } finally {
    await close(runtime.adapter, runtime.server, [socketA, socketB]);
  }
});

test("organization publications do not cross tenants and revocation disconnects safely", async () => {
  const runtime = await startAdapter();
  const socketA = client(runtime.url, tokenA);
  const socketB = client(runtime.url, tokenB);
  const receivedByA: RealtimeIncidentSignal[] = [];
  const receivedByB: RealtimeIncidentSignal[] = [];
  socketA.on("realtime:incident", (signal) => receivedByA.push(signal));
  socketB.on("realtime:incident", (signal) => receivedByB.push(signal));

  try {
    await Promise.all([connect(socketA), connect(socketB)]);
    const signal: RealtimeIncidentSignal = {
      schemaVersion: 1,
      type: "incident.status_changed",
      incidentId: incidentA,
      incidentVersion: 2,
      occurredAt: "2026-08-27T12:00:00.000Z",
    };
    const delivered = waitForEvent<RealtimeIncidentSignal>(
      socketA,
      "realtime:incident",
    );
    await runtime.adapter.publishIncidentSignal(
      organizationA,
      incidentA,
      signal,
    );
    assert.deepEqual(await delivered, signal);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(receivedByA.length, 1);
    assert.equal(receivedByB.length, 0);

    const revokedSignal = waitForEvent<{ reason: string }>(
      socketA,
      "realtime:session-revoked",
    );
    const disconnected = waitForEvent<void>(socketA, "disconnect");
    await runtime.adapter.disconnectSession(sessionA);
    assert.deepEqual(await revokedSignal, { reason: "session_revoked" });
    await disconnected;
    assert.equal(socketA.connected, false);
    assert.equal(socketB.connected, true);
    assert.equal(runtime.metrics.snapshot().disconnectedSessions, 1);
  } finally {
    await close(runtime.adapter, runtime.server, [socketA, socketB]);
  }
});

test("outbound payload and room-count limits are enforced", async () => {
  const runtime = await startAdapter({
    maxOutboundPayloadBytes: 32,
    maxIncidentRoomsPerSocket: 1,
  });
  const socketA = client(runtime.url, tokenA);

  try {
    await connect(socketA);
    const firstJoin = await socketA
      .timeout(1_000)
      .emitWithAck("realtime:join-incident", { incidentId: incidentA });
    assert.deepEqual(firstJoin, { ok: true });

    const secondJoin = await socketA
      .timeout(1_000)
      .emitWithAck("realtime:join-incident", { incidentId: incidentA2 });
    assert.deepEqual(secondJoin, { ok: false, code: "room_limit" });
    assert.equal(runtime.metrics.snapshot().rejectedRooms.room_limit, 1);

    await assert.rejects(
      runtime.adapter.publishIncidentSignal(organizationA, incidentA, {
        schemaVersion: 1,
        type: "incident.created",
        incidentId: incidentA,
        incidentVersion: 1,
        occurredAt: "2026-08-27T12:00:00.000Z",
      }),
      /payload limit/,
    );
    assert.equal(
      runtime.metrics.snapshot().droppedSignals.payload_too_large,
      1,
    );
  } finally {
    await close(runtime.adapter, runtime.server, [socketA]);
  }
});

test("handshakes reject missing sessions and untrusted origins", async () => {
  const runtime = await startAdapter();
  const missingSession = client(runtime.url);
  const foreignOrigin = client(runtime.url, tokenA, "https://attacker.example");

  try {
    const missingError = waitForEvent<Error & { data?: { code?: string } }>(
      missingSession,
      "connect_error",
    );
    missingSession.connect();
    assert.equal((await missingError).data?.code, "authentication_required");

    const originError = waitForEvent<Error>(foreignOrigin, "connect_error");
    foreignOrigin.connect();
    await originError;
    assert.equal(foreignOrigin.connected, false);
    assert.equal(runtime.metrics.snapshot().rejectedAuthentications, 1);
  } finally {
    await close(runtime.adapter, runtime.server, [
      missingSession,
      foreignOrigin,
    ]);
  }
});

test("session revalidation and backpressure fail closed", async () => {
  const runtime = await startAdapter({
    sessionValidationIntervalMs: 20,
    maxPendingPackets: 0,
    disconnectAfterBackpressureDrops: 1,
  });
  const socketA = client(runtime.url, tokenA);

  try {
    await connect(socketA);
    const disconnected = waitForEvent<void>(socketA, "disconnect");
    await runtime.adapter.publishIncidentSignal(organizationA, incidentA, {
      schemaVersion: 1,
      type: "incident.activity_updated",
      incidentId: incidentA,
      incidentVersion: 2,
      occurredAt: "2026-08-27T12:00:00.000Z",
    });
    await disconnected;
    assert.equal(runtime.metrics.snapshot().droppedSignals.backpressure, 1);

    const socketAfterReconnect = client(runtime.url, tokenA);
    try {
      await connect(socketAfterReconnect);
      const revalidationDisconnect = waitForEvent<void>(
        socketAfterReconnect,
        "disconnect",
      );
      runtime.revoke(tokenA);
      await revalidationDisconnect;
      assert.equal(socketAfterReconnect.connected, false);
    } finally {
      socketAfterReconnect.close();
    }
  } finally {
    await close(runtime.adapter, runtime.server, [socketA]);
  }
});
