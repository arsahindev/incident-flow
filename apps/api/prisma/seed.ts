import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client.js";

config({ path: "../../.env", quiet: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://incidentflow:incidentflow_dev@localhost:5432/incidentflow";
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const developmentOrganization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "IncidentFlow Development",
  slug: "incidentflow-dev",
};

const platformTeam = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Platform",
  slug: "platform",
};

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: developmentOrganization.slug },
    update: { name: developmentOrganization.name },
    create: developmentOrganization,
  });

  await prisma.team.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: platformTeam.slug,
      },
    },
    update: { name: platformTeam.name },
    create: {
      ...platformTeam,
      organizationId: organization.id,
    },
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
