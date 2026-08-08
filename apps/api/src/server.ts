import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPrismaClient } from "./database.js";
import { PrismaIncidentRepository } from "./incidents/prisma-repository.js";

const config = loadConfig();
const prisma = createPrismaClient(config.DATABASE_URL);
const app = buildApp({
  incidentRepository: new PrismaIncidentRepository(prisma),
  organizationSlug: config.DEVELOPMENT_ORGANIZATION_SLUG,
  webOrigin: config.WEB_ORIGIN,
});

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
