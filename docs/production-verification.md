# Production deployment verification - 2026-09-15

Dated evidence, with a 2026-09-16 addendum. Read when assessing previous checks
or troubleshooting their limits. Results below were reported by earlier work;
this documentation cleanup reran none of them and contacted no services. Current
cloud settings, credentials, runtime, CI activation and live health need fresh
evidence during authorized operations. Procedures live in the
[hosting guide](free-demo-deployment.md) and [release runbook](github-deployment.md).

Production portfolio demo is deployed on Vercel Hobby, Neon Free and Ably Free.
No hosted dev environment remains; local Docker development/data are preserved.

- Web: https://incidentflow-prod.vercel.app
- API health: https://incidentflow-api-prod.vercel.app/health
- API readiness: https://incidentflow-api-prod.vercel.app/ready
- Demo: demo+prod@incidentflow.demo / IncidentFlow-Demo-prod-2026!
- Private owner: owner+prod@incidentflow.demo; credentials in the ignored local
  .deployment/neon-production.env, never in public source or the login page.

## Live results

- Five existing Prisma migrations and the public/private demo seeds were reported
  applied to Neon; sample data contained five services and six incidents.
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
At that checkpoint Vercel printed an informational Node setting mismatch and
package engines selected Node 22. This is historical; see the Node 24 addendum.

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

## Automatic deployment follow-up - 2026-09-15

Deployment PR #5 is now merged at 2a01b58. The separate automation branch adds
main-push deployment after the quality job. Validation: actionlint1.7.7 passed,
all deployment shell blocks passed bash syntax checks, workflow gate/concurrency
assertions passed, and git diff --check passed. No application/schema changes
were made, so the earlier application/database results above were not rerun.
GitHub production environment was created and read back with exactly one branch
policy, main. Its secret listing is empty: VERCEL_TOKEN and
PRODUCTION_DATABASE_URL still need configuration. No new production deployment
or end-to-end Actions run was performed. See [the release runbook](github-deployment.md) for activation
and [the Phase 3.5 handoff](phase-3-5-handoff.md) for the next milestone.

## Node 24 alignment - 2026-09-16

Workspace engines, CI deployment and Docker bases now target Node24; .nvmrc
selects24. Both Vercel project settings were reported as 24.x. This changes future deployments,
not the runtime of an already deployed function. No redeployment was performed.
On Node24.21.0: lint/typecheck/build passed;4contract,41API,17web unit tests and
9/9database integration tests passed. Audit: no known vulnerabilities. Actionlint
and git diff --check passed. The historical Node22 results above remain records
of the previous release. Docker image build was not rerun.
