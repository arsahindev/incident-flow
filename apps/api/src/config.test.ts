import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ConfigurationError,
  configurationFailureLog,
  loadConfig,
  loadDatabaseConfig,
  loadSeedConfig,
} from "./config.js";

const passwordPepper = Buffer.alloc(32, 1).toString("base64");
const requiredEnvironment = {
  DATABASE_URL: "postgresql://incidentflow:secret@localhost:5432/incidentflow",
  PASSWORD_PEPPER: passwordPepper,
  WEB_ORIGIN: "http://localhost:3000",
};

test("Ably requires its server key and Vercel rejects the Socket.IO transport", () => {
  assert.equal(loadConfig(requiredEnvironment).REALTIME_TRANSPORT, "socketio");
  assert.throws(() =>
    loadConfig({ ...requiredEnvironment, REALTIME_TRANSPORT: "ably" }),
  );
  assert.throws(() => loadConfig({ ...requiredEnvironment, VERCEL: "1" }));
  assert.equal(
    loadConfig({
      ...requiredEnvironment,
      VERCEL: "1",
      REALTIME_TRANSPORT: "ably",
      ABLY_API_KEY: "test.key:test-only",
    }).REALTIME_TRANSPORT,
    "ably",
  );
});

test("API configuration requires database URL and web origin", () => {
  assert.throws(
    () => loadConfig({}),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.issues.some(
        (issue) =>
          issue.variable === "DATABASE_URL" && issue.reason === "is required",
      ) &&
      error.issues.some(
        (issue) =>
          issue.variable === "WEB_ORIGIN" && issue.reason === "is required",
      ) &&
      error.issues.some(
        (issue) =>
          issue.variable === "PASSWORD_PEPPER" &&
          issue.reason === "is required",
      ),
  );
});

test("database tools validate only the database URL", () => {
  assert.deepEqual(loadDatabaseConfig(requiredEnvironment), {
    DATABASE_URL: requiredEnvironment.DATABASE_URL,
  });
  assert.throws(() =>
    loadDatabaseConfig({ DATABASE_URL: "https://database.example.com" }),
  );
});

test("seed configuration requires and decodes a strong password pepper", () => {
  const config = loadSeedConfig(requiredEnvironment);
  assert.deepEqual(config.PASSWORD_PEPPER, Buffer.alloc(32, 1));

  assert.throws(() =>
    loadSeedConfig({
      DATABASE_URL: requiredEnvironment.DATABASE_URL,
      PASSWORD_PEPPER: Buffer.alloc(16, 1).toString("base64"),
    }),
  );
  assert.throws(() =>
    loadSeedConfig({
      DATABASE_URL: requiredEnvironment.DATABASE_URL,
      PASSWORD_PEPPER: "not-base64!",
    }),
  );
});

test("API configuration applies bounded operational defaults", () => {
  const config = loadConfig(requiredEnvironment);

  assert.equal(config.API_HOST, "0.0.0.0");
  assert.equal(config.API_PORT, 4000);
  assert.equal(config.REALTIME_MAX_INBOUND_BYTES, 4_096);
  assert.equal(config.REALTIME_MAX_OUTBOUND_BYTES, 1_024);
  assert.equal(config.REALTIME_MAX_INCIDENT_ROOMS, 10);
  assert.equal(config.REALTIME_MAX_PENDING_PACKETS, 20);
  assert.equal(config.REALTIME_SESSION_REVALIDATE_MS, 60_000);
});

test("API web origin rejects paths and credentials", () => {
  for (const WEB_ORIGIN of [
    "https://example.com/dashboard",
    "https://user:password@example.com",
  ]) {
    assert.throws(() => loadConfig({ ...requiredEnvironment, WEB_ORIGIN }));
  }
});

test("configuration failure logs contain issues but not environment values", () => {
  const secretDatabaseUrl =
    "postgresql://incidentflow:do-not-log@localhost:5432/incidentflow";

  try {
    loadConfig({ DATABASE_URL: secretDatabaseUrl });
    assert.fail("Expected configuration validation to fail");
  } catch (error) {
    assert.ok(error instanceof ConfigurationError);
    const log = JSON.stringify(configurationFailureLog(error));
    assert.match(log, /configuration_validation_failed/);
    assert.doesNotMatch(log, /do-not-log/);
  }
});

test("environment file read failures use the structured configuration boundary", () => {
  assert.throws(
    () => loadConfig({ ...requiredEnvironment }, import.meta.dirname),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.issues.length === 1 &&
      error.issues[0]?.variable === "ENV_FILE" &&
      error.issues[0].reason.startsWith("could not be read"),
  );
});

test("an explicitly requested missing environment file fails", () => {
  assert.throws(
    () =>
      loadConfig(
        { ...requiredEnvironment },
        "/path/that/does/not/exist/incidentflow-api.env",
      ),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.issues[0]?.variable === "ENV_FILE" &&
      error.issues[0].reason === "could not be read (ENOENT)",
  );
});

test("injected deployment variables do not require an environment file", () => {
  const config = loadConfig({ ...requiredEnvironment });
  assert.equal(config.DATABASE_URL, requiredEnvironment.DATABASE_URL);
});
