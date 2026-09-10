import type { RealtimeIncidentSignal } from "@incidentflow/contracts";

export interface RealtimeMetrics {
  connectionOpened(): void;
  connectionClosed(): void;
  authenticationRejected(): void;
  roomJoined(roomType: "organization" | "incident" | "user"): void;
  roomRejected(reason: "invalid_request" | "permission_denied" | "room_limit"): void;
  signalPublished(type: RealtimeIncidentSignal["type"]): void;
  signalDropped(reason: "invalid_payload" | "payload_too_large" | "backpressure"): void;
  sessionDisconnected(): void;
}

export class NoopRealtimeMetrics implements RealtimeMetrics {
  connectionOpened() {}
  connectionClosed() {}
  authenticationRejected() {}
  roomJoined() {}
  roomRejected() {}
  signalPublished() {}
  signalDropped() {}
  sessionDisconnected() {}
}

export type RealtimeMetricsSnapshot = {
  activeConnections: number;
  openedConnections: number;
  closedConnections: number;
  rejectedAuthentications: number;
  joinedRooms: Record<"organization" | "incident" | "user", number>;
  rejectedRooms: Record<"invalid_request" | "permission_denied" | "room_limit", number>;
  publishedSignals: number;
  droppedSignals: Record<
    "invalid_payload" | "payload_too_large" | "backpressure",
    number
  >;
  disconnectedSessions: number;
};

export class InMemoryRealtimeMetrics implements RealtimeMetrics {
  private readonly state: RealtimeMetricsSnapshot = {
    activeConnections: 0,
    openedConnections: 0,
    closedConnections: 0,
    rejectedAuthentications: 0,
    joinedRooms: { organization: 0, incident: 0, user: 0 },
    rejectedRooms: {
      invalid_request: 0,
      permission_denied: 0,
      room_limit: 0,
    },
    publishedSignals: 0,
    droppedSignals: {
      invalid_payload: 0,
      payload_too_large: 0,
      backpressure: 0,
    },
    disconnectedSessions: 0,
  };

  connectionOpened() {
    this.state.activeConnections += 1;
    this.state.openedConnections += 1;
  }

  connectionClosed() {
    this.state.activeConnections = Math.max(0, this.state.activeConnections - 1);
    this.state.closedConnections += 1;
  }

  authenticationRejected() {
    this.state.rejectedAuthentications += 1;
  }

  roomJoined(roomType: "organization" | "incident" | "user") {
    this.state.joinedRooms[roomType] += 1;
  }

  roomRejected(reason: "invalid_request" | "permission_denied" | "room_limit") {
    this.state.rejectedRooms[reason] += 1;
  }

  signalPublished() {
    this.state.publishedSignals += 1;
  }

  signalDropped(reason: "invalid_payload" | "payload_too_large" | "backpressure") {
    this.state.droppedSignals[reason] += 1;
  }

  sessionDisconnected() {
    this.state.disconnectedSessions += 1;
  }

  snapshot(): RealtimeMetricsSnapshot {
    return structuredClone(this.state);
  }
}
