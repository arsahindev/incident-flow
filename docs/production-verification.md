# Production deployment verification - 2026-09-15

Production portfolio demo is deployed on Vercel Hobby, Neon Free and Ably Free.
No hosted dev environment remains; local Docker development/data are preserved.

- Web: https://incidentflow-prod.vercel.app
- API health: https://incidentflow-api-prod.vercel.app/health
- API readiness: https://incidentflow-api-prod.vercel.app/ready
- Demo: demo+prod@incidentflow.demo / IncidentFlow-Demo-prod-2026!
- Private owner: owner+prod@incidentflow.demo; credentials in the ignored local
  .deployment/neon-production.env, never in public source or the login page.

## Live results

- Public API health, readiness and web login: HTTP200.
- Authenticated web token endpoint: HTTP200, Cache-Control:no-store.
- Real Ably connection and organization channel attachment: PASS.
- Browser token publication denied: PASS (subscribe-only capability).
- Logout revocation: PASS; Ably requested reauthorization within15seconds and
  the revoked session was rejected with HTTP401.
- Owner manually confirmed login, demo content, the connected indicator and
  immediate incident updates across two browser sessions.

The final fix supplies an empty JSON object in the web token request. Previously
its JSON content type with an empty body caused Fastify400 and web503. Verified
against production requests and Vercel API logs before changing the route.

## Quality and limits

Latest full suites:41API unit tests,17web tests and9local PostgreSQL integration
tests passed. API/web lint,typecheck and builds passed. Final one-line token fix
passed web lint/typecheck and Vercel production build; no schema changes.
Vercel Socket.IO packaging diagnostics were resolved by separating local
transport selection from the production Ably entry point. The replacement API
build completed without TypeScript diagnostics. Both local transports passed
startup/health/shutdown checks; the live connection and logout tests passed again.
Vercel still prints an informational Node setting mismatch; package engines pin
the actual runtime to Node22.

Free-plan quotas and cold starts still apply. No paid upgrades, new AWS resources,
Git commits, pushes or merges were performed. Source deployment used the Vercel
CLI after the connector upload exceeded the approval-review payload limit.


## PR preparation checks

Final combined tree: workspace lint/typecheck/build passed;4contracts,41API and
17web unit tests passed; the separate PostgreSQL suite passed9/9, zero skips.
Normal unit discovery skips those9database cases by design. Dependency audit
reported no known vulnerabilities. Shell/Node syntax and git diff checks passed.
An initial sandboxed test run failed to bind local listeners; the permitted
rerun passed. Private .env/recovery files remain ignored. No push or merge.
