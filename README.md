# IncidentFlow

IncidentFlow is a multi-tenant incident intake, routing, notification, and response-coordination SaaS for backend teams. It is being built as a production-minded full-stack portfolio project, one working vertical slice at a time.

## Current milestone: Phase 2

The authenticated manual incident lifecycle and service-catalog foundation are working locally:

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
- a tested native-fetch backend-for-frontend boundary covering `204`, network failures, malformed/non-JSON responses, and runtime response validation.

WebSockets, queues, AWS resources, and AI are intentionally deferred to their roadmap phases.

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
pnpm install
docker compose up -d db
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The applications are then available at:

- Web dashboard: <http://localhost:3000>
- API health check: <http://localhost:4000/health>

The idempotent development seed creates this local owner account:

- Email: `admin@incidentflow.local`
- Password: `IncidentFlow-Dev-2026!`

These are local demonstration credentials only; do not deploy them to a shared environment.

The development command runs the contracts compiler, web app, and API together. To run either application alone after `pnpm install`:

```bash
pnpm --filter @incidentflow/web dev
pnpm --filter @incidentflow/api dev
```

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

## Next milestone

Phase 3 will add authenticated real-time incident coordination through an adapter boundary, organization/incident/user rooms, canonical-state refetch after reconnect, and focused socket integration tests.

Phase 2 decisions are documented in [ADR 0001: server-managed sessions](docs/decisions/0001-server-managed-sessions.md) and [ADR 0002: native fetch and API contracts](docs/decisions/0002-native-fetch-and-api-contracts.md).
