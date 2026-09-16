# Free production portfolio deployment

Read when configuring hosting or performing an authorized manual recovery.
This is the authoritative hosting configuration/procedure, based on the recorded
2026-09-15 deployment and 2026-09-16 runtime alignment. It is not a fresh cloud
inspection. Current external settings, quotas and live health need verification
when undertaking deployment work; no services were contacted during the docs cleanup.
The scope is one production demo plus local Docker, targeting $0 with a $5/month
ceiling. AWS/hosted dev retirement was recorded because idle costs exceeded the
budget. Do not re-enable the retired AWS deployment scripts.

## Current topology

| Component               | Project               | Public origin                            |
| ----------------------- | --------------------- | ---------------------------------------- |
| Next.js on Vercel Hobby | incidentflow-prod     | https://incidentflow-prod.vercel.app     |
| Fastify on Vercel Hobby | incidentflow-api-prod | https://incidentflow-api-prod.vercel.app |
| PostgreSQL on Neon Free | incidentflow-prod     | Server-only pooled connection            |
| Realtime on Ably Free   | IncidentFlow          | Scoped token-authenticated channels      |

Both app projects target Node 24 and Frankfurt functions. They form one prod
environment, not separate dev/prod deployments. Preview deployments were recorded
as disabled; recheck settings during authorized deployment work.
Production origins are public; application data still requires authentication.
Free-tier quotas and cold starts apply. Do not enable paid upgrades automatically.
See [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Neon pricing](https://neon.com/pricing), and
[Ably Free](https://ably.com/docs/platform/pricing/free) for current limits.

## Runtime and account references

[Architecture](architecture.md#runtime-configuration-and-hosting-adapters) owns the
BFF/token bridge, realtime revocation and API pool design; read it when changing
runtime behavior. [Environment access](environment-access.md) owns demo accounts,
seed behavior and private recovery locations; read it when managing access.
[Production verification](production-verification.md) records the five applied
migrations, seed/deployment evidence and known limits at the time of verification.

## Production configuration

| Project | Variable                 | Setting                                                                      |
| ------- | ------------------------ | ---------------------------------------------------------------------------- |
| API     | DATABASE_URL             | Private pooled Neon URI                                                      |
| API     | PASSWORD_PEPPER          | Existing private seed pepper                                                 |
| API     | ABLY_API_KEY             | Restricted Publish/Subscribe key on incidentflow:*; revocable tokens enabled |
| API     | REALTIME_TRANSPORT       | ably                                                                         |
| API     | WEB_ORIGIN               | https://incidentflow-prod.vercel.app                                         |
| Web     | API_URL                  | https://incidentflow-api-prod.vercel.app                                     |
| Web     | NEXT_PUBLIC_REALTIME_URL | ably, provided at build time                                                 |
| Web     | PUBLIC_DEMO_ENVIRONMENT  | prod                                                                         |

Private runtime values are Vercel production-sensitive variables. Local recovery
material is in ignored .deployment/neon-production.env; it must never enter Git
or source upload. Owner seed passwords are not required in the running app.
Project roots are apps/api and apps/web; source outside root is enabled for shared
contracts. Project vercel.json files specify build commands, routing and regions.

## Deploying a reviewed change

The repository workflow defines production deployment after quality checks pass
on main. Read [activation, migration safety and recovery](github-deployment.md)
for release operations and the last recorded activation status. For a deliberate manual recovery,
from the repository root authenticate with vercel login, then select
and deploy the appropriate existing project (API example):

```bash
npx --yes vercel@59.17.0 link --yes --project incidentflow-api-prod --scope arscodings-projects
npx --yes vercel@59.17.0 deploy --prod --yes --scope arscodings-projects
```

Use incidentflow-prod instead when deploying the web app. These commands upload
the working tree; review local changes first. .vercelignore excludes credentials,
scratch files and local build outputs. CLI linkage can create ignored .env.local
and .vercel metadata. Never upload the private recovery file manually.
CI applies committed migrations before deployment and never seeds. Manual
recovery requires checking schema compatibility before choosing an older commit.
The original transport/deployment change required no new migration; assess the
actual reviewed change before each release.

After deployment, check API /health and /ready, web /login, responder login,
incident updates between two browser sessions, and logout revocation.
[Production verification](production-verification.md) records completed results.
The retired CloudFormation templates, container recovery checks and historical
AWS reports remain under [the archive](archive/phase-3-demo-deployment.md) for
historical troubleshooting; they are not the active runbook.

## Follow-on work

The Phase 3 portfolio hosting implementation is complete; automation activation
still needs evidence. Phase 3.5 requires separate approval and verified closeout. Read
[the next-phase handoff](phase-3-5-handoff.md); no hosted dev is required.
