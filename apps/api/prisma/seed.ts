import { PrismaPg } from "@prisma/adapter-pg";

import { publicDemoAccount } from "@incidentflow/contracts";
import { PrismaClient } from "../src/generated/prisma/client.js";

import { hashPassword } from "../src/auth/passwords.js";
import { seedDemoAccount } from "../src/auth/seed-demo.js";
import { seedDemoIncidents } from "../src/seed-demo-incidents.js";
import { loadSeedConfig } from "../src/config.js";

const {
  DATABASE_URL: databaseUrl,
  PASSWORD_PEPPER: passwordPepper,
  PUBLIC_DEMO_ENVIRONMENT: demoEnvironment,
} = loadSeedConfig();
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

function optionalEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

const seedEmail = optionalEnvironmentValue("SEED_OWNER_EMAIL");
const seedPassword = optionalEnvironmentValue("SEED_OWNER_PASSWORD");
if ((seedEmail === undefined) !== (seedPassword === undefined)) {
  throw new Error(
    "SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be configured together",
  );
}

const developmentOrganization = {
  id: "11111111-1111-4111-8111-111111111111",
  name:
    optionalEnvironmentValue("SEED_ORGANIZATION_NAME") ??
    "IncidentFlow Development",
  slug:
    optionalEnvironmentValue("SEED_ORGANIZATION_SLUG") ?? "incidentflow-dev",
};

const platformTeam = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Platform",
  slug: "platform",
};

const developmentOwner = {
  id: "88888888-8888-4888-8888-888888888888",
  email: seedEmail ?? "admin@incidentflow.local",
  displayName: "IncidentFlow Admin",
  password: seedPassword ?? "IncidentFlow-Dev-2026!",
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

  const passwordHash = await hashPassword(
    developmentOwner.password,
    passwordPepper,
  );
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
      organizationId_userId: {
        organizationId: organization.id,
        userId: owner.id,
      },
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

  if (demoEnvironment) {
    await seedDemoAccount(
      prisma,
      publicDemoAccount(demoEnvironment),
      organization.id,
      team.id,
      passwordPepper,
    );
  }

  for (const [serviceIndex, serviceDefinition] of services.entries()) {
    const service = await prisma.service.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: serviceDefinition.slug,
        },
      },
      update: {},
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

    for (const [
      environmentIndex,
      environmentName,
    ] of serviceDefinition.environments.entries()) {
      await prisma.serviceEnvironment.upsert({
        where: {
          organizationId_serviceId_slug: {
            organizationId: organization.id,
            serviceId: service.id,
            slug: environmentName,
          },
        },
        update: {},
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
  if (demoEnvironment) {
    await seedDemoIncidents(
      prisma,
      organization.id,
      team.id,
      publicDemoAccount(demoEnvironment).id,
    );
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
