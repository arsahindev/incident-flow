import assert from "node:assert/strict";
import { test } from "node:test";

import {
  apiErrorResponseSchema,
  authSessionResponseSchema,
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
