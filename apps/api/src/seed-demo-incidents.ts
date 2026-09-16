import { createHash } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client.js";

const exampleIncidents = [
  {
    title: "Checkout requests timing out",
    description:
      "Fictional scenario: checkout latency increased after a release. Investigate the upstream payment timeout and compare the previous deployment.",
    services: ["checkout-api", "payment-processing"],
    priority: "CRITICAL",
    status: "OPEN",
    hoursAgo: 2,
  },
  {
    title: "Payment provider intermittently declining requests",
    description:
      "Fictional scenario: a small number of payment authorizations are failing. The response team is comparing provider responses and retry behavior.",
    services: ["payment-processing", "stripe"],
    priority: "HIGH",
    status: "ACKNOWLEDGED",
    hoursAgo: 5,
  },
  {
    title: "Customer portal pages loading slowly",
    description:
      "Fictional scenario: customers report slow account pages. Check the portal request traces and database query timings.",
    services: ["customer-portal", "postgresql-primary"],
    priority: "MEDIUM",
    status: "OPEN",
    hoursAgo: 8,
  },
  {
    title: "Database connection pool approaching capacity",
    description:
      "Fictional scenario: the response team is investigating long-running queries and connection reuse before changing pool limits.",
    services: ["postgresql-primary", "checkout-api"],
    priority: "HIGH",
    status: "ACKNOWLEDGED",
    hoursAgo: 12,
  },
  {
    title: "Checkout deployment regression recovered",
    description:
      "Fictional scenario: rolling back a request-validation change restored successful checkouts. A regression test is planned before the next release.",
    services: ["checkout-api"],
    priority: "HIGH",
    status: "RESOLVED",
    hoursAgo: 30,
  },
  {
    title: "Portal static asset cache refreshed",
    description:
      "Fictional scenario: an outdated asset cache caused a minor display issue. Refreshing the cache restored the expected layout.",
    services: ["customer-portal"],
    priority: "LOW",
    status: "RESOLVED",
    hoursAgo: 48,
  },
] as const;

export async function seedDemoIncidents(
  prisma: PrismaClient,
  organizationId: string,
  teamId: string,
  actorUserId: string,
) {
  const services = await prisma.service.findMany({ where: { organizationId } });

  for (const exampleIncident of exampleIncidents) {
    const serviceIds = exampleIncident.services.map((slug) => {
      const service = services.find((candidate) => candidate.slug === slug);
      if (!service)
        throw new Error(`Demo incident seed requires service ${slug}`);
      return service.id;
    });

    const digest = createHash("sha256")
      .update(`${organizationId}:demo:${exampleIncident.title}`)
      .digest("hex");
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const createdAt = new Date(
      Date.now() - exampleIncident.hoursAgo * 3_600_000,
    );
    const changedAt = new Date(createdAt.getTime() + 3_600_000);
    const transitioned = exampleIncident.status !== "OPEN";
    // Stable organization-scoped identities make reruns safe. Existing visitor
    // edits, versions, and activity are intentionally left untouched.
    await prisma.incident.upsert({
      where: { organizationId_id: { organizationId, id } },
      update: {},
      create: {
        id,
        organizationId,
        teamId,
        title: exampleIncident.title,
        description: exampleIncident.description,
        priority: exampleIncident.priority,
        status: exampleIncident.status,
        version: transitioned ? 2 : 1,
        createdAt,
        updatedAt: transitioned ? changedAt : createdAt,
        resolvedAt: exampleIncident.status === "RESOLVED" ? changedAt : null,
        affectedServices: {
          create: serviceIds.map((serviceId, index) => ({
            serviceId,
            isPrimary: index === 0,
            createdAt,
          })),
        },
        activity: {
          create: [
            {
              actorUserId,
              type: "CREATED",
              message: "Created a fictional portfolio demonstration incident.",
              createdAt,
            },
            ...(transitioned
              ? [
                  {
                    actorUserId,
                    type: "STATUS_CHANGED" as const,
                    fromValue: "OPEN",
                    toValue: exampleIncident.status,
                    message: `Demo response moved the incident to ${exampleIncident.status.toLowerCase()}.`,
                    createdAt: changedAt,
                  },
                ]
              : []),
          ],
        },
      },
    });
  }
}
