# Phase 3.5 handoff: account lifecycle and recovery

Read when the user explicitly authorizes this milestone. This is the authoritative
Phase 3.5 scope, including requirements moved from the former long context.
Planning here is not approval to start implementation during another task.

## Starting point and prerequisites

Phases 0–3 and the portfolio hosting implementation are complete. Keep one
Vercel/Neon/Ably production demo, local Docker/Socket.IO, and the $0 target / $5
monthly ceiling. Preserve the public responder demo and existing local data.
[The short context](../.codex/context.md) owns the dated branch/checkpoint summary;
inspect Git status and history rather than assuming a named follow-up branch.

Before starting Phase 3.5, establish that the deployment automation/runtime
follow-up is merged to current main and its first main release succeeded.
[The release runbook](github-deployment.md#one-time-activation) owns activation
requirements and the last recorded pending setup. Local commits cannot prove
current GitHub secrets, remote merge state or successful hosted deployment.
Verify those only in authorized deployment work; otherwise report the missing
evidence. Do not silently configure secrets or deploy to unblock a product task.

## Scope-specific constraints

- Preserve invitation-only access to existing organizations, tenant isolation,
  last-owner protection, peppered Argon2id, CSRF/origin boundaries, shared contracts
  and the server-only API/realtime token bridge.
- Session and realtime revocation must cover both local Socket.IO and hosted Ably.
- The owner has no domain according to the prior handoff; reconfirm this when
  choosing production email. Check provider free limits and sender requirements
  before selecting a provider. A local capture adapter is not production delivery.
- Public demo accounts must not become recoverable/takeover targets through new
  public flows; make their treatment an explicit design and test decision.
- Work in small runnable checkpoints, starting with schema/contracts and security
  invariants. Review additive migrations against existing demo data and keep them
  compatible with the previously running application under automatic deployment.
- Do not add Phase 4/webhooks, queues, broad incident notifications, AI, new cloud
  provisioning or a hosted dev environment as part of this milestone.

## Detailed acceptance criteria

- Preserve invitation acceptance as the only way for a user to join an existing organization. Do not add unrestricted organization joining or silently infer tenant membership from an email domain.
- Add a controlled self-service bootstrap flow for a new customer: verify email ownership, then atomically create the user, organization, active owner membership, and initial server-managed session. Normalize organization identity, reject conflicting user/organization records safely, rate-limit requests, and audit successful bootstrap without exposing account existence.
- Replace the optional `organizationSlug` on the initial password-login request with an explicit two-step multi-organization flow. After valid credentials, create a normal session immediately only when exactly one active membership exists. When several exist, return the allowed organization summaries plus a cryptographically random, purpose-bound, single-use organization-selection challenge with a short expiry; store only its digest and do not create a session yet. The Next.js backend-for-frontend keeps the raw challenge in a separate short-lived `HttpOnly`, `SameSite=Lax`, production-`Secure` cookie so browser JavaScript never receives it.
- Complete multi-organization login through a dedicated selection endpoint. It must consume the challenge atomically, re-check the user and selected membership are still active, reject organizations outside the challenged user, create one server-managed session for the selected organization, delete the challenge cookie, and fail closed on expiry, replay, revocation, or concurrent consumption. A slug is a selection value, never proof of authorization. Zero active memberships retain the generic invalid-login response. Invitation acceptance and verified first-owner bootstrap may create a session directly because their organization context is already unambiguous.
- Introduce a provider-neutral `TransactionalEmailSender` application port before selecting an email service. Production/hosted environments must deliver verification and recovery links through a configured provider; tests use a no-op/capturing adapter, and local development may use an explicitly local inbox/capture adapter. Never place raw action tokens in ordinary application logs. This narrow authentication-email capability must not grow into the Phase 6 incident-notification system.
- Add forgot-password initiation with the same generic response whether or not the account exists, database-backed throttling, and a cryptographically random, purpose-bound, short-lived, single-use reset token stored only as a digest. Do not reuse invitation tokens or session tokens for recovery.
- Add reset-password completion that consumes the token transactionally, writes a current peppered/versioned Argon2id password hash, invalidates every other outstanding reset token, revokes all sessions, disconnects all realtime sockets for the user, records a material audit event, and requires a new login.
- Add authenticated change-password behavior that verifies the current password, writes a current peppered/versioned hash, revokes every existing session, disconnects realtime sockets, and issues one freshly rotated session for the selected organization so the initiating browser can continue safely.
- Keep password-reset and verification tokens out of URLs stored in analytics/referrer logs where practical; pages must avoid third-party resources, responses must use `no-store`, and token values must never enter structured logs or audit metadata.
- Define a bounded retention policy for expired/revoked sessions and consumed/expired account-action tokens. Delete them in indexed batches through an explicit maintenance command/job; permanent security history belongs in sanitized audit records rather than indefinite credential-table retention.
- Extend shared runtime contracts and the Next.js backend-for-frontend with register/verify, forgot/reset, change-password, and organization-selection forms while keeping Fastify authoritative. Preserve generic authentication errors, request correlation, origin/CSRF boundaries, password-pepper requirements, last-owner protection, and server-derived tenant authorization.
- Add unit and real-PostgreSQL integration tests for enumeration resistance, expiry, single use, replay/concurrency, wrong-purpose tokens, throttling, cross-account and cross-tenant attempts, zero/one/many-membership login behavior, organization-challenge replay and membership revocation, password-hash versioning, session/socket revocation, atomic owner bootstrap, email-delivery failure boundaries, and cleanup batching.
- Do not include MFA, OAuth/social login, enterprise SSO, domain-claim automation, billing/provisioning, personal API tokens, broad notification delivery, or end-user device/session management in Phase 3.5.

## Prompt for the next implementation chat

```text
Start the first runnable checkpoint of IncidentFlow Phase 3.5.
Read AGENTS.md and the short .codex/context.md, then the scope and acceptance
criteria in docs/phase-3-5-handoff.md. Follow its prerequisites; do not recursively
load the documentation index or archive. Inspect Git status/history, preserve
user changes, and read only relevant auth/schema/contracts/tests and nested rules.

Establish that the deployment automation/runtime follow-up is merged to current
main and its first release succeeded. If evidence or activation is missing,
report the precise blocker without changing secrets or deploying. Once the
prerequisites are met and main is current, create codex/phase-3-5-account-lifecycle.

Implement the first bounded account-lifecycle checkpoint from the handoff with
meaningful security tests and compatible migrations. Preserve the public demo,
tenant isolation, session/realtime revocation, local Socket.IO and hosted Ably.
Use a narrow email port; agree on a free production email option before provisioning.
Keep the $0 target / $5 monthly ceiling. No AWS, hosted dev or Phase 4.
Give concise updates and update authoritative docs plus the compact handoff.
Do not commit, push, merge or deploy unless I ask. Begin with a short sequence,
then complete the first runnable checkpoint if the prerequisites are satisfied.
```
