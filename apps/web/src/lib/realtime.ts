import z from "zod";

import type { RealtimeIncidentSignal } from "@incidentflow/contracts";

export const socketConnectionStatuses = ["connecting", "connected", "disconnected"] as const;
export const socketConnectionStatusSchema = z.enum(socketConnectionStatuses);
export type SocketConnectionStatus = z.infer<typeof socketConnectionStatusSchema>;

export function synchronizeIncidentVersions(
  latestVersions: Map<string, number>,
  canonicalVersions: ReadonlyArray<{ id: string; version: number }>,
) {
  for (const incident of canonicalVersions) {
    const current = latestVersions.get(incident.id) ?? 0;
    if (incident.version > current) latestVersions.set(incident.id, incident.version);
  }
}

export function acceptRealtimeIncidentSignal(
  latestVersions: Map<string, number>,
  signal: RealtimeIncidentSignal,
) {
  const current = latestVersions.get(signal.incidentId) ?? 0;
  if (signal.incidentVersion <= current) return false;
  latestVersions.set(signal.incidentId, signal.incidentVersion);
  return true;
}
