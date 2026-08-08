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
