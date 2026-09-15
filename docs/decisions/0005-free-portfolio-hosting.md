# ADR 0005: Free hosting for one public portfolio demo

- Status: Accepted; production deployed
- Date: 2026-09-14
- Supersedes: ADR 0004's hosted App Runner/RDS topology

The owner needs one public employer-facing demo and local development, with a
$5/month ceiling and a preference for $0. Two provisioned App Runner services
and two RDS databases incur idle charges and do not meet this requirement.

Use Vercel Hobby for Next.js/Fastify HTTP functions, Neon Free PostgreSQL,
and Ably Free realtime. Vercel + Supabase Free database/realtime is also viable,
but its inactivity pausing is less suitable for unattended portfolio visits.
See [the sourced comparison and migration checkpoints](../free-demo-deployment.md).

Keep domain logic, opaque HttpOnly sessions, tenant authorization, PostgreSQL
constraints, seeds, and canonical-refetch semantics. Replace the deployed socket
transport behind the existing seam; do not forward the session cookie to a
third-party realtime origin. Scoped, short-lived realtime capabilities require
explicit authorization/revocation tests. Vercel and Neon projects are provisioned;
Neon is migrated and seeded. The existing Ably Free app and restricted server key
are reused. The API adapter issues 60-second subscribe-only JWTs for the
authenticated organization and revokes by session or organization/user. Provider
failures leave at most the token lifetime before reauthorization is required.
Local development defaults to Socket.IO. The browser now obtains scoped tokens through a same-origin Next.js endpoint,
renews authorization, and refetches after attachment/reconnect gaps. Local tests
and the built endpoint pass. An explicit Node.js function wraps the Fastify app with one reusable Prisma
pool per instance (maximum five connections), registered with Vercel idle-pool
management. Two projects serve one production environment: Next.js and the API;
the browser session cookie remains on the web host. Vercel production and live provider verification are complete; see
[final verification](../production-verification.md).

Free quotas and cold starts are acceptable demo limitations, not production
availability claims. Do not add paid services or reinstate AWS deployment
without a new cost decision. Local Docker data must survive cloud teardown.

Production is deployed. The 2026-09-15 token-bridge fix was verified with a live Ably connection; see the deployment guide for exact checks and remaining verification limits.

The production entry point imports only the Ably transport; local Socket.IO selection is isolated from Vercel function packaging.
