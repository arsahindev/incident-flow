import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { publicDemoAccount } from "@incidentflow/contracts";

import { buildApp } from "./app.js";
import { seedDemoAccount } from "./auth/seed-demo.js";
import { PrismaAuthService } from "./auth/service.js";
import { loadDatabaseConfig } from "./config.js";
import { createPrismaClient } from "./database.js";
import { PrismaIncidentRepository } from "./incidents/prisma-repository.js";
import { PrismaServiceRepository } from "./services/prisma-repository.js";

test("public demo seed is repeatable, permits incident work, and cannot administer access", {
  skip: process.env.RUN_DATABASE_TESTS !== "true",
}, async () => {
  const prisma = createPrismaClient(loadDatabaseConfig().DATABASE_URL);
  const organizationId = randomUUID();
  const teamId = randomUUID();
  const serviceId = randomUUID();
  const account = { ...publicDemoAccount("dev"), id: randomUUID(), email: `demo-${randomUUID()}@example.com` };
  const pepper = Buffer.alloc(32, 5);
  const app = buildApp({
    authService: new PrismaAuthService(prisma, pepper),
    incidentRepository: new PrismaIncidentRepository(prisma),
    serviceRepository: new PrismaServiceRepository(prisma),
    logger: false,
  });
  try {
    await prisma.organization.create({ data: { id: organizationId, name: "Demo test", slug: `demo-${organizationId}` } });
    await prisma.team.create({ data: { id: teamId, organizationId, name: "Platform", slug: "platform" } });
    await prisma.service.create({ data: { id: serviceId, organizationId, ownerTeamId: teamId, name: "Demo API", slug: "demo-api", type: "API" } });
    await seedDemoAccount(prisma, account, organizationId, teamId, pepper);
    await seedDemoAccount(prisma, account, organizationId, teamId, pepper);
    assert.equal(await prisma.user.count({ where: { email: account.email } }), 1);
    assert.equal(await prisma.teamMembership.count({ where: { userId: account.id } }), 1);
    const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: account.email, password: account.password } });
    assert.equal(login.statusCode, 200);
    const headers = { authorization: `Session ${login.json().session.token}` };
    const context = login.json().session.context;
    assert.equal(context.role, "responder");
    assert.ok(context.permissions.includes("incidents.manage"));
    assert.ok(!context.permissions.includes("members.manage"));
    assert.ok(!context.permissions.includes("services.manage"));
    const invitation = await app.inject({ method: "POST", url: "/v1/invitations", headers, payload: { email: "visitor@example.com", role: "admin" } });
    assert.equal(invitation.statusCode, 403);
    const promote = await app.inject({ method: "PATCH", url: `/v1/members/${account.id}`, headers, payload: { role: "owner" } });
    assert.equal(promote.statusCode, 403);
    const incident = await app.inject({ method: "POST", url: "/v1/incidents", headers, payload: { title: "Demo incident", teamId, serviceIds: [serviceId] } });
    assert.equal(incident.statusCode, 201, incident.body);
    // A collision with a privileged account must leave its password and role intact.
    await prisma.organizationMembership.update({ where: { organizationId_userId: { organizationId, userId: account.id } }, data: { role: "ADMIN" } });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    await assert.rejects(seedDemoAccount(prisma, account, organizationId, teamId, pepper), /refuses to overwrite/);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).passwordHash, before.passwordHash);
  } finally {
    await app.close();
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: account.id } });
    await prisma.$disconnect();
  }
});
