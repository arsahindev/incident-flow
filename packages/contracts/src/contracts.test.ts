import assert from "node:assert/strict";
import { test } from "node:test";

import {
  apiErrorResponseSchema,
  authSessionResponseSchema,
  incidentResponseSchema,
  incidentsResponseSchema,
  realtimeIncidentSignalSchema,
  realtimeJoinIncidentRequestSchema,
  sessionResultResponseSchema,
} from "./index.js";

const context = {
  sessionId: "77777777-7777-4777-8777-777777777777",
  userId: "88888888-8888-4888-8888-888888888888",
  email: "owner@example.com",
  displayName: "Owner",
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationSlug: "example",
  organizationName: "Example",
  role: "owner",
  permissions: ["incidents.read"],
};

test("identity response contracts accept the documented session shapes", () => {
  assert.equal(authSessionResponseSchema.safeParse({ session: context }).success, true);
  assert.equal(
    sessionResultResponseSchema.safeParse({
      session: {
        token: "a".repeat(43),
        expiresAt: "2026-08-27T12:00:00.000Z",
        context,
      },
    }).success,
    true,
  );
});

test("error contracts require a stable code and request correlation id", () => {
  assert.equal(
    apiErrorResponseSchema.safeParse({
      error: {
        code: "validation_error",
        message: "Validation failed",
        issues: [{ path: "email", message: "Invalid email", code: "invalid_format" }],
        requestId: "request-123",
      },
    }).success,
    true,
  );
  assert.equal(
    apiErrorResponseSchema.safeParse({ error: { message: "Validation failed" } }).success,
    false,
  );
});

test("incident contracts carry a positive canonical version", () => {
  const incident = {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Checkout API unavailable",
    description: null,
    status: "open",
    priority: "high",
    team: null,
    affectedServices: [],
    version: 2,
    resolvedAt: null,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:01:00.000Z",
  };

  assert.equal(
    incidentsResponseSchema.parse({
      incidents: [incident],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    }).incidents[0]?.version,
    2,
  );
  assert.equal(
    incidentResponseSchema.parse({ incident: { ...incident, activity: [] } }).incident
      .version,
    2,
  );
  assert.equal(
    incidentResponseSchema.safeParse({
      incident: { ...incident, version: 0, activity: [] },
    }).success,
    false,
  );
});

test("realtime contracts stay versioned and strict at room boundaries", () => {
  const signal = realtimeIncidentSignalSchema.parse({
    schemaVersion: 1,
    type: "incident.status_changed",
    incidentId: "33333333-3333-4333-8333-333333333333",
    incidentVersion: 3,
    occurredAt: "2026-08-27T12:02:00.000Z",
  });
  assert.equal(signal.incidentVersion, 3);
  assert.equal(
    realtimeJoinIncidentRequestSchema.safeParse({
      incidentId: signal.incidentId,
      organizationId: "11111111-1111-4111-8111-111111111111",
    }).success,
    false,
  );
});
