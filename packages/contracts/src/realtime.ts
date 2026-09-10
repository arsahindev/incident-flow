import { z } from "zod";

export const socketConnectionStatuses = ["connecting", "connected", "disconnected"] as const;
export const socketConnectionStatusSchema = z.enum(socketConnectionStatuses);
export type SocketConnectionStatus = z.infer<typeof socketConnectionStatusSchema>;

export const realtimeIncidentSignalTypes = [
  "incident.created",
  "incident.status_changed",
  "incident.assignment_changed",
  "incident.affected_services_changed",
  "incident.activity_updated",
] as const;
export const realtimeIncidentSignalTypeSchema = z.enum(realtimeIncidentSignalTypes);
export type RealtimeIncidentSignalType = z.infer<typeof realtimeIncidentSignalTypeSchema>;


export const realtimeIncidentSignalSchema = z.object({
  schemaVersion: z.literal(1),
  type: realtimeIncidentSignalTypeSchema,
  incidentId: z.uuid(),
  incidentVersion: z.number().int().positive(),
  occurredAt: z.iso.datetime(),
});
export type RealtimeIncidentSignal = z.infer<typeof realtimeIncidentSignalSchema>;

export const realtimeJoinIncidentRequestSchema = z
  .object({ incidentId: z.uuid() })
  .strict();
export type RealtimeJoinIncidentRequest = z.infer<
  typeof realtimeJoinIncidentRequestSchema
>;

export const realtimeJoinIncidentResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["invalid_request", "permission_denied", "room_limit"]),
  }),
]);
export type RealtimeJoinIncidentResult = z.infer<
  typeof realtimeJoinIncidentResultSchema
>;

export const realtimeSessionRevokedSignalSchema = z.object({
  reason: z.literal("session_revoked"),
});
export type RealtimeSessionRevokedSignal = z.infer<
  typeof realtimeSessionRevokedSignalSchema
>;
