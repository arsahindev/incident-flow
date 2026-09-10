import type { RealtimeIncidentSignal } from "@incidentflow/contracts";

export interface RealtimePublisher {
  publishIncidentSignal(
    organizationId: string,
    incidentId: string,
    signal: RealtimeIncidentSignal,
  ): Promise<void>;
}

export class NoopRealtimePublisher implements RealtimePublisher {
  async publishIncidentSignal() {}
}

export interface RealtimeSessionRevoker {
  disconnectSession(sessionId: string): Promise<void>;
  disconnectUser(organizationId: string, userId: string): Promise<void>;
}

export class NoopRealtimeSessionRevoker implements RealtimeSessionRevoker {
  async disconnectSession() {}
  async disconnectUser() {}
}
