# Production deployment after merges to main

The `CI` workflow in `.github/workflows/ci.yml` checks pull requests and branch
pushes. A push to `main` (including a merged PR) deploys production only after
`quality` succeeds. Feature branches and PRs never deploy. No hosted dev or AWS
resources are needed. Keep Vercel's independent Git integration disconnected so
it cannot bypass these checks.

## One-time activation

The GitHub `production` environment exists and permits only the `main` branch.
Before merging this automation, add these **environment secrets** under repository
Settings → Environments → production:

| Secret | Source |
| --- | --- |
| VERCEL_TOKEN | Vercel CI access token scoped to arscodings-projects |
| PRODUCTION_DATABASE_URL | Direct DATABASE_URL from ignored .deployment/neon-production.env, not DATABASE_URL_POOLED |

Activation status: secret setup is pending; the first main-branch deployment has
not run. Never commit these values. The token can be handed to the local setup
process through ignored `.deployment/vercel-ci.env` as `VERCEL_TOKEN=...`.
Rotate the GitHub secret when the token expires. Existing API secrets stay in
Vercel; the workflow does not need the owner password, pepper or Ably key.

Public team/project IDs are pinned in the workflow. Node24, pnpm11.20.0 and
Vercel CLI59.17.0 are used. CLI source uploads build against each project's
existing production settings and variables, using root directories `apps/api`
and `apps/web`. `.vercelignore` excludes private local files.

## Release sequence

1. Quality job applies migrations to disposable PostgreSQL17, then runs lint,
   typecheck, unit and PostgreSQL integration tests, build and dependency audit.
2. Production jobs serialize without cancelling an active release. A job whose
   SHA is already superseded on main skips before changing production.
3. Apply committed Prisma migrations through the direct production connection.
   Never seed or reset the production database in CI.
4. Deploy the API and check public `/health` and `/ready` with bounded retries.
5. Deploy the web app and check public `/login` with bounded retries.
6. Record the commit and stable origins in the Actions summary. Vercel deployment
   metadata also records `githubCommitSha`.

A new main commit arriving during an active deployment waits for it to finish.
The two project releases are sequential, not atomic. Keep API changes compatible
with the previously deployed web app. There is no automatic database rollback.

## Migration and failure rules

Only backward-compatible migrations belong in this automatic path: add fields
or tables first, deploy compatible readers/writers, backfill deliberately, and
remove old schema only in a separately reviewed release after old consumers are
gone. Review every generated migration. Destructive changes require a recovery
plan and explicit manual coordination; CI passing on an empty database does not
prove an upgrade preserves existing production data.

A migration/API failure stops before the web release. A failed health check may
occur after the API alias has changed. A web failure can leave the newer API
serving the previous web build. Inspect the failing Actions step and Vercel logs;
fix forward with a reviewed PR, or redeploy a known-good compatible commit using
the manual procedure in [the hosting guide](free-demo-deployment.md). Do not
reverse database migrations or rerun seeds as an automatic rollback. Rerunning
an existing main job works only while its SHA is still main's latest commit.

After the first merge, watch both jobs finish, then manually verify demo login,
incident updates in two browsers and logout. HTTP smoke checks do not replace
those authenticated checks. Deployment secrets and the first real workflow run
are required before calling this pipeline operational.

The old AWS main-to-dev design is retired. Its CloudFormation files and Git
history remain engineering records; do not restore its roles, stacks or scripts.

References: [Vercel CLI options](https://vercel.com/docs/cli/global-options),
[Vercel with GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel),
[GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
