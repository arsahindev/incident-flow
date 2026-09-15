# Deployment verification - 2026-09-11

Scope: deploy the existing Phase 3 state to isolated dev/prod environments in
`eu-central-1`, using profile `incidentflow` and CloudFormation. No later product
phase, Git commit, or Git push is included.

## Verified failure and correction

Initial dev application log group:
`/aws/apprunner/incidentflow-dev/e5b558f72ec548fb97d205e6e78e5ddb/application`.

At startup, the original image applied all five migrations and then failed in
`prisma.organization.upsert()` during seed with Prisma P1011:
`self-signed certificate in certificate chain`. The shell exited before
launching listeners. Service logs subsequently recorded the `/ready` health
failure on port 8080. This was a container trust-store failure, not evidence of
an unreachable database.

The fixed image bundles public RDS regional CA roots and verifies certificate
chains and hostnames. Prisma Migrate uses OpenSSL `SSL_CERT_FILE` and `sslaccept=strict`;
node-postgres uses `sslrootcert` and `sslmode=verify-full`. A disposable TLS
PostgreSQL test confirmed both valid startup and rejection of an untrusted CA
and incorrect hostname. The same test exposed Next.js root-directory build and
config import failures; Next.js now executes from `apps/web`.

The original rolled-back stack had no live resources. Its empty stack record
was removed before recreation. Snapshot
`incidentflow-dev-snapshot-database-py2ahb8shcfd` remains retained.

## Quality results

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS, all 3 packages |
| `pnpm typecheck` | PASS, all 3 packages |
| `pnpm test` | PASS: contracts 4, API 34, web 12; 6 DB cases intentionally skipped |
| `pnpm test:integration` | PASS: 6/6 real PostgreSQL tests, none skipped |
| `prisma migrate status` | PASS: schema current, 5 migrations |
| `pnpm build` | PASS: contracts, API, Next.js production build |
| `pnpm audit --prod --audit-level high` | PASS: no known vulnerabilities |
| Published-image container regression | PASS: untrusted CA rejected, wrong host rejected, 5 migrations from empty DB, seed, `/health`, `/ready`, `/login` all HTTP 200 |
| Shell and smoke-script syntax | PASS |
| `git diff --check` | PASS |
| CloudFormation `validate-template` | PASS: both templates |
| Dev creation change set | 11 additions; zero reported failed validation events |
| cfn-lint / cfn-guard | Not installed; not run. AWS validation and reviewed change sets used. |

The first sandboxed unit run failed only for five loopback Socket.IO tests
(`listen EPERM`). The rerun with loopback permissions passed all 50 non-DB tests.
Docker initially returned EOF due to stale stopped backend processes; Docker
was recovered before image and database checks.

## Image security scan

ECR basic scan for digest
`sha256:041b737817ea269a2e4a4d6b3f8aadea313a98490c9b8936985147140ddb5170`
completed with **5 CRITICAL, 17 HIGH, and 6 MEDIUM** OS-package findings.
These are separate from the clean pnpm dependency audit. The image is not
vulnerability-free and this deployment does not claim production readiness.

Critical findings: CVE-2026-13221, CVE-2026-42533, CVE-2026-12087,
CVE-2026-57433, CVE-2026-75803. Affected packages across the high/critical
findings include Perl, Nginx, OpenSSL, util-linux, PCRE2, and zlib. Scanner
severity does not prove each vulnerable feature is reachable in this app;
exploitability and vendor fixes have not been fully assessed in this startup
repair. Base-image/package patching remains an explicit release-hardening task.

## Release identity

- Base Git revision: `2359442cb9ecd2e754b7f473b535e2d6a1ffbc6e`.
- Runtime changes are uncommitted; the revision alone does not identify the fix.
- Dev tag: `dev-2359442cb9ec-55722b88cefd`.
- Content hash at image build: `55722b88cefd`.
- Image digest: `sha256:041b737817ea269a2e4a4d6b3f8aadea313a98490c9b8936985147140ddb5170`.
- Subsequent verification scripts and documentation do not change image runtime.

## Multi-root CA correction

The first repair passed a single-CA local test but its cloud deployment rolled
back: Prisma Migrate rejected the RDS chain. The RDS regional bundle begins
with ECC384, while the database uses RSA2048. A regression with the trusted CA
last in a multi-root bundle reproduced the failure with `sslcert`. Loading the
complete bundle via OpenSSL `SSL_CERT_FILE` fixed it while preserving strict
verification. The revised test passes all five migrations, seed and public routes.
The earlier digest above is a failed release, not the final deployed artifact.
