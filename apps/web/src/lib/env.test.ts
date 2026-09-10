import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ConfigurationError,
  parseConfiguration,
  webClientEnvironmentSchema,
  webServerEnvironmentSchema,
} from "./env/schema.js";

test("web server environment requires an API URL", () => {
  assert.throws(
    () =>
      parseConfiguration(
        "incidentflow-web",
        webServerEnvironmentSchema("development"),
        {},
      ),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.issues.some(
        (issue) => issue.variable === "API_URL" && issue.reason === "is required",
      ),
  );
});

test("web client environment requires a realtime URL", () => {
  assert.throws(
    () =>
      parseConfiguration(
        "incidentflow-web",
        webClientEnvironmentSchema("development"),
        {},
      ),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.issues.some(
        (issue) =>
          issue.variable === "NEXT_PUBLIC_REALTIME_URL" &&
          issue.reason === "is required",
      ),
  );
});

test("web origins reject paths, credentials, and insecure production hosts", () => {
  for (const API_URL of [
    "https://example.com/api",
    "https://user:password@example.com",
    "http://example.com",
  ]) {
    assert.throws(() =>
      parseConfiguration(
        "incidentflow-web",
        webServerEnvironmentSchema("production"),
        { API_URL },
      ),
    );
  }
});

test("web origins allow loopback HTTP and normalize a trailing slash", () => {
  const environment = parseConfiguration(
    "incidentflow-web",
    webClientEnvironmentSchema("production"),
    { NEXT_PUBLIC_REALTIME_URL: "http://localhost:4000/" },
  );

  assert.equal(environment.NEXT_PUBLIC_REALTIME_URL, "http://localhost:4000");
});

test("web client configuration permits an explicit same-origin realtime endpoint", () => {
  const environment = parseConfiguration(
    "incidentflow-web",
    webClientEnvironmentSchema("production"),
    { NEXT_PUBLIC_REALTIME_URL: "same-origin" },
  );

  assert.equal(environment.NEXT_PUBLIC_REALTIME_URL, "same-origin");
});
