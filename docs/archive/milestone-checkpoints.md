# Historical milestone checkpoints

Archived on 2026-09-16 from the former long `.codex/context.md`.
Read only for completed-phase history and implementation rationale. These are
dated records, not current instructions, branch assignments, permissions or
proof of today's database/cloud state. The short [current handoff](../../.codex/context.md)
and [architecture](../architecture.md) supersede the old status statements.
AWS was subsequently retired; never recreate it from these records.

## Completed product milestones (original records)

### Phase 0 — foundation (complete)

- pnpm workspace with Next.js web and Fastify API.
- `GET /health`.
- PostgreSQL in Docker Compose with a named volume and health check.
- Root environment example, README, lint/typecheck/test/build scripts.
- Initial Git foundation commit.

### Phase 1 — manual incident lifecycle (complete)

- Prisma 7 with PostgreSQL driver adapter, migration, and idempotent seed.
- Seeded development organization and Platform team.
- Organization-scoped incidents and transactional activity timeline.
- API routes for teams and create/list/get/update incident operations with Zod validation.
- Dashboard incident summary/list, creation form, detail view, status/team controls, loading/error/not-found states.
- Browser-level lifecycle verification and PostgreSQL container-restart persistence verification.

The earlier fixed-development-tenant limitation was removed in Phase 2. Protected API operations now require authenticated, server-derived tenant context.

### Phase 1.5 — service catalog and affected services (complete)

This is a domain-foundation milestone, not scope creep. It makes IncidentFlow authentically service-oriented before authentication, webhook routing, rules, and notifications depend on the wrong model.

Implemented outcome: the organization has a service catalog with service-owned environments; incidents can affect multiple services with one primary designation; users can manage services/environments, see service-specific incident history, and filter incidents by service, team, status, and priority. Existing development incidents were intentionally left unclassified rather than receiving fabricated affected-service history. Newly created incidents require at least one affected service at the API/UI boundary.

#### Data and invariants

- Add `services` with organization, owning team, name/slug, description, type, tier, operational status, timestamps, and suitable indexes.
- Add service-owned environments with a unique name/slug per service, kind, active/archived lifecycle, and optional ephemeral/expiry metadata. Seed normal development/staging/production examples without requiring every service to use the same set.
- Enforce that only ephemeral service environments may have an expiry through API validation, repository state validation, and a PostgreSQL check constraint.
- Add `incident_affected_services` with organization-scoped composite foreign keys, unique incident/service membership, `is_primary`, and an at-most-one-primary constraint.
- Seed realistic services such as Checkout API, Payment Processing, Customer Portal, PostgreSQL Primary, and Stripe.
- Migrate existing development incidents safely; either leave them temporarily unclassified with clear UI or attach an explicit seeded service based on a documented migration decision.
- Record affected-service additions/removals/primary changes in `incident_activity`.
- Keep service ownership and incident coordinating-team assignment distinct.

#### API and UI

- Service create/list/get/update/archive APIs with strict organization scoping and validation.
- Service catalog/detail page with type, tier, owner, status, service environments, and incident counts/history.
- Service environment create/update/archive workflows; creating an environment never creates a duplicate service.
- Incident creation/update supports multiple affected services and one optional primary service.
- Incident detail displays affected services and owner context.
- Dashboard filtering by service, team, status, and priority with URL-backed filters.
- Add pagination/stable ordering before lists become unbounded.

#### Quality and operations

- Unit tests for service schemas and primary-service invariant.
- PostgreSQL integration tests for cross-tenant foreign keys and unique constraints.
- API tests for service filtering and invalid/cross-organization references.
- Browser tests for service creation, incident association, and service filtering.
- Add baseline GitHub Actions CI now if it is not already present: install with frozen lockfile, Prisma generation, migration validation/integration database, lint, typecheck, tests, and production build.

Do not add dependency graphs, automatic priority mapping, broad CMDB fields, or status-page publishing yet. Preserve seams for those later capabilities.

### Phase 2 — identity, memberships, and authorization (complete)

- Opaque server-managed sessions use random bearer secrets while PostgreSQL stores only SHA-256 digests. The Next.js backend-for-frontend keeps the secret in an `HttpOnly`, `SameSite=Lax`, production-`Secure` cookie and forwards it to Fastify through a non-ambient authorization header. See `docs/decisions/0001-server-managed-sessions.md`.
- Users, organization memberships, team memberships, invitations, session revocation, organization switching, organization-local suspension, and global disabled-user behavior are implemented through an additive migration and idempotent development seed.
- A centralized named-action permission matrix defines owner, admin, responder, and viewer access. API checks are authoritative; the web UI also removes controls users cannot exercise.
- All protected routes derive organization/user context from the validated session. The former fixed development organization is no longer an authorization mechanism.
- Argon2id passwords use automatic per-password salts plus a required, separately stored native Argon2 secret (`PASSWORD_PEPPER`) of at least 32 random bytes. Stored hashes carry a pepper-version marker without containing the pepper; legacy Phase 2 hashes migrate after successful authentication, unknown versions fail closed, and loss/compromise of the single currently supported pepper requires password resets. Generic invalid-login responses, database-backed failure throttling, seven-day expiry, logout revocation, organization-switch rotation, hashed single-use 48-hour invitation tokens, and a last-active-owner invariant form the initial security baseline.
- Because the browser never authenticates directly to Fastify with ambient cookies, cross-site requests cannot carry API authority. Next.js Server Actions provide the cookie-authenticated mutation boundary and same-origin validation; any future conventional cookie-authenticated route must add explicit CSRF protection.
- Incident/service/activity/permission changes record actor identity and material organization administration actions also write audit-log records.
- Real-PostgreSQL tests cover cross-tenant IDOR attempts, viewer write denial, invitations, team membership, last-owner protection, organization-switch token rotation, membership suspension/revocation, disabled users, and login throttling.
- `packages/contracts` now provides runtime Zod identity/session schemas and the common coded API error envelope. Fastify maps expected and unexpected failures centrally with correlation IDs and without leaking internal details.
- The Next.js backend-for-frontend deliberately keeps native `fetch`; its tested response parser handles no-content, malformed/empty JSON, non-JSON upstream failures, network failure classification, and structured `ApiError` metadata. Identity/session/member responses are runtime-validated first, while incident/service response contracts will migrate incrementally.
- Password reset/change and controlled first-owner organization registration are planned for Phase 3.5. MFA, enterprise SSO, personal API tokens, and end-user session-device management remain deliberately deferred beyond that milestone.

### Phase 3 — real-time incident coordination (complete)

- Socket.IO is behind `RealtimePublisher`; domain/application code does not import Socket.IO, and publication happens only after the business transaction commits.
- Handshakes reuse the opaque server-managed session cookie with an exact-origin check. Organization/user rooms are server-derived, and incident rooms require an organization-scoped authorization query.
- Live incident create/status/assignment/affected-service/activity signals use shared runtime contracts and a positive monotonic incident version.
- The browser treats messages as hints, rejects stale/equal versions, and refetches canonical API state after accepted signals and reconnects.
- Default 4 KiB inbound and 1 KiB outbound payload limits, bounded incident-room membership, volatile delivery, pending-packet/backpressure drops, repeated-slow-client disconnection, and periodic session revalidation bound resource use.
- Logout/organization-switch session rotation and membership suspension proactively disconnect affected sockets, with periodic validation as a fail-closed fallback.
- `RealtimeMetrics`, `InMemoryRealtimeMetrics`, `NoopRealtimeMetrics`, `NoopRealtimePublisher`, publisher/application tests, client sequencing tests, and focused Socket.IO integration tests provide the initial operational/testing seams.
- Realtime is deliberately best-effort and single-process in this phase. Durable publication/outbox delivery and distributed socket fan-out are not claimed.

## Current code state — 2026-09-12

- Repository: `/Users/arsahin/Developer/incidentflow`.
- Git is initialized. Phase 3 is merged to `main` at `e660769`; always inspect the current branch/status before modifying files. Deployment enablement is developed on `codex/phase-3-deployment` and is not a replacement for the next approved product milestone, Phase 3.5.
- Phase 1 baseline commit: `e43f355 feat: complete phase 1 manual incident lifecycle`.
- pnpm workspace contains `apps/web`, `apps/api`, and the active `packages/contracts` package. The contracts package builds shared ESM/Zod identity and error contracts before dependent applications.
- Next.js dashboard supports login/logout, invitation acceptance, member/role/access/team administration, permission-aware incident/service workflows, activity history, URL-backed filtering, pagination, and service catalog/detail/environment management.
- Fastify API exposes health, authentication/session, invitation/member/team-access, service, service-environment, and incident lifecycle routes with Zod validation and repository seams.
- Prisma/PostgreSQL includes users, organization/team memberships, sessions, invitations, login throttles, audit logs, organizations, teams, services, service environments, incidents with monotonic positive versions, affected-service joins, and actor-aware incident activity. Organization-scoped constraints protect tenant boundaries.
- The idempotent seed creates the development organization, an owner (`admin@incidentflow.local`), Platform team, five representative services, and realistic environments. Its local-only password is documented in the README.
- The API resolves active user and organization membership on every protected request from a hashed opaque-session record. Central named permissions replace scattered role comparisons; suspended memberships, disabled users, expired sessions, and revoked sessions fail closed.
- The web uses an HttpOnly cookie as the backend-for-frontend credential; regular Fastify HTTP routes do not accept browser ambient cookies. The Phase 3 Socket.IO handshake is the narrow exact-origin exception described in ADR 0003. The optimistic Next.js proxy checks cookie presence, while the API remains authoritative and safely handles stale/invalid cookies.
- Auth/security decisions and deliberate deferrals are recorded in ADR 0001.
- Native-fetch response handling, runtime contract validation, and the coded correlated-error format are recorded in ADR 0002.
- Authenticated realtime update signals, the Socket.IO cookie/origin boundary, room authorization, canonical refetch strategy, delivery limits, and deliberate best-effort/single-process guarantees are recorded in ADR 0003.
- ADR 0004 records the deliberately bounded CloudFormation/App Runner deployment topology: one public origin per isolated environment preserves the existing session-cookie and Socket.IO boundary; ECR, RDS, Secrets Manager, least-privilege roles, and VPC security groups are defined as code. It is a shareable demo path, not Phase 10 production-platform completion.
- The API application layer publishes incident create/status/assignment/affected-service/activity signals through `RealtimePublisher` only after repository transactions complete. Socket.IO remains confined to `SocketIoRealtimeAdapter`; ordinary tests use `NoopRealtimePublisher`.
- The Socket.IO adapter authenticates with the existing revocable session service, automatically joins server-derived organization/user rooms, authorizes incident rooms against the authenticated organization, bounds payloads/room counts/backpressure, periodically revalidates sessions, and exposes transport-neutral metrics seams.
- The dashboard and incident detail show connection state, runtime-validate signals, ignore stale/equal incident versions, and use `router.refresh()` to fetch canonical authenticated API data on updates and reconnects.
- Web and API configuration now fail fast through separate Zod boundaries. Required database/origin/API/realtime URLs and the password pepper have no silent fallbacks, public Next.js configuration is checked during build and must be supplied consistently at startup because its bundled value is immutable, server configuration is checked at process startup, Prisma generation remains install-safe while migration/seed commands validate their required database/pepper inputs, and sanitized structured failures preserve configuration errors instead of misclassifying them as network errors. Root, API, and web environment examples reflect their actual loading boundaries; API liveness and PostgreSQL-backed readiness are separate endpoints.
- [the retired deployment runbook](phase-3-demo-deployment.md) documents the CloudFormation/App Runner path for separate `dev` and `prod` single-origin HTTPS demos plus the manual-host topology. The container runs Nginx, Next.js, and Fastify together; it keeps the API private except for liveness/readiness and Socket.IO reverse-proxy paths so the existing host-only session cookie can authenticate the handshake. This is a sharing path for the current milestone, not a substitute for the Phase 10 cloud platform or production-readiness work.
- Baseline GitHub Actions CI provisions PostgreSQL and runs frozen installation, migration deployment, lint, typecheck, unit tests, database integration tests, production build, and a high-severity production-dependency audit.
- PostgreSQL runs through Docker Compose with persistent storage. Phase 3 was verified through warning-free lint and typecheck, shared-contract/application/client sequencing tests, focused loopback Socket.IO integration tests, the additive migration and current migration-status check, warning-free real-PostgreSQL identity/authorization/constraint/version tests, production builds, a high-severity production-dependency audit, and a local login-page smoke test.
- The database contains development records created during verification, including an Order Routing API service, preview environment, linked incident, and a browser-verification viewer account; do not assume it is empty.
- Phase 3 authenticated real-time incident coordination is merged to `main`. Current authorized work is dev/prod deployment on `codex/phase-3-deployment`. Phase 3.5 requires a separate user instruction and branch. Do not begin Phase 4 before Phase 3.5 is completed and approved.
- Existing uncommitted user changes may be present. Always inspect and preserve them; never treat a dirty worktree as disposable.
