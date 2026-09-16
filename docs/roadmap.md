# Implementation roadmap and future design

Read when scoping a milestone or implementing the relevant future capability.
These requirements are retained plans, not permission to begin work or provision
services. Phases 0–3 are complete; their detailed results are in the
[historical checkpoints](archive/milestone-checkpoints.md) for milestone archaeology.
The prod-only Vercel/Neon/Ably deployment is a Phase 3 deployment exception,
not completion of the later cloud-platform or production-readiness phases.

Keep local Docker development and the $0 target / $5 monthly ceiling. Any future
AWS or paid service requires a new explicit cost decision. Phase 3.5 requires
user approval and deployment-closeout evidence; Phase 4 follows only after
Phase 3.5 is completed and approved. No later phase has begun.

Each phase must produce a demonstrable user or operator outcome, include tests
proportionate to risk, update documentation, and leave the project runnable.
[Architecture acceptance criteria](architecture.md#cross-cutting-production-readiness-requirements)
apply when a capability first appears. Read [product/domain requirements](product-domain.md)
only for the domain sections affected by that phase.

## Phase 3.5 — account lifecycle and recovery (planned)

The [Phase 3.5 handoff](phase-3-5-handoff.md) is the single source for its detailed
scope, security acceptance criteria, prerequisites and next-chat prompt.

## Phase 4 — source integrations and secure webhook intake

- Integration setup UI requires a service environment and allows multiple independently managed integrations per service environment.
- Generate an opaque public integration key for `POST /v1/events/:integrationKey` plus a separate signing secret shown once; store a secure verifier/encrypted representation, support rotation overlap, revoke, and last-used metadata.
- Derive organization, service, and environment from the integration record. Payload service/environment fields are optional assertions only and must match configuration when present.
- HMAC SHA-256 of `timestamp + "." + rawBody`, timing-safe verification before parsing, replay window, body-size/content-type limits, and per-integration rate limits.
- Zod event contract with stable API versioning and sanitized validation errors.
- `received_events` audit/inbox record, payload redaction/hash, retention, unique `(integration_id, external_event_id)` idempotency, and fast `202 Accepted` semantics.
- Received-event UI shows processing status, matched service/rule, resulting alert, any incidents linked through that alert, sanitized failure, and correlation ID.
- Local demo sender generates realistic checkout/payment errors and supports duplicate/invalid-signature/replay scenarios.
- Integration tests cover raw-body signatures, rotated/revoked secrets, replay, duplicates, malformed/oversized input, and cross-tenant isolation.

## Phase 5 — asynchronous alert processing, rules, dedupe, and outbox

- Add LocalStack only now, plus SNS, SQS, queues, DLQs, and the worker application in `apps/worker`.
- Transactional outbox for integration/alert/incident domain events; short claim transaction, `FOR UPDATE SKIP LOCKED`, publishing lease, capped retry/backoff/jitter, and reclaim after crash.
- Declarative rule evaluator using a versioned restricted schema; no arbitrary customer code.
- Alert rules process events; a valid event with no custom match follows a safe default create/deduplicate policy. Explicit suppression produces `ignored`, while permanent invalid/configuration failures produce `rejected`.
- Incident rules operate on alerts and may explicitly create/link incidents; keep their trigger/action contracts distinct from alert rules even if they share evaluator infrastructure.
- Normalize accepted events into first-class alerts with source, service, message/details, priority, dedupe key, occurrence count, first/last-seen timestamps, owner/responders, status, and audit history.
- Route/priority/team/service/notification actions are explicit and auditable. Service tier may participate only through a visible rule or mapping.
- Dedupe/grouping keys and windows are deterministic, tenant-scoped, integration/service-aware, and tested under concurrent/duplicate delivery.
- Alert list/detail workflows support acknowledge, assign, close, history/evidence, “create incident from alert,” “link to existing incident,” and audited unlink actions. Avoid making every alert an incident.
- Model `alert_events` and many-to-many `incident_alerts` with organization-scoped constraints and audit metadata so event evidence and grouped alerts survive incident lifecycle changes.
- Add a bounded integration-heartbeat monitor after normal alert processing works: a missing expected heartbeat creates/deduplicates an alert and recovers visibly when heartbeats resume.
- `processed_messages` consumer idempotency; acknowledge SQS only after the business transaction commits.
- Persist retry scheduling/latest processing failure on `received_events`, retain bounded attempt history, configure an SQS redrive policy, reconcile DLQ messages durably, and provide permissioned audited replay.
- Operator UI/commands for outbox backlog, received-event state, worker failure, DLQ inspection, and permissioned replay.
- Metrics/traces for queue depth/age, processing latency, retries, outbox leases, DLQ count, and duplicate suppression.
- Concurrency and failure-injection tests cover worker death between commit/ack, publish success before marking, poison messages, lease expiry, and replay.

## Phase 6 — notifications, stakeholder delivery, and outbound webhooks

- In-app notification model/preferences and realtime delivery signal.
- Email delivery through a provider adapter with templates, provider message IDs, suppression/bounce handling where available, and per-recipient delivery history.
- Outbound webhook subscriptions with selected event types, verified ownership/test delivery, encrypted secret, signing, delivery records, timeouts, retry/backoff/jitter, disablement policy, and manual replay.
- Strong SSRF defense: URL validation, allowed schemes/ports, DNS/IP checks, redirect policy, private/link-local blocking, response-size/time limits, and revalidation at delivery time.
- Separate internal responder events from curated stakeholder updates.
- Operator/customer UI exposes attempts, sanitized request/response metadata, next retry, permanent failure, and replay audit.
- Contract and failure tests cover signatures, duplicates, slow/down destinations, redirects, retry classification, and secret rotation.

## Phase 7 — ITIL-aligned operational incident management

- Impact and urgency fields plus an organization-configurable priority matrix and audited override.
- Richer lifecycle/milestone timestamps: detected, acknowledged, mitigated/restored, resolved, closed, reopened.
- Resolution summary/code, workaround, closure confirmation, and reopen reason.
- Major-incident declaration, incident coordinator/commander, responders, stakeholders, and scheduled/ad-hoc stakeholder updates.
- Service-level targets for acknowledgement and restoration/resolution; pause semantics must be explicit and not gameable.
- Runbook/knowledge/evidence links and an operational command/timeline view.
- Post-incident review with impact, timeline, contributing factors, lessons, and owned/due follow-up actions.
- Minimal problem and change records/links sufficient to demonstrate the distinction between restoration, root-cause work, and controlled remediation. Do not turn IncidentFlow into general Jira issue tracking.
- Metrics/dashboard: MTTA, time to mitigation/restoration, MTTR with clearly documented definition, SLA attainment, reopen rate, incident volume per service/team/source, recurring incidents, and major-incident review completion.
- Exportable audit/report data and tests for clock/timestamp calculations, SLA transitions, reopen/closure invariants, and authorization.

Describe this milestone as ITIL-aligned, not certified.

## Phase 8 — bounded on-call schedules and escalations

- Build only after reliable notifications exist.
- Team schedules, time zones, rotations, effective intervals, overrides, and “who is on call now?” calculation.
- Escalation policies with ordered delays/targets, acknowledgement cancellation, deduplicated notifications, and an audit timeline.
- Contact-method preferences and safe test notification flow; start with email/in-app or one provider before considering SMS/voice.
- Schedule preview, gaps/overlaps validation, override UI, and escalation simulation/testing tools.
- Tests emphasize DST/time-zone transitions, concurrent acknowledgements, delayed jobs, overrides, retries, and escalation cancellation.
- Do not claim global telephony/PagerDuty-scale availability; document provider and delivery limitations honestly.

## Phase 9 — AI incident brief with human review

- Provider-agnostic adapter and versioned structured-output Zod contract.
- Inputs are least-privilege, redacted, size-limited, and explicitly selected from incident/activity/service/attachment evidence.
- Asynchronous execution, idempotency, timeouts, retry classification, quotas/cost controls, cancellation, and provider/model metadata.
- Output includes summary, affected service/system, suggested severity, possible next steps, confidence, and evidence references.
- Human approve/reject/edit workflow; AI never autonomously declares major incidents, pages responders, changes status, or triggers high-impact actions.
- Prompt-injection-aware attachment handling, retention controls, audit history, and evaluation fixtures for groundedness/structure/safety.

## Phase 10 — cloud platform, CI/CD, and infrastructure as code

- Web/API/worker Docker images with non-root users, health checks, minimal runtime layers, pinned bases, scanning, and reproducible builds.
- Intentionally choose Lambda containers versus ECS/App Runner or another container service based on WebSocket/process/concurrency needs; record the ADR.
- ECR, selected compute, API Gateway where appropriate, S3, SNS, SQS/DLQs, IAM, Secrets Manager, CloudWatch, and networking through CloudFormation.
- Neon PostgreSQL remains acceptable initially; document connectivity, pooling, backup/restore, migration, and environment isolation.
- GitHub Actions uses AWS OIDC, immutable image tags, environment protections, CloudFormation change sets, deployment smoke tests, and rollback/safe roll-forward instructions.
- WAF and API Gateway throttling complement application tenant quotas; they do not replace them.
- Structured centralized logs, metrics, traces, dashboards, alarms, runbooks, and cost/budget alerts.

## Phase 11 — production-readiness review and portfolio release

- Threat model and abuse-case review covering authentication, tenancy, webhook intake, outbound SSRF, secrets, uploads, replay, rate limits, and AI data flow.
- Load tests for dashboard/API, webhook bursts, rule/dedupe processing, outbox, workers, notifications, and WebSockets against documented initial SLOs.
- Backup/restore and disaster-recovery exercise; migration from a representative prior version; DLQ/outbox replay exercise.
- Retention/deletion jobs, attachment/payload limits, organization offboarding, audit/export expectations, and privacy/security documentation.
- Operational game day: database unavailable, queue backlog, worker crash, stuck lease, provider outage, notification failure, and deployment rollback.
- Architecture diagrams, ADRs, API/event contracts, runbooks, demo data/script, screenshots, and an honest portfolio README describing scope, guarantees, tradeoffs, and future work.
- No unresolved high-severity security findings and no hidden manual steps required for the documented deployment/demo path.

## Version 2 / scale evolution

- Debezium CDC reads the retained outbox table and publishes to Kafka/Confluent without changing domain code/event contracts.
- Schema registry/versioning, consumer groups, replay strategy, partition-key decisions, and migration/coexistence plan.
- Service dependency graph and impact propagation/suggestions with explicit confidence; avoid claiming causality merely from topology.
- More advanced analytics, incident correlation, status-page publishing, integration marketplace, and on-call/notification providers only when justified by measured needs.
- Keep the polling outbox as a well-understood version-1 architecture; Kafka is an evolution, not proof of production readiness by itself.

## Future reliability design — Phase 5 and version 2

This design is not implemented. Read when implementing outbox, workers, retry,
DLQ/replay, or later CDC; event/alert lineage and inbox fields are defined in
[the domain model](product-domain.md#domain-data-model-and-event-processing-requirements).

### Transactional outbox — version 1

The transactional outbox pattern writes a business change and its publishable event in the same PostgreSQL transaction:

```text
BEGIN
  INSERT incident
  INSERT outbox_event(type = incident.created, status = pending)
COMMIT
```

This prevents two failure modes:

- Database write succeeds but broker publishing fails, losing the event.
- Broker message is published but the database transaction fails, creating a ghost event.

An **outbox dispatcher** is a background worker that claims pending outbox events, publishes them to SNS, then marks them published. It does not guarantee exactly-once delivery; it intentionally provides at-least-once delivery, so all consumers must be idempotent.

Recommended version-1 strategy:

1. Poll up to 50 eligible rows every 1–5 seconds.
2. Use a short transaction to claim rows.
3. Use `FOR UPDATE SKIP LOCKED` so multiple concurrently running dispatchers claim different rows rather than block or duplicate work.
4. Set `status = publishing`, increment attempts, and set a short lease expiry.
5. Commit before calling SNS; do not hold a database transaction during network calls.
6. Publish outside the transaction.
7. Mark successful rows `published`; schedule failed rows for retry.
8. If a dispatcher dies, another can reclaim the row after the lease expires.

Example claim query:

```sql
SELECT *
FROM outbox_events
WHERE status = 'pending'
  AND available_at <= NOW()
ORDER BY created_at
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

`FOR UPDATE` locks selected rows for the claiming transaction. `SKIP LOCKED` causes a second simultaneous dispatcher to skip claimed rows and take other work.

Optionally use PostgreSQL `LISTEN`/`NOTIFY` to wake the dispatcher quickly after an insert, but retain periodic polling as durable fallback. A notification is not a replacement for the outbox because a process that is down can miss the wake-up.

### Version 2: Debezium / CDC

The requested version-two evolution is to replace the polling outbox dispatcher with Debezium CDC.

Keep the `outbox_events` table and event contract. Debezium should read PostgreSQL’s write-ahead log and publish new outbox inserts to Kafka/Confluent. The business/domain code must remain unchanged; only the publisher transport changes.

Do not introduce Confluent/Kafka in MVP. It adds cluster/topic/schema/consumer-group/connector complexity and does not eliminate the database-to-broker consistency problem by itself. Kafka remains a valid later architecture for high event volume, many consumers, durable replay, and streaming analytics.

### Consumer idempotency

SQS is at-least-once. A message may be delivered again after a worker commits business changes but before it deletes the SQS message.

Use `processed_messages` with a unique `(consumer_name, event_id)` constraint. In the consumer’s database transaction:

1. Record the event ID.
2. Apply business state changes.
3. Commit.
4. Acknowledge/delete the SQS message.

If redelivered, the unique constraint identifies it as completed and the worker can safely acknowledge it.

`processed_messages` is not a customer-facing event index or query optimization. It records completion independently per consumer because one domain message may be handled by notification, webhook, realtime, analytics, and other consumers. `received_events.processing_status` describes inbound event processing and cannot prove that every downstream consumer completed the same message.

### Retries and exponential backoff

For transient failures, retry with increasing waits capped at a maximum and add jitter to avoid synchronized retry storms. The worker leaves the SQS message unacknowledged and may change its visibility timeout to the selected delay; after the visibility period, SQS can deliver it again. Persist `retry_scheduled`, the attempt count, expected next attempt time, and sanitized latest processing error for operator visibility.

Classify failures explicitly:

- retryable: temporary dependency, database, lock, or infrastructure failure;
- permanent: invalid/unsupported data or configuration that retry cannot repair; record `rejected` and acknowledge the message;
- unknown: retry a small bounded number of times, then dead-letter for investigation.

Use an SQS redrive policy with a deliberately chosen maximum receive count (approximately five initially, validated through failure tests). Once exhausted, SQS moves the message to a DLQ and normal workers stop receiving it. A DLQ reconciliation consumer—initially another consumer mode in the same worker application—durably marks the received event `dead_lettered`, records final metadata, and only then deletes the DLQ copy. PostgreSQL becomes the operator-facing dead-letter work queue because the sanitized event already exists there.

Replay requires an authorized human/operator action, a reason, and an audit record. It publishes a new processing message without erasing prior attempts or dead-letter history. Alert on any DLQ depth and on queue age/backlog breaching the processing SLO. These are IncidentFlow platform alarms evaluated by CloudWatch from SQS metrics and delivered through an independent operator-notification path; do not rely solely on the possibly unhealthy IncidentFlow pipeline to report its own outage.

## Future AWS platform design — not the active deployment

### Local first

1. Docker Compose starts with PostgreSQL only.
2. Add web/API Dockerfiles after the core product works.
3. Add LocalStack when S3/SNS/SQS features begin.
4. Add the worker after queues exist.

### Target AWS components — later phases

- API Gateway
- Lambda container images or an intentionally selected container service
- ECR
- S3
- SNS topic(s)
- SQS queues and dead-letter queues
- IAM roles following least privilege
- Secrets Manager
- CloudFormation templates
- CloudWatch alarms for worker failures and DLQ messages
- AWS WAF rate-based rules
- GitHub Actions with AWS OIDC

### Rate limiting

Use layers:

- AWS WAF for edge protection and high request-rate abuse.
- API Gateway route-level throttling for route protection.
- Application-level per-organization/integration quotas, especially for AI work and plan limits.

AWS infrastructure controls are useful but not a substitute for business-level quotas.

---

## Future AI brief design — Phase 9

Do not build an AI chat assistant. Build a narrow asynchronous feature called **Generate incident brief**.

For an incident and optional attachment text, return structured data such as:

- concise summary;
- category;
- suggested severity;
- impacted system;
- possible next steps;
- confidence;
- evidence references.

Store every run in `ai_runs`: input version, result, provider/model metadata, timestamps, status, error details, and human approval/rejection. The AI may suggest but must not autonomously trigger high-impact actions.
