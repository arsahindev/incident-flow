# IncidentFlow

IncidentFlow is a multi-tenant incident intake, routing, notification, and response-coordination SaaS for backend teams. It is being built as a production-minded full-stack portfolio project, one working vertical slice at a time.

## Current milestone: Phase 1

The first product vertical slice is working locally:

- a pnpm monorepo;
- a Next.js dashboard with incident creation, listing, detail, and lifecycle controls;
- a validated Fastify API for teams and incidents;
- Prisma migrations and a seeded development organization/team;
- Transactional incident activity history for creation, assignment, and status changes;
- PostgreSQL in Docker Compose with a persistent named volume.

Authentication, WebSockets, queues, AWS resources, and AI are intentionally deferred to their roadmap phases.

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

The development command runs the web and API packages together. To run either package alone:

```bash
pnpm --filter @incidentflow/web dev
pnpm --filter @incidentflow/api dev
```

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

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

The seed command is idempotent and can safely restore the development organization and Platform team:

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

## Next milestone

Phase 2 will add authentication, users, organization memberships, roles, and server-side authorization checks. Until then, the API deliberately derives tenant context from the seeded development organization rather than trusting an organization ID from the browser.
