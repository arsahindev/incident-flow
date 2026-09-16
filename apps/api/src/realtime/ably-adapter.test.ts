import assert from "node:assert/strict";
import { test } from "node:test";
import { jwtVerify } from "jose";
import type {
  AuthContext,
  RealtimeIncidentSignal,
} from "@incidentflow/contracts";

import { buildApp } from "../app.js";
import { AuthenticationError } from "../auth/errors.js";
import type { AuthService } from "../auth/service.js";
import { AblyRealtimeAdapter } from "./ably-adapter.js";

const secret = "test-only-secret-never-used-on-ably";
const apiKey = `test.key:${secret}`;
const auth: AuthContext = {
  sessionId: "77777777-7777-4777-8777-777777777771",
  userId: "88888888-8888-4888-8888-888888888881",
  organizationId: "11111111-1111-4111-8111-111111111111",
  email: "demo@example.com",
  displayName: "Demo",
  organizationSlug: "demo",
  organizationName: "Demo",
  role: "responder",
  permissions: ["incidents.read"],
};
const signal: RealtimeIncidentSignal = {
  schemaVersion: 1,
  type: "incident.created",
  incidentId: "33333333-3333-4333-8333-333333333331",
  incidentVersion: 1,
  occurredAt: "2026-09-15T10:00:00.000Z",
};

test("Ably tokens are signed, expire in 60s, and grant only tenant subscription", async () => {
  const adapter = new AblyRealtimeAdapter({ apiKey });
  const issued = await adapter.issueToken(auth);
  const { payload, protectedHeader } = await jwtVerify(
    issued.token,
    new TextEncoder().encode(secret),
    { algorithms: ["HS256"] },
  );
  assert.equal(protectedHeader.kid, "test.key");
  assert.equal(payload.exp! - payload.iat!, 60);
  assert.equal(payload["x-ably-clientId"], auth.sessionId);
  assert.equal(
    payload["x-ably-revocation-key"],
    `${auth.organizationId}:${auth.userId}`,
  );
  assert.deepEqual(JSON.parse(String(payload["x-ably-capability"])), {
    [issued.channel]: ["subscribe"],
  });
  const other = await adapter.issueToken({
    ...auth,
    organizationId: "11111111-1111-4111-8111-111111111112",
  });
  assert.notEqual(other.channel, issued.channel);
  assert.doesNotMatch(issued.token, /test-only-secret/);
  await assert.rejects(
    jwtVerify(issued.token, new TextEncoder().encode(secret), {
      currentDate: new Date((payload.exp! + 1) * 1000),
    }),
  );
  await assert.rejects(adapter.issueToken({ ...auth, permissions: [] }));
  await assert.rejects(adapter.issueToken({ ...auth, organizationId: "*" }));
});

test("token route reauthenticates, ignores supplied identity, and denies revoked sessions", async () => {
  let revoked = false;
  const adapter = new AblyRealtimeAdapter({ apiKey });
  const authService = {
    async authenticateToken(token: string) {
      if (revoked || token !== "valid") throw new AuthenticationError();
      return auth;
    },
  } as AuthService;
  const app = buildApp({
    logger: false,
    authService,
    realtimeTokenIssuer: adapter,
  });
  try {
    assert.equal(
      (await app.inject({ method: "POST", url: "/v1/realtime/token" }))
        .statusCode,
      401,
    );
    const request = {
      method: "POST" as const,
      url: "/v1/realtime/token?channel=*",
      headers: { authorization: "Session valid" },
      payload: {
        organizationId: "*",
        clientId: "*",
        capability: { "*": ["publish"] },
      },
    };
    const response = await app.inject(request);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(
      response.json().channel,
      `incidentflow:organization:${auth.organizationId}`,
    );
    revoked = true;
    assert.equal((await app.inject(request)).statusCode, 401);
  } finally {
    await app.close();
  }
  const denied = buildApp({
    logger: false,
    testAuthContext: { ...auth, permissions: [] },
    realtimeTokenIssuer: adapter,
  });
  try {
    assert.equal(
      (await denied.inject({ method: "POST", url: "/v1/realtime/token" }))
        .statusCode,
      403,
    );
  } finally {
    await denied.close();
  }
});

test("Ably publishes minimal validated signals and scopes session/user revocation", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const adapter = new AblyRealtimeAdapter({
    apiKey,
    fetch: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init!.body)) });
      assert.ok(init!.signal);
      assert.equal(init!.redirect, "error");
      return new Response(null, { status: 201 });
    },
  });
  await adapter.publishIncidentSignal(auth.organizationId, signal.incidentId, {
    ...signal,
    email: "private@example.com",
  } as RealtimeIncidentSignal);
  assert.equal(
    calls[0]!.url,
    `https://rest.ably.io/channels/${encodeURIComponent(`incidentflow:organization:${auth.organizationId}`)}/messages`,
  );
  assert.deepEqual(calls[0]!.body, { name: "realtime:incident", data: signal });
  await assert.rejects(
    adapter.publishIncidentSignal(auth.organizationId, auth.userId, signal),
  );
  await assert.rejects(
    adapter.publishIncidentSignal("*", signal.incidentId, signal),
  );
  assert.equal(calls.length, 1);
  await adapter.disconnectSession(auth.sessionId);
  await adapter.disconnectUser(auth.organizationId, auth.userId);
  assert.equal(
    calls[1]!.url,
    "https://main.realtime.ably.net/keys/test.key/revokeTokens",
  );
  assert.deepEqual(calls[1]!.body, {
    targets: [`clientId:${auth.sessionId}`],
    allowReauthMargin: false,
  });
  assert.deepEqual(calls[2]!.body, {
    targets: [`revocationKey:${auth.organizationId}:${auth.userId}`],
    allowReauthMargin: false,
  });
});

test("Ably rejects oversized signals and sanitizes provider/network errors", async () => {
  const small = new AblyRealtimeAdapter({ apiKey, maxOutboundPayloadBytes: 1 });
  await assert.rejects(
    small.publishIncidentSignal(auth.organizationId, signal.incidentId, signal),
    /payload limit/,
  );
  const unavailable = new AblyRealtimeAdapter({
    apiKey,
    fetch: async () => new Response(apiKey, { status: 503 }),
  });
  await assert.rejects(unavailable.disconnectSession(auth.sessionId), {
    message: "Realtime provider returned HTTP 503",
  });
  const networkFailure = new AblyRealtimeAdapter({
    apiKey,
    fetch: async () => {
      throw new Error(apiKey);
    },
  });
  await assert.rejects(networkFailure.disconnectSession(auth.sessionId), {
    message: "Realtime provider request failed",
  });
});
