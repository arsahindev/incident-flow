import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { buildApp } from "./app.js";
import { permissionsForRole } from "./auth/permissions.js";
import { loadDatabaseConfig } from "./config.js";
import { createPrismaClient } from "./database.js";
import { PrismaIncidentRepository } from "./incidents/prisma-repository.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

function databaseUrl() {
  return loadDatabaseConfig().DATABASE_URL;
}

function hasPrismaCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function isEnvironmentExpiryConstraintError(error: unknown) {
  return (
    hasPrismaCode(error, "P2004") ||
    String(error).includes("service_environments_expiry_requires_ephemeral")
  );
}

test(
  "service catalog constraints reject cross-tenant affected services",
  { skip: !runDatabaseTests },
  async () => {
    const prisma = createPrismaClient(databaseUrl());
    try {
      const organizationA = randomUUID();
      const organizationB = randomUUID();
      const serviceA = randomUUID();
      const incidentB = randomUUID();

      await assert.rejects(
        prisma.$transaction(async (transaction) => {
          await transaction.organization.createMany({
            data: [
              { id: organizationA, name: "Tenant A", slug: `tenant-a-${organizationA}` },
              { id: organizationB, name: "Tenant B", slug: `tenant-b-${organizationB}` },
            ],
          });
          await transaction.service.create({
            data: {
              id: serviceA,
              organizationId: organizationA,
              name: "Service A",
              slug: "service-a",
              type: "API",
            },
          });
          await transaction.incident.create({
            data: {
              id: incidentB,
              organizationId: organizationB,
              title: "Tenant B incident",
            },
          });
          await transaction.incidentAffectedService.create({
            data: {
              organizationId: organizationB,
              incidentId: incidentB,
              serviceId: serviceA,
              isPrimary: true,
            },
          });
        }),
        (error) => hasPrismaCode(error, "P2003"),
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);

test(
  "service catalog constraints allow only one primary service per incident",
  { skip: !runDatabaseTests },
  async () => {
    const prisma = createPrismaClient(databaseUrl());
    try {
      const organizationId = randomUUID();
      const incidentId = randomUUID();
      const serviceA = randomUUID();
      const serviceB = randomUUID();

      await assert.rejects(
        prisma.$transaction(async (transaction) => {
          await transaction.organization.create({
            data: {
              id: organizationId,
              name: "Primary constraint tenant",
              slug: `primary-${organizationId}`,
            },
          });
          await transaction.incident.create({
            data: { id: incidentId, organizationId, title: "Primary constraint" },
          });
          await transaction.service.createMany({
            data: [
              {
                id: serviceA,
                organizationId,
                name: "Service A",
                slug: "service-a",
                type: "API",
              },
              {
                id: serviceB,
                organizationId,
                name: "Service B",
                slug: "service-b",
                type: "API",
              },
            ],
          });
          await transaction.incidentAffectedService.createMany({
            data: [
              { organizationId, incidentId, serviceId: serviceA, isPrimary: true },
              { organizationId, incidentId, serviceId: serviceB, isPrimary: true },
            ],
          });
        }),
        (error) => hasPrismaCode(error, "P2002"),
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);

test(
  "incident API rejects an affected service owned by another organization",
  { skip: !runDatabaseTests },
  async () => {
    const prisma = createPrismaClient(databaseUrl());
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const serviceA = randomUUID();
    const organizationBSlug = `api-tenant-b-${organizationB}`;
    const app = buildApp({
      incidentRepository: new PrismaIncidentRepository(prisma),
      testAuthContext: {
        sessionId: randomUUID(),
        userId: randomUUID(),
        email: "tenant-b-owner@example.com",
        displayName: "Tenant B Owner",
        organizationId: organizationB,
        organizationSlug: organizationBSlug,
        organizationName: "API tenant B",
        role: "owner",
        permissions: permissionsForRole("owner"),
      },
      logger: false,
    });

    try {
      await prisma.organization.createMany({
        data: [
          { id: organizationA, name: "API tenant A", slug: `api-tenant-a-${organizationA}` },
          { id: organizationB, name: "API tenant B", slug: organizationBSlug },
        ],
      });
      await prisma.service.create({
        data: {
          id: serviceA,
          organizationId: organizationA,
          name: "Tenant A service",
          slug: "tenant-a-service",
          type: "API",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/v1/incidents",
        payload: {
          title: "Cross-tenant service reference",
          serviceIds: [serviceA],
        },
      });

      assert.equal(response.statusCode, 404);
      assert.equal(response.json().error.code, "not_found");
      assert.equal(response.json().error.message, "Affected service was not found");
      assert.ok(response.json().error.requestId);
      assert.equal(
        await prisma.incident.count({ where: { organizationId: organizationB } }),
        0,
      );
    } finally {
      await app.close();
      await prisma.organization.deleteMany({
        where: { id: { in: [organizationA, organizationB] } },
      });
      await prisma.$disconnect();
    }
  },
);

test(
  "database rejects expiry on a non-ephemeral service environment",
  { skip: !runDatabaseTests },
  async () => {
    const prisma = createPrismaClient(databaseUrl());
    const organizationId = randomUUID();
    const serviceId = randomUUID();

    try {
      await prisma.organization.create({
        data: {
          id: organizationId,
          name: "Environment constraint tenant",
          slug: `environment-constraint-${organizationId}`,
        },
      });
      await prisma.service.create({
        data: {
          id: serviceId,
          organizationId,
          name: "Constraint service",
          slug: "constraint-service",
          type: "API",
        },
      });

      await assert.rejects(
        prisma.serviceEnvironment.create({
          data: {
            organizationId,
            serviceId,
            name: "Invalid production",
            slug: "invalid-production",
            kind: "PRODUCTION",
            isEphemeral: false,
            expiresAt: new Date("2026-08-20T12:00:00.000Z"),
          },
        }),
        isEnvironmentExpiryConstraintError,
      );
    } finally {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
      await prisma.$disconnect();
    }
  },
);
