# IncidentFlow

IncidentFlow is a multi-tenant incident intake, routing, notification, and response-coordination SaaS for backend teams. It is being built as a production-minded full-stack portfolio project, one working vertical slice at a time.

## Current milestone: Phase 0

The repository currently contains only the local foundation:

- a pnpm monorepo;
- a Next.js dashboard shell in `apps/web`;
- a Fastify API with `GET /health` in `apps/api`;
- PostgreSQL in Docker Compose with a persistent named volume.

Authentication, incident persistence, WebSockets, queues, AWS resources, and AI are intentionally deferred to their roadmap phases.

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
pnpm install
docker compose up -d db
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

Phase 1 will add Prisma migrations, a seeded development organization and team, and the manual incident lifecycle: create, list, view, update status, and record activity.
