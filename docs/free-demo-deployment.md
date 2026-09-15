# Free production portfolio deployment

Status: deployed and verified. The current scope is one production portfolio
demo plus local Docker development. The owner targets $0, with a $5/month ceiling.
AWS resources and hosted dev were deleted because provisioned idle costs did not
fit that budget. Do not re-enable the retired AWS deployment scripts.

## Current topology

| Component | Project | Public origin |
| --- | --- | --- |
| Next.js on Vercel Hobby | incidentflow-prod | https://incidentflow-prod.vercel.app |
| Fastify on Vercel Hobby | incidentflow-api-prod | https://incidentflow-api-prod.vercel.app |
| PostgreSQL on Neon Free | incidentflow-prod | Server-only pooled connection |
| Realtime on Ably Free | IncidentFlow | Scoped token-authenticated channels |

Both app projects target Node22 and Frankfurt functions. They form one prod
environment, not separate dev/prod deployments. Preview deployments are disabled.
Production origins are public; application data still requires authentication.
Free-tier quotas and cold starts apply. Do not enable paid upgrades automatically.
See [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Neon pricing](https://neon.com/pricing), and
[Ably Free](https://ably.com/docs/platform/pricing/free) for current limits.

## Authentication and realtime

The browser keeps its HttpOnly session cookie on the web host. Next.js forwards
Session authorization to Fastify through server-only API_URL. The same-origin
POST /api/realtime/token sends an empty JSON object and receives a no-store,
60-second JWT restricted to subscribing to its authenticated organization.
The Ably server key is never sent to the browser. Logout and suspension revoke
by session or organization/user; failed revocation is bounded by token expiry.
Signals contain identifiers/versions only and trigger canonical API refetch.
The client refetches after connection gaps and rejects stale versions.
Local development retains the existing Socket.IO transport and cookie handshake.

The API function reuses its initialized app and Prisma pg.Pool(max5,idle5s,
connect10s). attachDatabasePool manages idle connections across Vercel suspension.
Runtime uses the pooled Neon URI with verified TLS; migrations use the direct
URI. Five existing migrations and the public/private account seeds were applied.
See [environment access](environment-access.md) for credentials and seed behavior.

## Production configuration

| Project | Variable | Setting |
| --- | --- | --- |
| API | DATABASE_URL | Private pooled Neon URI |
| API | PASSWORD_PEPPER | Existing private seed pepper |
| API | ABLY_API_KEY | Restricted Publish/Subscribe key on incidentflow:*; revocable tokens enabled |
| API | REALTIME_TRANSPORT | ably |
| API | WEB_ORIGIN | https://incidentflow-prod.vercel.app |
| Web | API_URL | https://incidentflow-api-prod.vercel.app |
| Web | NEXT_PUBLIC_REALTIME_URL | ably, provided at build time |
| Web | PUBLIC_DEMO_ENVIRONMENT | prod |

Private runtime values are Vercel production-sensitive variables. Local recovery
material is in ignored .deployment/neon-production.env; it must never enter Git
or source upload. Owner seed passwords are not required in the running app.
Project roots are apps/api and apps/web; source outside root is enabled for shared
contracts. Project vercel.json files specify build commands, routing and regions.

## Deploying a reviewed change

GitHub CI runs quality checks only. A merge to main currently does not deploy.
From the repository root, authenticate with vercel login if necessary, then select
and deploy the appropriate existing project (API example):

```bash
npx --yes vercel@latest link --yes --project incidentflow-api-prod --scope arscodings-projects
npx --yes vercel@latest deploy --prod --yes --scope arscodings-projects
```

Use incidentflow-prod instead when deploying the web app. These commands upload
the working tree; review local changes first. .vercelignore excludes credentials,
scratch files and local build outputs. CLI linkage can create ignored .env.local
and .vercel metadata. Never upload the private recovery file manually.
Migrations and seed runs are separate deliberate steps, not per-request work.
No migration is required for the transport/deployment changes on this branch.

After deployment, check API /health and /ready, web /login, responder login,
incident updates between two browser sessions, and logout revocation.
[Production verification](production-verification.md) records completed results.
The retired CloudFormation templates, container recovery checks and historical
AWS reports remain for engineering history; they are not the active runbook.

## Follow-on work

This completes the Phase3 deployment exception. Phase3.5 account lifecycle and
recovery follows after branch review/merge. Git-based automatic production
rollouts can be a separate explicit change; no hosted dev is required.
