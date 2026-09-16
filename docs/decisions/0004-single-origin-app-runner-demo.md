# ADR 0004: Single-origin CloudFormation App Runner demo

- Status: Retired on 2026-09-14 due to recurring cost; superseded by [ADR 0005](0005-free-portfolio-hosting.md)
- Date: 2026-09-11
- Milestone: Deployment enablement between Phases 3 and 3.5

> Retired decision record. All deployment, secret-location, retained-snapshot
> and pending-rollout statements below describe the historical AWS topology.
> They are not current instructions or cloud-state verification. Read the
> [archived runbook](../archive/phase-3-demo-deployment.md) for historical procedures,
> or ADR 0005 for the replacement decision.

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
  Linux/amd64 image tags including a source-content hash so uncommitted fixes
  cannot reuse stale images. The deploy script pushes with Docker Buildx; release
  verification can load an image locally, test it, and promote the same digest.
- Each environment caps App Runner at one active instance because Phase 3
  holds Socket.IO rooms and polling sessions in memory. Deployments can briefly
  overlap old/new instances; clients reconnect and refetch canonical state.
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
- The image bundles the public eu-central-1 RDS CA roots. Node-postgres uses
  `sslmode=verify-full` with `sslrootcert`; Prisma Migrate uses `sslmode=require` and `sslaccept=strict`,
  with the complete CA bundle loaded by OpenSSL through `SSL_CERT_FILE`. Both validate the database certificate.
  Next.js starts explicitly from `apps/web`.
- App Runner injects database and authentication secrets at runtime. The
  startup process validates configuration, runs committed Prisma migrations,
  and seeds one isolated demo owner only when the environment explicitly
  enables it. Operator checks resolve Secrets Manager references only at runtime with
  `asm-exec`; credentials never enter agent context, repository, or deployment output.

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

## Verified startup correction (2026-09-11)

Retained App Runner logs from the initial dev rollback show five migrations
applied successfully, followed by Prisma P1011 during seed because the RDS
certificate chain was not trusted. The shell exited before starting listeners.
A separate local reproduction showed the old Next.js command looked for `.next`
at the repository root. A disposable TLS PostgreSQL/container regression now
checks CA and hostname rejection, strict migration TLS, seed, and all three
public routes before cloud release. The original rollback snapshot is retained.

## Hosted transport verification (2026-09-12)

The public dev check authenticated successfully over Socket.IO polling, while
WebSocket transport failed at the App Runner endpoint. Browser clients now
set `tryAllTransports: true`, preserving WebSockets on capable hosts and
falling back to authenticated polling on App Runner. Both transports retain
the same host-only cookie and exact-origin validation. This deployment provides
realtime over HTTP polling; it does not claim App Runner WebSocket support.

See https://github.com/aws/apprunner-roadmap/issues/13 and the live smoke results.
# Public portfolio access amendment (2026-09-14)

The user authorized public demo access while registration is unavailable. Each
environment seeds a dedicated RESPONDER in its synthetic demo organization and
displays matching credentials on the login page. Existing private owner accounts
retain administrative access through Secrets Manager. Both seed and page share
one public credential definition selected by PUBLIC_DEMO_ENVIRONMENT. This is
bounded portfolio access, not the Phase 3.5 registration/recovery milestone.
Implementation is prepared; hosted rollout and verification are pending.
