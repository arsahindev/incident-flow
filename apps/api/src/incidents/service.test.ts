import assert from "node:assert/strict";
import { test } from "node:test";

import type { RealtimeIncidentSignal } from "@incidentflow/contracts";

import {
  NoopRealtimePublisher,
  type RealtimePublisher,
} from "../realtime/publisher.js";
import { ownerTestAuthContext } from "../test-auth-context.js";
import type { IncidentRepository } from "./repository.js";
import { IncidentApplicationService } from "./service.js";
import type { IncidentDetailRecord, IncidentMutationResult } from "./types.js";

const incidentId = "33333333-3333-4333-8333-333333333333";

function incident(version = 1): IncidentDetailRecord {
  return {
    id: incidentId,
    title: "Checkout API unavailable",
    description: null,
    status: "open",
    priority: "high",
    team: null,
    affectedServices: [],
    version,
    resolvedAt: null,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:01:00.000Z",
    activity: [],
  };
}

function repository(result: IncidentMutationResult): IncidentRepository {
  return {
    async listTeams() {
      return [];
    },
    async listIncidents() {
      return {
        incidents: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
      };
    },
    async getIncident() {
      return result.incident;
    },
    async createIncident() {
      return result;
    },
    async updateIncident() {
      return result;
    },
  };
}

test("incident application service publishes versioned signals after persistence", async () => {
  const publications: Array<{
    organizationId: string;
    incidentId: string;
    signal: RealtimeIncidentSignal;
  }> = [];
  const publisher: RealtimePublisher = {
    async publishIncidentSignal(organizationId, publishedIncidentId, signal) {
      publications.push({
        organizationId,
        incidentId: publishedIncidentId,
        signal,
      });
    },
  };
  const service = new IncidentApplicationService(
    repository({
      incident: incident(7),
      changes: ["status", "assignment", "affected_services", "activity"],
    }),
    publisher,
  );

  const updated = await service.updateIncident(
    ownerTestAuthContext,
    incidentId,
    {
      status: "acknowledged",
    },
  );

  assert.equal(updated.version, 7);
  assert.deepEqual(
    publications.map((publication) => publication.signal.type),
    [
      "incident.status_changed",
      "incident.assignment_changed",
      "incident.affected_services_changed",
      "incident.activity_updated",
    ],
  );
  assert.ok(
    publications.every(
      (publication) =>
        publication.organizationId === ownerTestAuthContext.organizationId &&
        publication.incidentId === incidentId &&
        publication.signal.incidentVersion === 7,
    ),
  );
});

test("no-op publishing and publication failures never undo a committed mutation", async () => {
  const committed = { incident: incident(2), changes: ["status"] } as const;
  const noopService = new IncidentApplicationService(
    repository({
      incident: committed.incident,
      changes: [...committed.changes],
    }),
    new NoopRealtimePublisher(),
  );
  assert.equal(
    (await noopService.updateIncident(ownerTestAuthContext, incidentId, {}))
      .version,
    2,
  );

  const failures: unknown[] = [];
  const failingService = new IncidentApplicationService(
    repository({
      incident: committed.incident,
      changes: [...committed.changes],
    }),
    {
      async publishIncidentSignal() {
        throw new Error("transport unavailable");
      },
    },
    (error) => failures.push(error),
  );
  assert.equal(
    (await failingService.updateIncident(ownerTestAuthContext, incidentId, {}))
      .version,
    2,
  );
  assert.equal(failures.length, 1);
});
