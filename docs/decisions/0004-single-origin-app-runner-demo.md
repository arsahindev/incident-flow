# ADR 0004: Single-origin CloudFormation App Runner demo

- Status: Accepted
- Date: 2026-09-11
- Milestone: Deployment enablement between Phases 3 and 3.5

## Context

The completed Phase 3 application needs a shareable, isolated demonstration
deployment. The browser's existing opaque `HttpOnly` session cookie is owned by
the Next.js backend-for-frontend. Ordinary API calls stay server-to-server, but
the authenticated Socket.IO handshake must receive that same browser cookie.
Deploying the web app and socket server at unrelated public origins would break
that security boundary.

The project design authority also calls for AWS and CloudFormation practice,
separate environments, immutable images, secrets outside source control, and
an honest distinction between a current demo and the later Phase 10 platform.

## Decision

Use versioned CloudFormation templates to create a small AWS deployment path in
`eu-central-1`.

- A shared private ECR repository stores immutable environment/Git-revision
  Linux/amd64 image tags. The deploy script builds with Docker Buildx and loads
  the image before pushing it.
- Each `dev` and `prod` stack creates its own single-AZ encrypted PostgreSQL
  RDS instance, App Runner service, VPC connector/security groups, and
  Secrets Manager values. The database accepts PostgreSQL only from its
  environment's App Runner security group.
- One container runs Nginx, Next.js, and Fastify. Nginx exposes the dashboard
  at `/`, Fastify liveness/readiness at `/health` and `/ready`, and preserves
  WebSocket upgrades for `/socket.io/`. Those routes share the generated App
  Runner HTTPS hostname.
- Browser configuration explicitly uses `NEXT_PUBLIC_REALTIME_URL=same-origin`
  in this topology. It is an intentional, validated deployment value rather
  than an implicit fallback. Fastify receives its generated hostname as the
  exact `WEB_ORIGIN` after the stack's second application.
- App Runner injects database and authentication secrets at runtime. The
  startup process validates configuration, runs committed Prisma migrations,
  and seeds one isolated demo owner only when the environment explicitly
  enables it. Generated credentials are retrieved from Secrets Manager, never
  written to the repository or deployment output.

## Consequences

- Each environment has an independent URL, database, pepper, and demo account;
  testing cannot mutate the production-demo data.
- The first apply intentionally creates an App Runner hostname, and the second
  apply records that hostname as Fastify's strict trusted origin. This avoids
  guessing a generated URL while retaining origin validation.
- The deployment is intentionally a bounded, billable demo. It does not add
  multi-AZ database availability, autoscaling policy tuning, custom domains,
  automated CI/CD, centralized observability, durable realtime fan-out,
  backup/restore exercises, or production incident response guarantees.
- CloudFormation retains a database snapshot on stack deletion. Operators must
  explicitly clean up demo stacks, retained snapshots, and secrets when the
  environments are no longer needed.
