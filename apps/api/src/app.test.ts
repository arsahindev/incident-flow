import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApp } from "./app.js";

test("GET /health reports that the API is available", async () => {
  const app = buildApp({ logger: false });
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ok",
    service: "incidentflow-api",
  });

  await app.close();
});

test("GET /ready reports dependency readiness without leaking failures", async () => {
  const readyApp = buildApp({
    logger: false,
    readinessCheck: async () => undefined,
  });
  const readyResponse = await readyApp.inject({ method: "GET", url: "/ready" });
  assert.equal(readyResponse.statusCode, 200);
  assert.deepEqual(readyResponse.json(), {
    status: "ready",
    service: "incidentflow-api",
  });
  await readyApp.close();

  const unavailableApp = buildApp({
    logger: false,
    readinessCheck: async () => {
      throw new Error("postgresql://user:secret@database/internal");
    },
  });
  const unavailableResponse = await unavailableApp.inject({
    method: "GET",
    url: "/ready",
  });
  assert.equal(unavailableResponse.statusCode, 503);
  assert.deepEqual(unavailableResponse.json(), {
    status: "not_ready",
    service: "incidentflow-api",
  });
  assert.doesNotMatch(unavailableResponse.body, /secret/);
  await unavailableApp.close();
});
