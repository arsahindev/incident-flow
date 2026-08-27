import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { ApiError, parseApiResponse } from "./api-response.js";

test("parses a successful JSON response exactly once and validates it", async () => {
  const result = await parseApiResponse(
    new Response(JSON.stringify({ value: 42 }), {
      status: 200,
      headers: { "x-request-id": "request-success" },
    }),
    z.object({ value: z.number() }),
  );
  assert.deepEqual(result, { value: 42 });
});

test("returns undefined for a no-content response", async () => {
  assert.equal(await parseApiResponse(new Response(null, { status: 204 })), undefined);
});

test("preserves structured API error metadata", async () => {
  await assert.rejects(
    parseApiResponse(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Validation failed",
            issues: [{ path: "email", message: "Invalid email", code: "invalid_format" }],
            requestId: "request-error",
          },
        }),
        { status: 400 },
      ),
    ),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "validation_error");
      assert.equal(error.requestId, "request-error");
      assert.equal(error.issues[0]?.path, "email");
      return true;
    },
  );
});

test("turns non-JSON failures and malformed successful bodies into safe errors", async () => {
  await assert.rejects(
    parseApiResponse(new Response("gateway unavailable", { status: 502 })),
    (error: unknown) => error instanceof ApiError && error.code === "unknown_error",
  );
  await assert.rejects(
    parseApiResponse(new Response("not-json", { status: 200 })),
    (error: unknown) => error instanceof ApiError && error.code === "invalid_response",
  );
});

test("rejects successful JSON that violates its endpoint response schema", async () => {
  await assert.rejects(
    parseApiResponse(
      new Response(JSON.stringify({ value: "wrong" }), { status: 200 }),
      z.object({ value: z.number() }),
    ),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "invalid_response" &&
      error.issues[0]?.path === "value",
  );
});
