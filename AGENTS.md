# IncidentFlow working instructions

## Start small

- For repository work, inspect Git status/branch and read [.codex/context.md](.codex/context.md).
  Preserve all existing user changes; never discard a dirty working tree.
- Then read only task-relevant sections from the context's documentation index.
  Links are navigation, not instructions to recursively load every document.
- For conceptual questions, answer from already available context when repository
  inspection is unnecessary. Reuse verified findings; do not reread unchanged files.
- Use targeted `rg` searches and bounded section reads before full-file reads.
  Read applicable nested AGENTS.md before editing within that directory.
- Keep explanations, progress updates and routine check summaries concise.
  Inspect only relevant files/tools; avoid unrelated investigation or scope expansion.

## Mandatory boundaries

- Derive tenant/user context from authenticated sessions and active membership.
  Scope every tenant-owned query/mutation and relationship by organization;
  never trust a browser organization ID as authority. API permissions are mandatory.
- Preserve transactional audit/activity records, shared runtime contracts, session
  revocation, exact-origin/CSRF defenses and canonical refetch/version guarantees.
  Apply relevant security/correctness criteria in [architecture](docs/architecture.md).
- Never expose private credentials, tokens or recovery files in output, Git or
  browser bundles. Do not read private env files just to inspect configuration.
  The AWS secret handling rules below remain mandatory for secret-related work.
- Current hosting is one Vercel + Neon + Ably production demo plus local Docker/
  Socket.IO. Target $0; ceiling $5/month. No paid upgrades, AWS recreation or hosted
  dev without a new explicit user cost/scope decision. AWS scripts remain disabled.
- Phases 0–3 are complete. Phase 3.5 needs explicit approval and deployment closeout;
  Phase 4 requires completed/approved Phase 3.5. A roadmap entry is not authorization.
- Commit, push, merge, deployment and provisioning permissions are task-specific;
  old checkpoint authorizations do not carry into a new task. Follow current user scope.

## Navigation and core commands

- `apps/web`: Next.js dashboard/BFF; follow its AGENTS.md and relevant bundled Next.js guide.
- `apps/api`: Fastify application, Prisma schema/migrations/seeds, realtime adapters.
- `packages/contracts`: shared Zod contracts; `docs/decisions`: preserved ADR rationale.
- [README](README.md) — read when setting up local development or using workspace/debug commands.
- Node 24.x (`.nvmrc`), pnpm 11.20.0. `pnpm install`, `docker compose up -d db`,
  `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` are the local setup commands.
  Preserve existing env files/data; migrations and seeds are deliberate mutations.
- Code checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:integration` (PostgreSQL), `pnpm build`, `pnpm audit --prod --audit-level high`.
  Run checks proportionate to the change plus required gates; economy never waives
  security, tenant-isolation, migration or other applicable correctness checks.
- Documentation-only changes: check affected links/references and `git diff --check`.
  Do not rerun application tests, database checks, builds or deployments for docs alone.

## Handoffs

- Keep the short context to current state, unresolved issues and the next approved
  step; update each topic's authoritative document instead of duplicating procedures.
- Distinguish repository facts, dated verification and planned work. Never claim
  external configuration or deployment success without evidence from that task.
- Start a fresh chat for a new milestone using a compact handoff (scope, relevant
  documents, completed work, blockers and next step), not the full conversation log.

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance

- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.
- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
<!-- END AWS Agent Toolkit rules -->
