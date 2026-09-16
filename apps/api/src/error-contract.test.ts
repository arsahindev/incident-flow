import assert from "node:assert/strict";
import { test } from "node:test";

import { apiErrorResponseSchema } from "@incidentflow/contracts";

import { buildApp } from "./app.js";
import type { AuthService } from "./auth/service.js";
import { ownerTestAuthContext } from "./test-auth-context.js";

test("API errors use a coded envelope correlated with the response header", async () => {
  const app = buildApp({ logger: false });
  const response = await app.inject({ method: "GET", url: "/v1/auth/session" });

  assert.equal(response.statusCode, 401);
  const parsed = apiErrorResponseSchema.parse(response.json());
  assert.equal(parsed.error.code, "authentication_required");
  assert.equal(parsed.error.requestId, response.headers["x-request-id"]);
  await app.close();
});

test("validation errors include stable issue paths and codes", async () => {
  const app = buildApp({ authService: {} as AuthService, logger: false });
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: "not-an-email", password: "" },
  });

  assert.equal(response.statusCode, 400);
  const parsed = apiErrorResponseSchema.parse(response.json());
  assert.equal(parsed.error.code, "validation_error");
  assert.ok(parsed.error.issues?.some((issue) => issue.path === "email"));
  assert.ok(parsed.error.issues?.every((issue) => Boolean(issue.code)));
  await app.close();
});

test("unexpected errors do not expose implementation details", async () => {
  const app = buildApp({
    logger: false,
    testAuthContext: ownerTestAuthContext,
  });
  app.get("/explode", async () => {
    throw new Error("database password leaked");
  });
  const response = await app.inject({ method: "GET", url: "/explode" });

  assert.equal(response.statusCode, 500);
  const parsed = apiErrorResponseSchema.parse(response.json());
  assert.equal(parsed.error.code, "internal_error");
  assert.equal(parsed.error.message, "Internal server error");
  assert.doesNotMatch(response.body, /database password leaked/);
  await app.close();
});
