import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApp } from "../app.js";
import type { ServiceRepository } from "./repository.js";
import type { CreateServiceInput, ServiceDetailRecord } from "./types.js";

const serviceId = "55555555-5555-4555-8555-555555555551";
const environmentId = "66666666-6666-4666-8666-000001000001";
const teamId = "22222222-2222-4222-8222-222222222222";

function serviceFixture(): ServiceDetailRecord {
  return {
    id: serviceId,
    name: "Checkout API",
    slug: "checkout-api",
    description: "Coordinates customer checkout.",
    type: "api",
    tier: "critical",
    status: "operational",
    ownerTeam: { id: teamId, name: "Platform", slug: "platform" },
    environments: [
      {
        id: environmentId,
        name: "Production",
        slug: "production",
        kind: "production",
        isEphemeral: false,
        expiresAt: null,
        status: "active",
        createdAt: "2026-08-15T12:00:00.000Z",
        updatedAt: "2026-08-15T12:00:00.000Z",
      },
    ],
    incidentCount: 0,
    recentIncidents: [],
    archivedAt: null,
    createdAt: "2026-08-15T12:00:00.000Z",
    updatedAt: "2026-08-15T12:00:00.000Z",
  };
}

function createRepository(overrides: Partial<ServiceRepository> = {}) {
  const repository: ServiceRepository = {
    async listServices() {
      return [serviceFixture()];
    },
    async getService() {
      return serviceFixture();
    },
    async createService() {
      return serviceFixture();
    },
    async updateService() {
      return serviceFixture();
    },
    async createEnvironment() {
      return serviceFixture().environments[0]!;
    },
    async updateEnvironment() {
      return serviceFixture().environments[0]!;
    },
    ...overrides,
  };
  return repository;
}

test("service routes list and return catalog records", async () => {
  const app = buildApp({ serviceRepository: createRepository(), logger: false });
  const [listResponse, detailResponse] = await Promise.all([
    app.inject({ method: "GET", url: "/v1/services" }),
    app.inject({ method: "GET", url: `/v1/services/${serviceId}` }),
  ]);

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().services[0].name, "Checkout API");
  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().service.environments[0].kind, "production");
  await app.close();
});

test("POST /v1/services validates and normalizes a service with environments", async () => {
  let receivedInput: CreateServiceInput | undefined;
  const repository = createRepository({
    async createService(_organizationSlug, input) {
      receivedInput = input;
      return serviceFixture();
    },
  });
  const app = buildApp({ serviceRepository: repository, logger: false });

  const invalidResponse = await app.inject({
    method: "POST",
    url: "/v1/services",
    payload: { name: "Checkout API", slug: "Checkout API", environments: [] },
  });
  assert.equal(invalidResponse.statusCode, 400);

  const response = await app.inject({
    method: "POST",
    url: "/v1/services",
    payload: {
      name: "  Checkout API  ",
      slug: "checkout-api",
      type: "api",
      ownerTeamId: teamId,
      environments: [
        {
          name: "Production",
          slug: "production",
          kind: "production",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(receivedInput?.name, "Checkout API");
  assert.equal(receivedInput?.tier, "medium");
  assert.equal(receivedInput?.environments[0]?.isEphemeral, false);
  await app.close();
});

test("service environment routes preserve service scoping", async () => {
  let receivedServiceId: string | undefined;
  const repository = createRepository({
    async createEnvironment(_organizationSlug, nextServiceId) {
      receivedServiceId = nextServiceId;
      return serviceFixture().environments[0]!;
    },
  });
  const app = buildApp({ serviceRepository: repository, logger: false });
  const response = await app.inject({
    method: "POST",
    url: `/v1/services/${serviceId}/environments`,
    payload: {
      name: "Preview 417",
      slug: "preview-417",
      kind: "preview",
      isEphemeral: true,
      expiresAt: "2026-08-20T12:00:00.000Z",
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(receivedServiceId, serviceId);
  await app.close();
});

test("service environment routes reject expiry on non-ephemeral environments", async () => {
  const app = buildApp({ serviceRepository: createRepository(), logger: false });
  const invalidEnvironment = {
    name: "Production",
    slug: "production",
    kind: "production",
    isEphemeral: false,
    expiresAt: "2026-08-20T12:00:00.000Z",
  };

  const [createResponse, updateResponse] = await Promise.all([
    app.inject({
      method: "POST",
      url: `/v1/services/${serviceId}/environments`,
      payload: invalidEnvironment,
    }),
    app.inject({
      method: "PATCH",
      url: `/v1/services/${serviceId}/environments/${environmentId}`,
      payload: {
        isEphemeral: false,
        expiresAt: invalidEnvironment.expiresAt,
      },
    }),
  ]);

  assert.equal(createResponse.statusCode, 400);
  assert.equal(updateResponse.statusCode, 400);
  assert.equal(
    createResponse.json().issues[0].message,
    "Only ephemeral environments may have an expiry time",
  );
  assert.equal(
    updateResponse.json().issues[0].message,
    "Only ephemeral environments may have an expiry time",
  );
  await app.close();
});
