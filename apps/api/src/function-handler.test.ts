import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { buildApp } from "./app.js";
import { createFunctionHandler } from "./function-handler.js";

test("function reuses one initialized app across concurrent HTTP requests", async () => {
  const app = buildApp({ logger: false });
  let constructions = 0;
  let readinessChecks = 0;
  app.addHook("onReady", async () => {
    readinessChecks++;
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  const handler = createFunctionHandler(() => {
    constructions++;
    return app;
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        const response = await fetch(`${origin}/health`);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).status, "ok");
      }),
    );
    assert.equal(constructions, 1);
    assert.equal(readinessChecks, 1);
    assert.equal(
      (await fetch(`${origin}/v1/realtime/token`, { method: "POST" })).status,
      401,
    );
    assert.equal(app.server.listening, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  }
});

test("failed function initialization returns a safe response and retries next request", async () => {
  let attempts = 0;
  const app = buildApp({ logger: false });
  const handler = createFunctionHandler(() => {
    if (++attempts === 1) throw new Error("private configuration value");
    return app;
  });
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/health`;
  try {
    const failed = await fetch(url);
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await failed.text(), /private/);
    assert.equal((await fetch(url)).status, 200);
    assert.equal(attempts, 2);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  }
});
