# Portfolio environment access

| Environment | Login | Public responder email | Public password |
| --- | --- | --- | --- |
| Local | http://localhost:3000/login | `demo+local@incidentflow.demo` | `IncidentFlow-Demo-local-2026!` |
| Production | https://incidentflow-prod.vercel.app/login | `demo+prod@incidentflow.demo` | `IncidentFlow-Demo-prod-2026!` |

The public account is a responder, never an owner or admin. It can work on
incidents and read the service catalog, teams and members. It cannot invite
members, change roles or administer services. All visitors share demo changes;
use fictional data only. Seeds create five services and six incidents, preserving
existing visitor edits on reruns. There is no automatic demo reset.

Set PUBLIC_DEMO_ENVIRONMENT=local in local API and web environment files; run
pnpm db:seed. Production was seeded with prod and the web project uses prod.
The shared publicDemoAccount definition keeps seed and displayed credentials
consistent. Omitting the setting hides the hint and skips demo seeding; it does
not revoke an existing account. Suspend membership to revoke access.

## Private administrator

Production owner: `owner+prod@incidentflow.demo`. Its generated password is stored
locally in the ignored `.deployment/neon-production.env` as SEED_OWNER_PASSWORD.
The same file holds the seed configuration and private connection credentials.
It is machine-local, not a versioned credential backup. Keep it private and do
not commit it. The password is not a public demo password or a Vercel browser
variable. Local owner access remains admin@incidentflow.local with the documented
local-only seed password in README.

Hosted dev and AWS Secrets Manager credentials were deleted during retirement.
The dev seed definition remains available, but no dev environment is deployed.
See [production verification](production-verification.md).
