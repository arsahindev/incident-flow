import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createPrismaClient } from "./database.js";
import { loadDatabaseConfig } from "./config.js";

test("Vercel-managed pool supports concurrent queries and transaction rollback", {
  skip: process.env.RUN_DATABASE_TESTS !== "true",
}, async () => {
  const prisma = createPrismaClient(loadDatabaseConfig().DATABASE_URL, { vercel: true });
  const id = randomUUID();
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => prisma.$queryRaw`SELECT 1 AS value`));
    for (const result of results) assert.deepEqual(result, [{ value: 1 }]);
    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.organization.create({ data: { id, slug: `pool-test-${id}`, name: "Pool test" } });
      throw new Error("intentional rollback");
    }), /intentional rollback/);
    assert.equal(await prisma.organization.count({ where: { id } }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
