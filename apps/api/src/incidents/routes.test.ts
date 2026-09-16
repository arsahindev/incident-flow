import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApp } from "../app.js";
import { ownerTestAuthContext } from "../test-auth-context.js";
import {
  ResourceNotFoundError,
  type IncidentRepository,
} from "./repository.js";
import type {
  CreateIncidentInput,
  IncidentDetailRecord,
  IncidentListFilters,
  UpdateIncidentInput,
} from "./types.js";

const incidentId = "33333333-3333-4333-8333-333333333333";
const teamId = "22222222-2222-4222-8222-222222222222";
const serviceId = "55555555-5555-4555-8555-555555555551";

function incidentFixture(): IncidentDetailRecord {
  return {
    id: incidentId,
    title: "Checkout API unavailable",
    description: "Requests are returning HTTP 503.",
    status: "open",
    priority: "high",
    team: { id: teamId, name: "Platform", slug: "platform" },
    affectedServices: [
      {
        id: serviceId,
        name: "Checkout API",
        slug: "checkout-api",
        type: "api",
        tier: "critical",
        status: "operational",
        isPrimary: true,
      },
    ],
    version: 1,
    resolvedAt: null,
    createdAt: "2026-08-08T12:00:00.000Z",
    updatedAt: "2026-08-08T12:00:00.000Z",
    activity: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        type: "created",
        message: "Incident created with High priority",
        fromValue: null,
        toValue: "high",
        actor: null,
        createdAt: "2026-08-08T12:00:00.000Z",
      },
    ],
  };
}

function createRepository(overrides: Partial<IncidentRepository> = {}) {
  const repository: IncidentRepository = {
    async listTeams() {
      return [{ id: teamId, name: "Platform", slug: "platform" }];
    },
    async listIncidents() {
      return {
        incidents: [incidentFixture()],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      };
    },
    async getIncident() {
      return incidentFixture();
    },
    async createIncident(_organizationSlug, input) {
      return {
        incident: {
          ...incidentFixture(),
          title: input.title,
          description: input.description ?? null,
          priority: input.priority,
        },
        changes: ["created", "affected_services", "activity"],
      };
    },
    async updateIncident(_organizationSlug, _incidentId, input) {
      return {
        incident: {
          ...incidentFixture(),
          status: input.status ?? incidentFixture().status,
        },
        changes: input.status ? ["status", "activity"] : [],
      };
    },
    ...overrides,
  };
  return repository;
}

test("incident routes expose the development tenant's teams and incidents", async () => {
  const app = buildApp({
    incidentRepository: createRepository(),
    testAuthContext: ownerTestAuthContext,
    logger: false,
  });

  const [teamsResponse, incidentsResponse] = await Promise.all([
    app.inject({ method: "GET", url: "/v1/teams" }),
    app.inject({ method: "GET", url: "/v1/incidents" }),
  ]);

  assert.equal(teamsResponse.statusCode, 200);
  assert.equal(teamsResponse.json().teams[0].name, "Platform");
  assert.equal(incidentsResponse.statusCode, 200);
  assert.equal(incidentsResponse.json().incidents[0].id, incidentId);
  assert.equal(incidentsResponse.json().pagination.total, 1);
  await app.close();
});

test("GET /v1/incidents validates and forwards catalog filters and pagination", async () => {
  let receivedFilters: IncidentListFilters | undefined;
  const repository = createRepository({
    async listIncidents(_organizationSlug, filters) {
      receivedFilters = filters;
      return {
        incidents: [incidentFixture()],
        pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
      };
    },
  });
  const app = buildApp({
    incidentRepository: repository,
    testAuthContext: ownerTestAuthContext,
    logger: false,
  });

  const response = await app.inject({
    method: "GET",
    url: `/v1/incidents?serviceId=${serviceId}&teamId=${teamId}&status=open&priority=high&page=2&pageSize=10`,
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedFilters, {
    serviceId,
    teamId,
    status: "open",
    priority: "high",
    page: 2,
    pageSize: 10,
  });

  const invalidResponse = await app.inject({
    method: "GET",
    url: "/v1/incidents?serviceId=another-tenant&status=unknown&page=0",
  });
  assert.equal(invalidResponse.statusCode, 400);
  await app.close();
});

test("POST /v1/incidents validates and normalizes its input", async () => {
  let receivedInput: CreateIncidentInput | undefined;
  const repository = createRepository({
    async createIncident(_organizationSlug, input) {
      receivedInput = input;
      return {
        incident: incidentFixture(),
        changes: ["created", "affected_services", "activity"],
      };
    },
  });
  const app = buildApp({
    incidentRepository: repository,
    testAuthContext: ownerTestAuthContext,
    logger: false,
  });

  const invalidResponse = await app.inject({
    method: "POST",
    url: "/v1/incidents",
    payload: { title: "x" },
  });
  assert.equal(invalidResponse.statusCode, 400);

  const response = await app.inject({
    method: "POST",
    url: "/v1/incidents",
    payload: {
      title: "  Checkout API unavailable  ",
      teamId,
      serviceIds: [serviceId],
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedInput, {
    title: "Checkout API unavailable",
    priority: "medium",
    teamId,
    serviceIds: [serviceId],
  });
  await app.close();
});

test("PATCH /v1/incidents/:id accepts lifecycle changes and maps missing records", async () => {
  let receivedInput: UpdateIncidentInput | undefined;
  const repository = createRepository({
    async updateIncident(_organizationSlug, _incidentId, input) {
      receivedInput = input;
      return {
        incident: {
          ...incidentFixture(),
          status: input.status ?? "open",
          version: 2,
        },
        changes: ["status", "activity"],
      };
    },
  });
  const app = buildApp({
    incidentRepository: repository,
    testAuthContext: ownerTestAuthContext,
    logger: false,
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/v1/incidents/${incidentId}`,
    payload: { status: "acknowledged" },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedInput, { status: "acknowledged" });

  const missingApp = buildApp({
    logger: false,
    testAuthContext: ownerTestAuthContext,
    incidentRepository: createRepository({
      async getIncident() {
        throw new ResourceNotFoundError("Incident");
      },
    }),
  });
  const missingResponse = await missingApp.inject({
    method: "GET",
    url: `/v1/incidents/${incidentId}`,
  });
  assert.equal(missingResponse.statusCode, 404);
  assert.equal(missingResponse.json().error.code, "not_found");
  assert.equal(missingResponse.json().error.message, "Incident was not found");
  assert.ok(missingResponse.json().error.requestId);

  await app.close();
  await missingApp.close();
});
