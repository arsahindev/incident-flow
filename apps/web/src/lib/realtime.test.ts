import assert from "node:assert/strict";
import { test } from "node:test";

import type { RealtimeIncidentSignal } from "@incidentflow/contracts";

import {
  acceptRealtimeIncidentSignal,
  synchronizeIncidentVersions,
} from "./realtime.js";

const incidentId = "33333333-3333-4333-8333-333333333333";

function signal(version: number): RealtimeIncidentSignal {
  return {
    schemaVersion: 1,
    type: "incident.status_changed",
    incidentId,
    incidentVersion: version,
    occurredAt: "2026-08-27T12:00:00.000Z",
  };
}

test("realtime incident signals reject duplicate and stale versions", () => {
  const versions = new Map([[incidentId, 4]]);

  assert.equal(acceptRealtimeIncidentSignal(versions, signal(3)), false);
  assert.equal(acceptRealtimeIncidentSignal(versions, signal(4)), false);
  assert.equal(acceptRealtimeIncidentSignal(versions, signal(5)), true);
  assert.equal(versions.get(incidentId), 5);
});

test("canonical refetch versions never move the client sequence backwards", () => {
  const versions = new Map([[incidentId, 5]]);
  synchronizeIncidentVersions(versions, [{ id: incidentId, version: 4 }]);
  assert.equal(versions.get(incidentId), 5);

  synchronizeIncidentVersions(versions, [{ id: incidentId, version: 6 }]);
  assert.equal(versions.get(incidentId), 6);
});
