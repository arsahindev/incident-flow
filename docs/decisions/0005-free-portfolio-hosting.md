# ADR 0005: Free hosting for one public portfolio demo

- Status: Accepted; production deployment recorded on 2026-09-15
- Date: 2026-09-14
- Supersedes: ADR 0004's hosted App Runner/RDS topology

The owner needs one public employer-facing demo and local development, with a
$5/month ceiling and a preference for $0. Two provisioned App Runner services
and two RDS databases incur idle charges and do not meet this requirement.

Use Vercel Hobby for Next.js/Fastify HTTP functions, Neon Free PostgreSQL,
and Ably Free realtime. Vercel + Supabase Free database/realtime is also viable,
but its inactivity pausing is less suitable for unattended portfolio visits.
Read [the hosting guide](../free-demo-deployment.md) for current configuration
and [the dated verification](../production-verification.md) for deployment evidence.
External provider limits and settings must be checked during authorized hosting work.

Keep domain logic, opaque HttpOnly sessions, tenant authorization, PostgreSQL
constraints, seeds, and canonical-refetch semantics. Replace the deployed socket
transport behind the existing seam; do not forward the session cookie to a
third-party realtime origin. Scoped, short-lived realtime capabilities require
explicit authorization/revocation tests. The hosted implementation uses a
same-origin token bridge and an Ably adapter,
with subscribe-only 60-second capabilities and explicit revocation. Local
Socket.IO remains supported. Two Vercel projects serve one production environment,
and the browser cookie remains on the web host. A reusable Fastify function and
bounded PostgreSQL pool support this topology. Read
[architecture](../architecture.md#runtime-configuration-and-hosting-adapters) when
changing those implementation boundaries; read the verification report for
reported provider checks and their limitations.

Free quotas and cold starts are acceptable demo limitations, not production
availability claims. Do not add paid services or reinstate AWS deployment
without a new cost decision. Local Docker data must survive cloud teardown.

## CI release follow-up - 2026-09-15

Use GitHub Actions to deploy the existing projects after main passes quality
checks. Restrict the production environment to main, serialize releases, apply
backward-compatible migrations without reseeding, and release API before web
with public HTTP checks. Keep Vercel Git integration disconnected to preserve
the quality gate. The pair is not an atomic release; API/schema compatibility
with the preceding web release is required. No automatic database rollback.
See [activation status and runbook](../github-deployment.md).
