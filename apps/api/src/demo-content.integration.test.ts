import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadDatabaseConfig } from "./config.js";
import { createPrismaClient } from "./database.js";
import { seedDemoIncidents } from "./seed-demo-incidents.js";

test("demo incidents have service links and history, and reseeding preserves visitor edits", {
  skip: process.env.RUN_DATABASE_TESTS !== "true",
}, async () => {
  const prisma = createPrismaClient(loadDatabaseConfig().DATABASE_URL);
  const organizationId = randomUUID();
  const actorUserId = randomUUID();
  const teamId = randomUUID();
  try {
    await prisma.organization.create({ data: { id: organizationId, name: "Demo content test", slug: `demo-content-${organizationId}` } });
    await prisma.user.create({ data: { id: actorUserId, email: `${actorUserId}@example.com`, displayName: "Demo", passwordHash: "unused-test-account" } });
    await prisma.team.create({ data: { id: teamId, organizationId, name: "Platform", slug: "platform" } });
    await prisma.service.createMany({ data: ["checkout-api", "payment-processing", "stripe", "customer-portal", "postgresql-primary"].map((slug) => ({ organizationId, ownerTeamId: teamId, name: slug, slug, type: "API" as const })) });
    await seedDemoIncidents(prisma, organizationId, teamId, actorUserId);
    const incidents = await prisma.incident.findMany({ where: { organizationId }, include: { affectedServices: true, activity: true } });
    assert.equal(incidents.length, 6);
    assert.deepEqual([...new Set(incidents.map((incident) => incident.status))].sort(), ["ACKNOWLEDGED", "OPEN", "RESOLVED"]);
    for (const incident of incidents) {
      assert.equal(incident.affectedServices.filter((service) => service.isPrimary).length, 1);
      assert.equal(incident.activity.length, incident.version);
      assert.equal(incident.resolvedAt !== null, incident.status === "RESOLVED");
    }
    const edited = incidents[0]!;
    await prisma.incident.update({ where: { id: edited.id }, data: { title: "Visitor edit", version: { increment: 1 } } });
    await seedDemoIncidents(prisma, organizationId, teamId, actorUserId);
    assert.equal(await prisma.incident.count({ where: { organizationId } }), 6);
    const preserved = await prisma.incident.findUniqueOrThrow({ where: { id: edited.id } });
    assert.equal(preserved.title, "Visitor edit");
    assert.equal(preserved.version, edited.version + 1);
    assert.equal(await prisma.incidentActivity.count({ where: { organizationId } }), 10);
  } finally {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: actorUserId } });
    await prisma.$disconnect();
  }
});
