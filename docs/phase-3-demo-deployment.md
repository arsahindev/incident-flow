# Phase 3 shareable-demo deployment

This runbook deploys the current Phase 3 application as a small, single-host
HTTPS demo. It is deliberately not a claim of the later Phase 10 production
platform: there are no application Docker images, infrastructure-as-code,
automated deployment, shared realtime fan-out, backups, or alerting yet.

## Why one public origin is required

The browser stores the opaque session secret in an `HttpOnly` cookie set by the
Next.js backend-for-frontend. Normal API calls are made server-to-server, but
the Socket.IO handshake is the deliberate exception: it needs that same cookie
to authenticate the browser. Therefore, expose both the dashboard and
`/socket.io/` at one HTTPS origin, such as `https://demo.example.com`.

Do not deploy the web app at one unrelated host and the API at another for this
phase. The API would not receive the host-only session cookie and realtime
authentication would fail. A reverse proxy lets the API remain private while
the browser reaches its socket endpoint at the dashboard origin.

## What to provision

- A Linux VM or hosting environment that can run two persistent Node.js 22+
  processes and a reverse proxy.
- A DNS name pointing at it, with ports 80 and 443 available.
- An isolated PostgreSQL database. A managed provider is appropriate; do not
  point a public demo at a development database.
- A secret store or host-level protected environment configuration. Never
  commit a database URL or password pepper.

For a portfolio demo, a small VM plus a managed PostgreSQL database is the
least surprising topology. It keeps the deployment on one origin and exercises
the same Node.js build/start scripts used locally.

## Configure the host

Create protected API and web environment files (or use the host's secret
configuration). Values below use `demo.example.com` as an example.

```dotenv
# API process
DATABASE_URL=postgresql://.../incidentflow?sslmode=require
WEB_ORIGIN=https://demo.example.com
PASSWORD_PEPPER=<output of: openssl rand -base64 32>
API_HOST=127.0.0.1
API_PORT=4000
```

```dotenv
# Web process
API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_REALTIME_URL=https://demo.example.com
```

`NEXT_PUBLIC_REALTIME_URL` is embedded in the browser bundle by `next build`.
Set it before building and keep the same value when starting the web process.
`API_URL` is server-only, so it can use the private loopback API address.

## Build, migrate, and start

Run these from a clean checkout of the branch/commit you want to demonstrate:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @incidentflow/api exec prisma migrate deploy
pnpm build
```

Use `prisma migrate deploy` in a hosted environment. It applies the committed
migrations without creating development migrations or resetting data. Do not
run the development seed against a shared demo database unless you explicitly
want its known local-development credentials.

Start the processes under the hosting platform's supervisor, `systemd`, or an
equivalent restart mechanism:

```bash
# API, with the API environment loaded
pnpm --filter @incidentflow/api start

# Web, with the web environment loaded
PORT=3000 pnpm --filter @incidentflow/web start
```

The API's `/health` endpoint is a liveness check. Use `/ready` for a readiness
check because it verifies PostgreSQL connectivity.

## Reverse proxy example

Use a reverse proxy that supports HTTPS and WebSocket upgrade. Caddy is one
example; it automatically obtains HTTPS certificates once DNS and ports are
configured.

```caddyfile
demo.example.com {
  reverse_proxy /socket.io/* 127.0.0.1:4000
  reverse_proxy /health 127.0.0.1:4000
  reverse_proxy /ready 127.0.0.1:4000
  reverse_proxy 127.0.0.1:3000
}
```

The API port must not be publicly exposed. The socket route preserves the
browser's same-origin cookie and Caddy handles the WebSocket upgrade.

## Before sharing

1. Visit `https://demo.example.com/health` and `/ready`; the latter should
   return `200` only after PostgreSQL is available.
2. Sign in using only a deliberately created demo account. The Phase 3 app does
   not yet have public registration, password reset, or self-service recovery;
   those are intentionally scoped to Phase 3.5.
3. Open two authenticated browser sessions in the same demo organization and
   create or update an incident. Confirm the other session refreshes the
   canonical incident view.
4. Treat the instance as a demonstration environment: use a separate database,
   rotate its pepper and database credentials if exposed, and do not store real
   customer or production data in it.

## Deliberately deferred hardening

This runbook is suitable for sharing the working Phase 3 milestone with an
employer, not for claiming a production SaaS deployment. Phase 10 remains the
place for container images, immutable releases, cloud infrastructure, secret
management integration, deployment automation, monitoring/alerts, backup and
restore exercises, and rollback procedures.
