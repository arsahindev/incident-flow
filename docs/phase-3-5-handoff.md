# Phase 3.5 handoff: account lifecycle and recovery

## Starting point

Deployment PR #5 is merged at `2a01b58`. Production already works on Vercel Hobby,
Neon Free and Ably Free. Local development uses Docker PostgreSQL and Socket.IO.
AWS and hosted dev are retired. Keep the $0 target / $5 monthly ceiling.
Public responder credentials and realistic data remain available; never expose
private owner credentials. Preserve the demo when adding account recovery.

The separate `codex/production-auto-deploy` branch adds CI-gated production
releases. Before starting this phase, configure the two production environment
secrets in [the deployment runbook](github-deployment.md), merge the automation
PR and verify its first main-branch release. No deployment run is claimed yet.
Do not leave the next assistant guessing whether deployment is active.

## Approved next scope

Use the detailed Phase 3.5 requirements in `.codex/context.md`:

- Controlled first-owner registration with email verification and atomic tenant
  bootstrap; joining an existing organization remains invitation-only.
- Forgot/reset password and authenticated password changes, with purpose-bound,
  short-lived, single-use hashed tokens and generic responses/throttling.
- Explicit two-step multi-organization login with a single-use selection
  challenge held in an HttpOnly cookie; recheck active membership at consumption.
- Session and realtime revocation for both local Socket.IO and production Ably.
- Bounded cleanup of expired credential records and sanitized security auditing.
- A provider-neutral authentication email port and a local capture/inbox adapter.
  Select a production provider only after checking free limits and sender/domain
  requirements: the owner currently has no domain. Never expose recovery tokens
  in public logs or pretend a local capture adapter delivers production email.

Maintain tenant isolation, last-owner invariants, Argon2id peppering, CSRF/origin
boundaries, shared contracts and the server-only API token bridge. Public demo
accounts must not become recoverable/takeover targets through new public flows;
make their treatment an explicit design and test decision.

Work in small runnable checkpoints. Start with schema/contracts and security
invariants, then implement bounded vertical slices with meaningful tests. Review
additive migrations against existing demo data; automatic deployment requires
compatibility with the previously running application. Do not start Phase 4,
webhook intake, queues, incident email notifications, AI or new cloud provisioning.

## Prompt for the next chat

```text
Start IncidentFlow Phase 3.5: account lifecycle and recovery.

Read AGENTS.md, .codex/context.md and docs/phase-3-5-handoff.md completely first.
Inspect Git status/history, current auth/schema/contracts/tests and applicable
nested instructions. Confirm the deployment automation PR is merged and its first
main deployment succeeded; if not, report the precise unfinished setup first.
Preserve local changes. Once main is current, create
codex/phase-3-5-account-lifecycle from it.

Implement only the Phase 3.5 scope in the context: controlled verified first-owner
registration, invitation-only existing-organization access, forgot/reset/change
password, explicit multi-organization selection challenges, session/realtime
revocation and bounded credential cleanup. Introduce a narrow email port and local
capture adapter; agree on a free production email option before provisioning.
Preserve the public responder demo and protect its identity from account takeover.

Keep Vercel + Neon + Ably production and local Docker + Socket.IO working. No AWS
or hosted dev; target $0 and never introduce paid services without approval. Use
backward-compatible migrations because merges to main deploy automatically.
Work in small checkpoints with concise updates, relevant tests and synchronized
README/context/ADRs. Do not begin Phase 4. Do not commit, push, merge or manually
deploy unless I ask. Begin with a concise implementation sequence, then complete
the first runnable checkpoint.
```
