# Current architecture and engineering requirements

Read the relevant section when changing runtime behavior, persistence, contracts,
authentication or realtime. Apply the security/correctness criteria below to
every affected boundary; they are mandatory, not optional future hardening.
This describes the repository as inspected on 2026-09-16. External deployment
observations are dated evidence in [production verification](production-verification.md),
not a live guarantee. [Product requirements](product-domain.md) own domain meaning;
[the roadmap](roadmap.md) owns unimplemented features and future system designs.

## Implemented system

Phases 0–3 deliver manual incident coordination, a service catalog and environments,
affected-service links, identity/membership administration, auditable activity,
URL-backed filters/pagination, and authenticated realtime updates. New incidents
require at least one affected service; older development incidents may remain
unclassified rather than receive invented history. Service ownership and incident
coordination remain distinct. Account recovery and webhook intake are not implemented.

| Concern | Current implementation and rationale |
| --- | --- |
| Workspace | pnpm 11.20.0, Node 24.x; workspace scripts suffice without Turborepo |
| Web | Next.js 16, TypeScript, Tailwind; familiar modern frontend stack |
| API | Fastify 5, TypeScript, Zod; explicit HTTP and application boundaries |
| Database | PostgreSQL with Prisma 7/pg adapter; local Docker, hosted Neon |
| HTTP client | Native fetch and tested response parser; no general HTTP-client abstraction |
| Local realtime | Socket.IO, practical rooms and reconnects, single-process state |
| Hosted realtime | Ably adapter behind the same application ports |
| Hosting | Two Vercel projects for one production environment; see the hosting runbook |
| CI | GitHub Actions quality job and main-only production job; activation needs external evidence |

The schema currently contains users, organizations, teams, memberships, sessions,
invitations, login throttles, audit logs, services/environments, incidents,
affected-service joins and incident activity. Five committed migrations establish
organization-scoped constraints, environment-expiry rules and positive monotonic
incident versions. Inspect the relevant schema/migrations when changing invariants.
No worker, alert inbox, outbox, queue or AI subsystem is implemented.

## Repository navigation

- `apps/web/src/`: Next.js UI, server actions and server-only API boundary.
- `apps/api/src/`: Fastify auth, incidents, services, repositories and realtime adapters.
- `apps/api/prisma/`: schema, migrations and idempotent seeds.
- `apps/api/api/index.ts`: Vercel entry; `src/server.ts` starts the local listener.
- `packages/contracts/src/`: shared errors, identity, incidents, services, realtime and demo definitions.
- `.github/workflows/ci.yml`: actual quality and release behavior; read for CI work.
- `infra/`, root `Dockerfile`: retained container/AWS engineering assets; AWS deployment is disabled.
- [Identity ERD](../diagrams/auth.svg) — read when exploring identity relations.
- [Incident/service ERD](../diagrams/incident-and-service.svg) — read when exploring incident relations.

## Domain and application boundaries

Keep HTTP, domain/application logic, persistence, and external transports separable without creating needless microservices:

- Fastify route handlers authenticate/authorize, validate transport input, call application services, and map errors to HTTP responses.
- Application/domain services own incident transitions, authorization-relevant invariants, affected-service rules, timeline creation, and transactional behavior.
- Repository interfaces hide Prisma where a seam materially improves testing or future transport changes; do not wrap every ORM call mechanically.
- Shared Zod contracts define public API/event boundaries. Generated Prisma types are persistence types and must not become the public contract by accident.
- `packages/contracts` owns the coded error envelope and runtime identity/session, incident, service and realtime schemas. Move any remaining endpoint response contracts there when those boundaries change; do not create a speculative all-domain schema rewrite.
- The Next.js backend-for-frontend uses native `fetch`. Its shared parser consumes a response body once, handles `204`, rejects malformed or contract-invalid success responses, safely classifies non-JSON failures, and preserves HTTP status, stable error code, validation issues, and request ID in `ApiError`.
- Domain changes and their activity/outbox records should be committed atomically where consistency requires it.
- External effects—notifications, webhooks, AI calls, email, WebSockets, and broker publishing—must not occur inside a database transaction.
- Preserve ports for realtime publishing, event publishing, notification delivery, object storage, clock/ID generation where deterministic tests or provider replacement justify them.

## Realtime design

Core domain services must not import Socket.IO directly. Phase 3 implements this port:

```ts
interface RealtimePublisher {
  publishIncidentSignal(
    organizationId: string,
    incidentId: string,
    signal: RealtimeIncidentSignal
  ): Promise<void>;
}
```

Current implementations are:

- `SocketIoRealtimeAdapter` for local development.
- `AblyRealtimeAdapter` for hosted production. `ApiGatewayWebSocketPublisher` remains a future roadmap option.
- `NoopRealtimePublisher` for tests.

Server-derived Socket.IO rooms:

```text
organization:{organizationId}
incident:{incidentId}
user:{userId}
```

Phase 3 incident signals are `incident.created`, `incident.status_changed`, `incident.assignment_changed`, `incident.affected_services_changed`, and `incident.activity_updated`. They contain only a contract schema version, incident ID, monotonic incident version, and timestamp. Socket rooms, cookie parsing, origin checks, buffering policy, and Socket.IO types stay inside the adapter.

The Socket.IO handshake is the narrow ambient-cookie exception to the normal backend-for-frontend HTTP flow: it reads the existing `HttpOnly` session cookie server-side, requires the exact configured web origin, and reuses the authoritative session service. Organization and user rooms are joined only from authenticated context. Incident-room joins accept only an incident ID and reauthorize tenant membership and `incidents.read` server-side.

WebSocket events are fast, best-effort update signals, not the source of truth or durable domain events. Clients reject non-newer incident versions and refetch canonical API state after accepted signals and reconnects. Logout, organization switching, membership suspension, periodic session revalidation, bounded payloads/room counts, volatile backpressure drops, slow-client disconnection, and transport-neutral metrics seams are part of the Phase 3 boundary. See [ADR 0003](decisions/0003-authenticated-realtime-update-signals.md) when changing local transport/security semantics; [ADR 0005](decisions/0005-free-portfolio-hosting.md) records the hosted transport decision.

## Runtime configuration and hosting adapters

Configuration belongs to the consuming process: root `.env` is Docker Compose
PostgreSQL, `apps/api/.env` is Fastify/Prisma, and `apps/web/.env.local` is Next.js.
API and web have separate fail-fast Zod boundaries. Database/origin/API/realtime
URLs and the password pepper have no silent fallbacks; bounded listener/realtime
tuning retains safe defaults. Configuration errors omit values and must not be
misclassified as network errors. Prisma generation is install-safe; migration
and seed commands validate their own required inputs.

`NEXT_PUBLIC_REALTIME_URL` is validated at build and immutable in the browser
bundle: supply it consistently at build/startup. `API_URL` stays server-only.
The Next.js proxy checks cookie presence optimistically; Fastify remains the
session authority and rejects stale or invalid credentials. `/health` is liveness;
`/ready` checks PostgreSQL availability. [ADR 0001](decisions/0001-server-managed-sessions.md)
owns session/permission/password decisions, and
[ADR 0002](decisions/0002-native-fetch-and-api-contracts.md) owns HTTP error/parser decisions.
Read those ADRs when modifying their respective boundaries.

Hosted production selects `REALTIME_TRANSPORT=ably` and
`NEXT_PUBLIC_REALTIME_URL=ably`. Browser code lazily loads Ably and uses same-origin
`POST /api/realtime/token`; Next.js forwards an empty JSON object to Fastify
because a JSON content type with no body is rejected. The opaque cookie stays
on the web host; `ABLY_API_KEY` stays on the server. The adapter grants 60-second,
subscribe-only JWTs scoped to the authenticated organization. Logout/suspension
revoke by session client ID or organization/user revocation key; failed provider
revocation is bounded by token expiry. Refetch/version semantics remain unchanged.

The Vercel entry imports only Ably, avoiding local Socket.IO packaging diagnostics.
It reuses one initialized Fastify app per function instance and a pg pool with
maximum 5 connections, 5-second idle and 10-second connection timeouts, registered
with `attachDatabasePool`. Neon runtime connections use the pooled URI with
verified TLS; migrations use the direct URI. Configuration/deployment procedures
belong to [the hosting guide](free-demo-deployment.md); release ordering and
migration compatibility belong to [the release runbook](github-deployment.md).
Read them only when working on those operations.

## Cross-cutting production-readiness requirements

These are ongoing acceptance criteria, not one final “hardening sprint.” Apply each item when the relevant feature first appears. Future-feature criteria do not authorize building that feature. The test/release requirements below govern application and infrastructure changes; documentation-only work uses link/reference checks and `git diff --check`, without rerunning application tests or builds.

### Tenant isolation and authorization

- Never accept an `organization_id` from the browser as proof of tenant context.
- Derive organization/user context from the authenticated session/token and verify membership server-side.
- Scope every tenant-owned query and mutation by organization; prefer composite organization-scoped constraints and foreign keys as defense in depth.
- Define a permission matrix for roles and high-impact actions. A UI-hidden button is not authorization.
- Test cross-tenant access attempts, insecure direct-object references, role boundaries, disabled users, and revoked sessions.
- Record actor identity and request/correlation ID for material audit events once identity exists.

### API and application security

- Validate path, query, headers, and bodies with strict schemas; enforce maximum sizes and reject unknown/unsafe shapes where appropriate.
- Centralize safe error mapping; do not leak stack traces, connection details, secrets, or raw provider responses.
- API failures use `{ error: { code, message, issues?, requestId } }`; every response exposes the same request ID in `X-Request-Id`. UI behavior should branch on stable codes/status rather than matching human-readable messages.
- Use secure cookies or carefully scoped tokens, CSRF protection where cookie authentication requires it, password hashing through an established library, session rotation/revocation, and login rate limiting.
- Apply HMAC verification to raw webhook bytes, timing-safe comparison, replay windows, secret rotation, and idempotency constraints.
- Validate outbound destinations and defend against SSRF, DNS rebinding, private/link-local addresses, redirect abuse, and oversized/slow responses.
- Add dependency/security scanning, secret scanning, locked dependencies, and a documented vulnerability-handling process in CI.

### Reliability and consistency

- Make state transitions explicit and transactionally record the corresponding activity/domain event.
- Use idempotency keys or natural unique constraints for externally retried commands.
- Put timeouts on network calls and database operations where supported; propagate cancellation when practical.
- Classify retryable versus permanent failures. Use capped exponential backoff with jitter, limited attempts, and DLQ/permanent-failure visibility.
- Treat queues and brokers as at-least-once. Consumers must be idempotent; never claim exactly-once processing.
- Provide safe replay/retry tooling with permissions and an audit trail rather than relying on manual database edits.
- Document backup, restore, migration rollback/roll-forward, and disaster-recovery expectations before calling the cloud deployment production-like.

### Observability and operability

- Emit structured logs with timestamp, level, service, environment, request ID, trace/correlation ID, organization ID where safe, route/job name, duration, outcome, and sanitized error classification.
- Add HTTP request metrics, latency/error rates, database-pool saturation, queue age/depth, retry counts, DLQ counts, webhook delivery outcomes, WebSocket connection counts, and AI usage/cost when relevant.
- Add distributed tracing across API → outbox/broker → worker → external delivery paths when asynchronous work exists.
- Separate liveness from readiness. Readiness should fail when a required dependency prevents useful service.
- Define actionable alerts and runbooks for API error/latency, database exhaustion, stuck outbox leases, queue backlog, DLQ messages, and repeated delivery failures.
- Build operator-facing views for received events, processing state, failed messages, retries, deliveries, and replay rather than hiding failures in logs.

### Testing strategy

- Unit tests: schemas, authorization policies, rule evaluation, dedupe keys, priority calculations, transition invariants, retry classification, and pure domain logic.
- Repository/integration tests: real PostgreSQL migrations, organization scoping, constraints, transactions, concurrent claims, and rollback behavior.
- API contract tests: status codes, validation, error shape, authentication, authorization, idempotency, pagination/filtering, and rate limits.
- Worker tests: duplicate delivery, transient/permanent failure, retry scheduling, poison messages, lease expiry, and DLQ behavior.
- End-to-end tests: a small set of valuable journeys such as sign-in, service creation, incident creation, status/assignment change, webhook ingestion, and failure inspection.
- Migration tests: apply all migrations from an empty database and, when practical, upgrade a representative previous schema/data snapshot.
- Do not optimize for coverage percentage alone; cover invariants and failure modes that would create security or reliability incidents.

### Data lifecycle and privacy

- Classify stored data and minimize raw inbound payloads. Redact authorization headers, secrets, tokens, and unnecessary personal data before persistence or logging.
- Define retention for received events, webhook delivery bodies, audit logs, attachments, AI inputs/outputs, and deleted organizations.
- Use UTC timestamps in persistence/contracts and format only at the presentation edge.
- Support safe organization offboarding/export/deletion later; deletion jobs must be idempotent and auditable.
- Encrypt data in transit and at rest; manage secrets with environment isolation locally and Secrets Manager or equivalent in cloud.

### Performance and scalability

- Add pagination to unbounded lists and stable ordering/cursors before volumes make it urgent.
- Create indexes from observed query patterns and inspect query plans for important dashboards and worker claims.
- Avoid N+1 queries and unbounded payload expansion, especially timelines, affected services, event histories, and deliveries.
- Define load-test scenarios and realistic initial service-level objectives before cloud release; measure instead of inventing scale claims.
- Prefer modular-monolith boundaries and independently scalable worker processes before splitting into microservices.

### CI/CD and release discipline

- Pull requests must run formatting/lint, typecheck, tests, production builds, migration validation, and security checks.
- Use ephemeral PostgreSQL in CI for integration/migration tests.
- If a future AWS phase is approved, use AWS OIDC and least-privilege deployment roles; never store long-lived AWS access keys in GitHub.
- Track the deployed commit/schema version and retain a rollback or safe roll-forward procedure; container releases require immutable versioned images.
- For future approved AWS infrastructure, use reviewed CloudFormation change sets and isolated environments. Protect current prod deploys through the release runbook; hosted dev is retired.
- Maintain concise architecture decision records and runbooks for decisions/failure modes a reviewer or operator would reasonably ask about.
