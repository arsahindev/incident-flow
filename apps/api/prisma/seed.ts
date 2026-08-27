import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
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

const developmentOwner = {
  id: "88888888-8888-4888-8888-888888888888",
  email: "admin@incidentflow.local",
  displayName: "IncidentFlow Admin",
  password: "IncidentFlow-Dev-2026!",
};

const services = [
  {
    id: "55555555-5555-4555-8555-555555555551",
    name: "Checkout API",
    slug: "checkout-api",
    description: "Coordinates customer checkout and order submission.",
    type: "API" as const,
    tier: "CRITICAL" as const,
    environments: ["staging", "production"],
  },
  {
    id: "55555555-5555-4555-8555-555555555552",
    name: "Payment Processing",
    slug: "payment-processing",
    description: "Authorizes and captures customer payments.",
    type: "BUSINESS" as const,
    tier: "CRITICAL" as const,
    environments: ["production"],
  },
  {
    id: "55555555-5555-4555-8555-555555555553",
    name: "Customer Portal",
    slug: "customer-portal",
    description: "Customer-facing web application.",
    type: "APPLICATION" as const,
    tier: "HIGH" as const,
    environments: ["staging", "production"],
  },
  {
    id: "55555555-5555-4555-8555-555555555554",
    name: "PostgreSQL Primary",
    slug: "postgresql-primary",
    description: "Primary transactional PostgreSQL database.",
    type: "INFRASTRUCTURE" as const,
    tier: "CRITICAL" as const,
    environments: ["production"],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Stripe",
    slug: "stripe",
    description: "External payment provider dependency.",
    type: "EXTERNAL" as const,
    tier: "CRITICAL" as const,
    environments: ["production"],
  },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: developmentOrganization.slug },
    update: { name: developmentOrganization.name },
    create: developmentOrganization,
  });

  const team = await prisma.team.upsert({
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

  const passwordHash = await hash(developmentOwner.password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const owner = await prisma.user.upsert({
    where: { email: developmentOwner.email },
    update: {
      displayName: developmentOwner.displayName,
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      id: developmentOwner.id,
      email: developmentOwner.email,
      displayName: developmentOwner.displayName,
      passwordHash,
    },
  });
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: { organizationId: organization.id, userId: owner.id },
    },
    update: { role: "OWNER", status: "ACTIVE" },
    create: {
      organizationId: organization.id,
      userId: owner.id,
      role: "OWNER",
    },
  });
  await prisma.teamMembership.upsert({
    where: {
      organizationId_teamId_userId: {
        organizationId: organization.id,
        teamId: team.id,
        userId: owner.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      teamId: team.id,
      userId: owner.id,
    },
  });

  for (const [serviceIndex, serviceDefinition] of services.entries()) {
    const service = await prisma.service.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: serviceDefinition.slug,
        },
      },
      update: {
        name: serviceDefinition.name,
        description: serviceDefinition.description,
        type: serviceDefinition.type,
        tier: serviceDefinition.tier,
        ownerTeamId: team.id,
        archivedAt: null,
      },
      create: {
        id: serviceDefinition.id,
        organizationId: organization.id,
        ownerTeamId: team.id,
        name: serviceDefinition.name,
        slug: serviceDefinition.slug,
        description: serviceDefinition.description,
        type: serviceDefinition.type,
        tier: serviceDefinition.tier,
      },
    });

    for (const [environmentIndex, environmentName] of serviceDefinition.environments.entries()) {
      await prisma.serviceEnvironment.upsert({
        where: {
          organizationId_serviceId_slug: {
            organizationId: organization.id,
            serviceId: service.id,
            slug: environmentName,
          },
        },
        update: {
          name: environmentName[0]!.toUpperCase() + environmentName.slice(1),
          kind: environmentName === "production" ? "PRODUCTION" : "STAGING",
          status: "ACTIVE",
        },
        create: {
          id: `66666666-6666-4666-8666-${String(serviceIndex + 1).padStart(6, "0")}${String(environmentIndex + 1).padStart(6, "0")}`,
          organizationId: organization.id,
          serviceId: service.id,
          name: environmentName[0]!.toUpperCase() + environmentName.slice(1),
          slug: environmentName,
          kind: environmentName === "production" ? "PRODUCTION" : "STAGING",
        },
      });
    }
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
