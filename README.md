# IncidentFlow

IncidentFlow is a multi-tenant incident coordination SaaS portfolio project,
built one working vertical slice at a time. Phases 0–3 provide incident lifecycle,
service catalog, identity/authorization and authenticated realtime updates.
Account lifecycle/recovery is planned next; alert intake and later features are
future work. See [the current handoff and reading index](.codex/context.md) when
starting repository work or finding the authoritative document for a topic.

The portfolio hosting choice is one Vercel + Neon + Ably production demo with
local Docker development. Read [environment access](docs/environment-access.md)
for demo links/accounts, [the hosting guide](docs/free-demo-deployment.md) for
configuration/manual recovery, and [the release runbook](docs/github-deployment.md)
for automatic deployment and activation evidence. Read [production verification](docs/production-verification.md)
only for dated results; it is not a current service-health assertion.

## Prerequisites

- Node.js 24.x (`nvm install` / `nvm use` from the repository root)
- pnpm 11.20.0
- Docker with Docker Compose

## Local setup

Create only missing environment files; preserve existing values and local data.

```bash
test -f .env || cp .env.example .env
test -f apps/api/.env || cp apps/api/.env.example apps/api/.env
test -f apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local
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

Local owner and public responder credentials, seed behavior and access boundaries
are documented in [environment access](docs/environment-access.md); read it when
signing in or reseeding. Never deploy the known local owner credentials.

The development command runs the contracts compiler, web app, and API together. To run either application alone after `pnpm install`:

```bash
pnpm --filter @incidentflow/web dev
pnpm --filter @incidentflow/api dev
```

The repository includes focused `api.code-workspace`, `web.code-workspace`, and `contracts.code-workspace` files. Each opens only its application/package, so Quick Open and workspace search do not include sibling projects, while Source Control still discovers the parent monorepo. Each focused workspace also provides relevant Run and Debug entries. The API server debugger first compiles with `tsc`, runs `dist/server.js`, and maps breakpoints back to `src` through emitted source maps; the Next.js full-stack configuration attaches to server code and opens a Chrome debugger for client code; the contracts configuration debugs its Node test suite. Ensure PostgreSQL is running and the API/web environment files exist before starting application debuggers.

Configuration belongs to the consuming process: root `.env` for Docker PostgreSQL,
`apps/api/.env` for Fastify/Prisma, and `apps/web/.env.local` for Next.js.
Read [runtime configuration](docs/architecture.md#runtime-configuration-and-hosting-adapters)
when changing configuration, API boundaries or realtime transport.

## Quality checks

For code changes, select checks proportionate to risk and complete required gates.
Documentation-only changes need link/reference checks and `git diff --check`, not
application tests, database tests or builds.

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

## Design and scope

- [Architecture and engineering requirements](docs/architecture.md) — read when changing runtime boundaries or finding relevant source directories/ERDs.
- [Product/domain requirements](docs/product-domain.md) — read when changing domain behavior or data relationships.
- [Roadmap](docs/roadmap.md) — read when scoping an approved future milestone.
- [Phase 3.5 handoff](docs/phase-3-5-handoff.md) — read before approved account-lifecycle work; includes prerequisites and a reusable prompt.

The context index links individual ADRs and historical records with selective
reading guidance. AWS deployment procedures are archived; they are not the
current deployment path. Do not start a product phase from a documentation task.
