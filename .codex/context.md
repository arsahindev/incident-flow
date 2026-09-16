# IncidentFlow: current state and selective documentation index

Read this short handoff for repository work, then only relevant documents/sections.
Do not recursively read every link. Root [AGENTS.md](../AGENTS.md) supplies mandatory
working/security rules. Conceptual answers may use existing context without inspection.

## Current state — local inspection, 2026-09-16

- Multi-tenant incident coordination portfolio app; Phases 0–3 are complete:
  service catalog/environments, incident lifecycle/activity, identity/memberships,
  named permissions and authenticated realtime. Phase 3.5 has not begun.
- Next.js + Fastify + Prisma/PostgreSQL in a pnpm workspace; shared Zod contracts.
  Repository engines, `.nvmrc`, CI runtime and Docker bases target Node 24.x;
  package manager is pnpm 11.20.0. This does not prove the deployed runtime version.
- Hosting choice: Vercel Hobby web/API, Neon Free and Ably Free; local Docker
  PostgreSQL and Socket.IO remain supported. One production demo, no hosted dev.
  Target $0, ceiling $5/month; no paid upgrade or AWS recreation without approval.
- AWS retirement was recorded in September 2026; local deployment scripts exit 64.
  Historical cloud teardown reports are not fresh verification of resource state.
- Always derive tenant context from authenticated session/membership; enforce
  organization-scoped queries/constraints and server-side permissions. Never expose
  private secrets or recovery files. Preserve existing user changes and local data.
- Realtime is best-effort post-commit signaling; clients reject stale versions and
  refetch canonical API state. Retain session/origin/tenant boundaries on both transports.

## Compact handoff

Completed repository work: deployment PR #5 is in local `main` at `2a01b58`.
Automation commit `5c29cf1`, Node 24 alignment `e8e02e5`, and Actions runtime fix
`be9c19c` are on the inspected branch `action-node-ver` (HEAD `be9c19c`). The older
`codex/production-auto-deploy` branch points to `5c29cf1`. Recheck Git at task start;
these are dated local references, not assertions about the current remote branch.

The workflow defines a quality-gated main-only release: compatible migrations,
API then web, HTTP checks, serialized releases. The 2026-09-15 report says
production environment secrets and the first real Actions release were pending.
Their current external state, remote merge status, deployed Node runtime and live
health need verification during authorized deployment work. No services were
contacted in this documentation cleanup; do not treat the historical passing
checks as proof that automation is operational now.

Next approved step in this task: review the documentation-only diff; no commit,
push, merge, deployment or product work. Next implementation candidate is Phase 3.5,
only after explicit user authorization and deployment-closeout evidence. Use its
handoff below. Do not advance to Phase 4, queues, AI, broad notifications or on-call.
Replace this handoff when state changes; keep chronological results in the archive
or dated verification record, not appended here.

## Documentation index — read when relevant

| Source | Read when… |
| --- | --- |
| [README](../README.md) | Setting up local development, commands, database lifecycle or editor/debug workspaces. |
| [Architecture and engineering requirements](../docs/architecture.md) | Changing runtime, auth, contracts, data access or realtime; apply affected security/correctness sections. |
| [Product and domain requirements](../docs/product-domain.md) | Designing services, events/alerts/incidents, ingestion rules, lineage or ITIL-aligned behavior. Includes future requirements. |
| [Roadmap and future design](../docs/roadmap.md) | Scoping a phase or implementing its async/outbox/CDC, cloud, notification or AI requirements after approval. |
| [Phase 3.5 handoff](../docs/phase-3-5-handoff.md) | Starting approved account-lifecycle work; owns its full requirements, blockers and reusable prompt. |
| [Hosting guide](../docs/free-demo-deployment.md) | Configuring the Vercel/Neon/Ably topology or performing an authorized manual recovery. |
| [GitHub release runbook](../docs/github-deployment.md) | Checking activation, CI releases, migration compatibility or failure recovery. |
| [Environment access](../docs/environment-access.md) | Using public demo/local accounts or locating private recovery material without exposing it. |
| [Production verification](../docs/production-verification.md) | Assessing dated deployment/test evidence and its limits; not a current health assertion. |
| [ADR 0001](../docs/decisions/0001-server-managed-sessions.md) | Changing session, password, permission or CSRF boundaries. |
| [ADR 0002](../docs/decisions/0002-native-fetch-and-api-contracts.md) | Changing fetch/parser/error/runtime-contract behavior. |
| [ADR 0003](../docs/decisions/0003-authenticated-realtime-update-signals.md) | Changing local Socket.IO auth, rooms, backpressure or shared signal guarantees. |
| [ADR 0004 — retired](../docs/decisions/0004-single-origin-app-runner-demo.md) | Understanding the historical single-origin AWS decision and TLS/polling tradeoffs. |
| [ADR 0005](../docs/decisions/0005-free-portfolio-hosting.md) | Understanding current hosting cost/transport choices and release safety rationale. |
| [Completed milestone checkpoints](../docs/archive/milestone-checkpoints.md) | Investigating old Phase 0–3 decisions, verification and branch history. |
| [Retired AWS runbook](../docs/archive/phase-3-demo-deployment.md) | Investigating old container/single-origin deployment procedures; do not execute them. |
| [AWS recovery report](../docs/archive/deployment-verification-2026-09-11.md) | Investigating historical TLS/startup failures, image findings or release identities. |
