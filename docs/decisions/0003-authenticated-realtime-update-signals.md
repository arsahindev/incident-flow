# ADR 0003: Authenticated realtime update signals

- Status: Accepted
- Date: 2026-08-27
- Milestone: Phase 3

## Context

Incident responders need to see incident creation and coordination changes without manually reloading the dashboard. The existing security model keeps an opaque server-managed session in an `HttpOnly` cookie owned by the Next.js backend-for-frontend, so browser JavaScript cannot safely place that token in Socket.IO's `auth` payload. Realtime delivery must also remain replaceable by a later AWS transport and must not become a second source of incident truth.

## Decision

Place Socket.IO behind application ports and use small, versioned update signals.

- Incident application services depend on `RealtimePublisher`; they never import Socket.IO or room-name syntax. `SocketIoRealtimeAdapter` is the local transport and `NoopRealtimePublisher` keeps ordinary tests deterministic.
- Repositories commit the incident, its affected-service relationships, audit record, activity records, and monotonic incident-version increment before the application service publishes. Publication is best-effort and cannot turn an already committed HTTP mutation into a failed command.
- Signals contain `schemaVersion`, event type, incident ID, incident version, and occurrence timestamp. They deliberately omit canonical incident state. The browser runtime-validates a shared Zod contract, rejects a signal whose incident version is not newer than the latest observed version, and calls `router.refresh()` to refetch the authenticated API.
- A transport reconnect always triggers a canonical refetch. Socket.IO connection-state replay is not treated as a recovery guarantee.
- The Socket.IO handshake reads the existing `incidentflow_session` cookie on the server and calls the same session authentication service as HTTP requests. The engine rejects any handshake whose `Origin` does not exactly equal `WEB_ORIGIN`. The raw session token is never serialized into client props or browser JavaScript.
- Authenticated sockets automatically join only their server-derived `organization:{organizationId}` and `user:{userId}` rooms. An incident room join accepts only an incident UUID; a server-side authorizer verifies `incidents.read` and an incident in the authenticated organization. Clients cannot choose organization or user room identifiers.
- Logout and organization switching disconnect the old session after database revocation. Suspending a membership disconnects that organization's sockets for the user. Periodic authentication and reauthentication before incident joins fail closed if sessions are independently revoked, expired, disabled, or suspended.
- Inbound Socket.IO messages are capped at 4 KiB by default, outbound signals at 1 KiB, and each socket may join at most ten incident rooms. Per-message deflate is disabled. The local publisher uses volatile delivery, drops signals for an unwritable or over-buffered transport, and disconnects a client after repeated backpressure drops.
- `RealtimeMetrics` separates counters from the transport implementation. The initial in-memory/no-op implementations expose seams for active/opened/closed connections, authentication rejection, room joins/rejections, published/dropped signals, and revocation disconnections without selecting a metrics vendor in Phase 3.

## Consequences

- A missed or dropped signal does not lose business data; reconnect and ordinary navigation recover through the canonical API.
- Realtime publication is not a durable domain-event guarantee. A process crash after commit but before emit may delay the UI until its next refetch. Transactional outbox durability belongs to Phase 5 and must not be claimed here.
- The current Socket.IO adapter and room registry are single-process. Horizontal scaling would require a compatible shared adapter or replacement transport behind the existing publisher interface, plus an intentional fan-out design.
- Cookie authentication requires the production socket endpoint to be exposed on a host/path where the web cookie is available, normally a same-origin reverse proxy. Strict origin validation remains mandatory because WebSocket upgrades are not protected by ordinary HTTP CORS alone.
- Backpressure favors bounded server resources and canonical recovery over guaranteed delivery of every intermediate signal.
