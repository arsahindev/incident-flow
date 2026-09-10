# IncidentFlow

IncidentFlow is a multi-tenant incident intake, routing, notification, and response-coordination SaaS for backend teams. It is being built as a production-minded full-stack portfolio project, one working vertical slice at a time.

## Current milestone: Phase 3

Authenticated realtime incident coordination is working locally on top of the Phase 2 identity and service-catalog foundation:

- a pnpm monorepo;
- a Next.js dashboard with incident creation, listing, detail, lifecycle controls, and URL-backed filters;
- a service catalog with service-owned environments, ownership, criticality tiers, and operational status;
- many-to-many affected-service links with one primary service per newly created incident;
- validated Fastify APIs for teams, services, environments, and incidents;
- Prisma migrations and an idempotent seed with a development organization, team, and realistic service catalog;
- transactional incident activity history for creation, assignment, status, and affected-service changes;
- PostgreSQL constraint tests and a GitHub Actions quality pipeline;
- PostgreSQL in Docker Compose with a persistent named volume;
- opaque, revocable server-managed sessions with Argon2id password hashing and login throttling;
- users, organization/team memberships, invitations, organization switching, and actor-aware audit records;
- centralized owner/admin/responder/viewer permissions enforced by the API and reflected in the UI;
- cross-tenant IDOR, role-boundary, invitation, session-rotation/revocation, suspended-membership, and disabled-user integration tests;
- shared Zod identity/session contracts and a stable coded API error envelope with request correlation IDs;
- shared runtime incident and realtime signal contracts with a monotonic version on every incident;
- a tested native-fetch backend-for-frontend boundary covering `204`, network failures, malformed/non-JSON responses, and runtime response validation;
- a transport-independent `RealtimePublisher` application port with a no-op test implementation;
- a Socket.IO adapter authenticated through the existing revocable session system, with strict browser-origin validation;
- server-derived organization and user rooms plus tenant-authorized incident-room joins;
- live incident creation, status, assignment, affected-service, and activity signals;
- client-side stale-signal rejection and canonical API refetch after accepted signals and reconnects;
- bounded inbound/outbound payloads, volatile backpressure handling, slow-client disconnection, session revalidation, and metrics seams;
- focused socket integration tests for authentication, room authorization, tenant isolation, revocation, and backpressure.

Account lifecycle and recovery is planned for Phase 3.5. Queues, webhook intake, AWS resources, broad incident notifications, and AI remain intentionally deferred to their roadmap phases.

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
docker compose up -d db
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The applications are then available at:

- Web dashboard: <http://localhost:3000>
- API health check: <http://localhost:4000/health>
- API readiness check: <http://localhost:4000/ready>

The idempotent development seed creates this local owner account:

- Email: `admin@incidentflow.local`
- Password: `IncidentFlow-Dev-2026!`

These are local demonstration credentials only; do not deploy them to a shared environment.

The development command runs the contracts compiler, web app, and API together. To run either application alone after `pnpm install`:

```bash
pnpm --filter @incidentflow/web dev
pnpm --filter @incidentflow/api dev
```

The repository includes focused `api.code-workspace`, `web.code-workspace`, and `contracts.code-workspace` files. Each opens only its application/package, so Quick Open and workspace search do not include sibling projects, while Source Control still discovers the parent monorepo. Each focused workspace also provides relevant Run and Debug entries. The API server debugger first compiles with `tsc`, runs `dist/server.js`, and maps breakpoints back to `src` through emitted source maps; the Next.js full-stack configuration attaches to server code and opens a Chrome debugger for client code; the contracts configuration debugs its Node test suite. Ensure PostgreSQL is running and the API/web environment files exist before starting application debuggers.

Environment configuration is owned by the process that consumes it. The root `.env` configures only the Docker Compose PostgreSQL container, `apps/api/.env` configures Fastify and Prisma, and `apps/web/.env.local` configures Next.js. `DATABASE_URL`, `WEB_ORIGIN`, `PASSWORD_PEPPER`, `API_URL`, and `NEXT_PUBLIC_REALTIME_URL` are required and validated with field-specific startup/build errors; bounded listener/realtime tuning retains documented safe defaults. Generate a production pepper with `openssl rand -base64 32`, store it separately from PostgreSQL in the deployment secret store, and never log or commit it. The checked-in API example contains a local-development-only value. `NEXT_PUBLIC_REALTIME_URL` is public and frozen into the browser bundle during `next build`, so deployments must provide the same value during build and startup; changing only the startup value cannot rewrite the bundle. `API_URL` remains server-only runtime configuration. Configuration failures are logged without values and are never reclassified as API network failures.

The realtime endpoint shares the API listener and accepts the `incidentflow_session` cookie only during the Socket.IO handshake. It requires the exact configured `WEB_ORIGIN`; browser code never receives the opaque session token. Local development works across ports because both applications use the `localhost` host. A production deployment must expose the socket endpoint on a host/path where the web session cookie is available, normally through a same-origin reverse proxy.

Realtime messages intentionally contain only an incident ID, event type, schema version, incident version, and timestamp. They are update signals, not canonical state or durable events: the dashboard refetches the normal authenticated API after a signal or reconnect.

## Sharing a Phase 3 demo

The current milestone can be shared from one HTTPS origin with a private API
process, PostgreSQL, and a WebSocket-capable reverse proxy. See the
[Phase 3 demo deployment runbook](docs/phase-3-demo-deployment.md) for the
required topology, secrets, migration command, start commands, proxy example,
and known Phase 3 limits. It intentionally does not represent the later Phase
10 production-platform scope.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm audit --prod --audit-level high
```

`pnpm test:integration` requires the local PostgreSQL container. The unit-test command skips those database-backed cases so it remains fast and self-contained.

## Database lifecycle

```bash
docker compose up -d db
docker compose ps
docker compose down
```

Create and apply a development migration after editing the Prisma schema:

```bash
pnpm db:migrate --name describe_your_change
```

The seed command is idempotent and can safely restore the development organization, owner account, Platform team, services, and service environments:

```bash
pnpm db:seed
```

`docker compose down` stops the database but preserves `postgres_data`, so data survives container recreation. Running `docker compose down --volumes` deliberately deletes that local data.

## Repository structure

```text
incidentflow/
├── apps/
│   ├── api/                 # Fastify HTTP API
│   ├── web/                 # Next.js dashboard
│   └── worker/              # Added when asynchronous work begins
├── packages/
│   └── contracts/           # Shared Zod schemas and TypeScript types
├── infra/
│   └── cloudformation/      # Added during the cloud phase
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Architecture diagrams

- [Identity and authorization ERD](diagrams/auth.svg)
- [Incident and service-catalog ERD](diagrams/incident-and-service.svg)

## Roadmap boundary

Phase 3 is complete, committed, and ready for pull-request review. Phase 3.5 is planned next for controlled first-owner organization registration, email verification, forgot/reset password, authenticated password changes, explicit short-lived organization-selection challenges for multi-organization login, session/socket revocation, and bounded expired-credential cleanup. Existing-organization registration remains invitation-only. Phase 4 (secure source-integration webhook intake) begins only after Phase 3.5 and has not started.

Architecture decisions are documented in [ADR 0001: server-managed sessions](docs/decisions/0001-server-managed-sessions.md), [ADR 0002: native fetch and API contracts](docs/decisions/0002-native-fetch-and-api-contracts.md), and [ADR 0003: authenticated realtime update signals](docs/decisions/0003-authenticated-realtime-update-signals.md).
