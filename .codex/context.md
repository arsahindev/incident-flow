# IncidentFlow — Project Context and Handoff

## Purpose of this document

This document captures the decisions made before implementation so a coding assistant can continue the project without rediscovering the product scope or architecture. Treat it as the working design authority until a decision is deliberately changed.

## Owner and portfolio goal

Ali Riza Sahin is a returning full-stack engineer in Belgrade with roughly 3+ years of professional web/product engineering experience. His strongest prior experience is TypeScript, JavaScript, React/Next.js, Node.js, PostgreSQL, AWS/GCP, Docker, testing, event-driven systems, and production support. He is refreshing his skills after about one year away from programming.

IncidentFlow is intentionally a serious portfolio project. It should demonstrate current, production-oriented full-stack engineering—not merely CRUD or superficial AI integration. The work should help Ali refresh:

- TypeScript, React, Next.js, Node.js, PostgreSQL, Docker, automated tests, and CI/CD.
- APIs, authentication/authorization, data modelling, and TypeScript validation boundaries.
- WebSockets and real-time UI updates.
- Webhook ingestion and outgoing webhook delivery.
- AWS S3, SNS, SQS, Lambda/container deployment, IAM, CloudFormation, and later AWS WAF/API Gateway controls.
- Event-driven design, idempotency, retry behaviour, DLQs, the transactional outbox pattern, and eventually Debezium/CDC.
- A narrowly useful AI feature with structured output and human review.

The project must be built iteratively. Avoid adding cloud services or advanced architecture before the preceding user-facing product milestone works locally.

---

## Product definition

**IncidentFlow is a multi-tenant incident intake, routing, notification, and response-coordination SaaS for backend teams.**

It is intentionally closer to the incident-management/alerting side of Jira Service Management or Opsgenie than to New Relic.

### In scope

- Organizations, users, teams, roles, and authorization.
- Manual incident creation and management.
- Source integrations that receive signed error/alert webhooks.
- Declarative, user-configured rules that decide whether incoming events create incidents.
- Dedupe/grouping of incoming alerts.
- Inbound event audit history and processing status.
- S3-backed attachments.
- Asynchronous work through SNS, SQS, workers, retry policies, and DLQs.
- Real-time in-app dashboard updates through WebSockets.
- Email and outbound webhook notifications.
- AI-generated incident briefs, always reviewed by a human before any action.
- Docker development workflow, CloudFormation infrastructure, and GitHub Actions CI/CD.

### Explicitly out of scope

- Application performance monitoring (APM), profiling, or building a New Relic clone.
- Collecting raw metrics, logs, distributed traces, or high-cardinality time-series data.
- Building an observability agent or a broad analytics/query platform.
- PagerDuty-scale escalation scheduling.
- A large collection of third-party integrations in the initial product.

### Why this scope

New Relic-like observability is much larger: it requires agents, log/metric/trace ingestion, very high-volume data storage, indexing, query engines, dashboards, retention policies, and profiling. IncidentFlow receives already-detected alert/error events and coordinates a response. This is substantial but realistically buildable.

---

## Core user journeys

### 1. Manual incident lifecycle — first vertical slice

1. A user signs in (initially a seeded development organization may be used before authentication is built).
2. The user creates an incident.
3. The incident is persisted in PostgreSQL.
4. The dashboard lists the incident and shows its detail page/activity timeline.
5. A user changes its status or assignment and the timeline records that action.

**First milestone:** A user can create, persist, display, and update an incident locally; the data survives a PostgreSQL container restart.

### 2. Inbound source webhook lifecycle

1. An organization creates a source integration in the dashboard.
2. IncidentFlow presents a unique endpoint and secret, e.g. `POST /v1/ingest/:integrationKey`.
3. The customer API, a demo service, or eventually `@incidentflow/node` sends a signed error event over HTTPS.
4. IncidentFlow verifies the request, records it, and responds quickly with `202 Accepted`.
5. IncidentFlow queues processing asynchronously.
6. A worker evaluates the organization’s declarative rule and deduplication logic.
7. The worker creates or updates an incident and emits domain events.
8. Connected browser users receive a real-time UI update; notifications are sent asynchronously.

Example input event:

```json
{
  "eventId": "evt_01HXYZ",
  "occurredAt": "2026-08-05T12:00:00Z",
  "service": "checkout-api",
  "environment": "production",
  "error": {
    "code": "PAYMENT_PROVIDER_TIMEOUT",
    "message": "Payment provider did not respond within 10 seconds",
    "severity": "high"
  },
  "context": {
    "requestId": "req_123",
    "region": "eu-central-1"
  }
}
```

### 3. Outbound webhook lifecycle

1. A customer configures an outgoing webhook subscription in IncidentFlow.
2. They provide a destination URL and selected event types, e.g. `incident.created`, `incident.resolved`, or `ai_brief.completed`.
3. IncidentFlow stores and verifies the subscription with a test delivery.
4. A delivery worker asynchronously posts signed event payloads to the customer’s endpoint.
5. Failed deliveries retry with exponential backoff and appear in delivery history.

This is deliberately a separate capability from inbound webhook ingestion.

---

## Webhook terminology and design

A webhook is an event-driven HTTP callback integration pattern. It uses ordinary HTTP endpoints; the distinction is the direction and event-driven contract, not a different protocol.

| Direction, relative to IncidentFlow | Meaning |
|---|---|
| Inbound webhook | A customer service calls IncidentFlow because an event happened. |
| Outbound webhook | IncidentFlow calls a customer-controlled endpoint because an IncidentFlow event happened. |

The known pattern where a client starts an asynchronous operation and gives the server a callback URL is a valid outbound webhook/callback pattern:

```text
Client calls asynchronous job endpoint with callback URL
Server completes work later
Server POSTs result to callback URL
```

For IncidentFlow, prefer separately configured outbound webhook subscriptions over arbitrary callback URLs per request. This makes ownership verification, signatures, retries, delivery history, and SSRF protection practical.

### Inbound webhook security requirements

- Each integration has a unique secret; secrets are rotatable/revocable and shown only once.
- Sender signs `timestamp + "." + rawRequestBody` with HMAC SHA-256.
- Sender includes signature and timestamp headers.
- Verify the signature using a timing-safe comparison **before** JSON parsing/normalization; signing raw bytes avoids JSON re-serialization differences.
- Reject old timestamps (e.g. more than five minutes old) to mitigate replay attacks.
- Apply a unique `(integration_id, external_event_id)` database constraint for idempotency.
- Validate payloads with Zod after signature verification.
- Rate-limit public ingestion, authentication, integration-test delivery, and AI-costing endpoints.
- Redact secrets and unnecessary sensitive data before persisting received payloads.

### Declarative rules, not customer code

Do not execute arbitrary customer-provided JavaScript/TypeScript as an incident rule. It creates security, resource-exhaustion, auditability, and sandboxing problems.

Rules should use a restricted, validated schema such as:

```json
{
  "all": [
    { "field": "environment", "operator": "equals", "value": "production" },
    {
      "field": "error.code",
      "operator": "in",
      "value": ["PAYMENT_TIMEOUT", "PAYMENT_PROVIDER_DOWN"]
    }
  ],
  "action": {
    "createIncident": true,
    "priority": "high",
    "teamId": "payments"
  }
}
```

Start with `equals`, `in`, and perhaps `contains`; add count-within-time-window rules later.

### Optional Node SDK — later, not MVP

Create a small package such as `@incidentflow/node` only after generic webhooks work. It may expose `reportError()` and Express/Fastify error middleware. It sends HTTPS requests to IncidentFlow; it must **not** publish directly to IncidentFlow’s internal SQS queue or receive AWS credentials.

Start by reporting explicit errors and unhandled 5xx errors. Do not create incidents from every ordinary 4xx response.

---

## Architecture

### Planned monorepo

```text
incidentflow/
├── apps/
│   ├── api/                 # Fastify HTTP API, authentication, Socket.IO initially
│   ├── web/                 # Next.js dashboard
│   └── worker/              # Queues, outbox, notifications, AI work
├── packages/
│   └── contracts/           # Shared Zod schemas and TypeScript types
├── infra/
│   └── cloudformation/      # AWS templates, added late
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

Use a pnpm workspace. Do not add Turborepo or another orchestrator at the start; pnpm workspace scripts are sufficient.

### Technology choices

| Concern | Chosen initial approach | Rationale |
|---|---|---|
| Web app | Next.js, TypeScript, Tailwind | Current, employable frontend stack; familiar to Ali. |
| API | Fastify, TypeScript, Zod | Keeps the HTTP/webhook architecture explicit and provides a focused Node refresh. |
| Database/ORM | PostgreSQL and Prisma | Ali has used Prisma; use it to refresh rather than learn another ORM. |
| Local database | PostgreSQL in Docker Compose | Simple, reproducible local development. |
| Managed initial cloud DB | Neon PostgreSQL | Low operations; keeps early AWS learning focused on queues/storage/infrastructure. |
| Real-time, local | Socket.IO | Practical rooms, reconnects, and browser experience. |
| Real-time, later AWS | API Gateway WebSockets or a containerized socket service | Hidden behind a port/interface so domain logic does not change. |
| Async cloud messaging | SNS + SQS, with DLQs | Demonstrates event fan-out, queues, retry, and consumer patterns. |
| Local AWS simulation | LocalStack | Add only when the core app is stable. |
| Files | S3; LocalStack locally | Realistic attachment storage. |
| Infrastructure | CloudFormation | Required learning objective. |
| AI | Provider-agnostic adapter, structured incident brief | Avoid generic chat; retain provider flexibility and human approval. |
| CI/CD | GitHub Actions, then AWS OIDC + ECR + CloudFormation | No long-lived cloud credentials in GitHub. |

### Realtime design

Core domain services must not import Socket.IO directly. Define a port such as:

```ts
interface RealtimePublisher {
  publishToOrganization(
    organizationId: string,
    event: RealtimeEvent
  ): Promise<void>;
}
```

Implementations can be:

- `SocketIoRealtimePublisher` for local development.
- `ApiGatewayWebSocketPublisher` for an AWS deployment.
- `NoopRealtimePublisher` for tests.

Suggested Socket.IO rooms:

```text
organization:{organizationId}
incident:{incidentId}
user:{userId}
```

Events may include `incident.created`, `incident.updated`, `aiBrief.updated`, and `notification.created`.

WebSocket events are fast update signals, not the source of truth. On reconnection, clients fetch canonical state from the normal API.

---

## Data model, event state, and reliability

### Initial business tables

- `organizations`
- `users`
- `teams`
- `incidents`
- `incident_activity`
- `integrations`
- `incident_rules`
- `received_events`
- `outbox_events`
- `processed_messages`
- `webhook_subscriptions`
- `webhook_deliveries`
- `notifications`
- `ai_runs`

Do not create every table on day one. Start with organizations, teams, incidents, and incident activity.

### Received events / inbox

`received_events` is an audit and idempotency record for accepted inbound webhook events.

Suggested fields:

```text
id
organization_id
integration_id
external_event_id
received_at
payload_json (redacted)
payload_hash
status
matched_rule_id
incident_id
error_message
retention_expires_at
```

Suggested status progression:

```text
received → queued → processing → incident_created
                         ↘ ignored
                         ↘ failed → dead_lettered
```

This is not an infinite raw-data archive. Retention should be defined (e.g. 30–90 days), and it must never include authorization headers or secrets.

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

### Retries and exponential backoff

For transient failures, retry with increasing waits, e.g. 1s, 2s, 4s, 8s, 16s, capped at a maximum. Add jitter to avoid synchronized retry storms. After a limited number of attempts, move the message to a DLQ or mark it permanently failed with tooling to inspect/replay it.

---

## AWS and deployment decisions

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

## AI feature scope

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

---

## Implementation roadmap

### Phase 0 — setup

- pnpm workspace.
- Next.js web app.
- Fastify API with `GET /health`.
- Docker Compose PostgreSQL.
- Root README, `.env.example`, lint/typecheck/test scripts.
- First Git commit.

### Phase 1 — manual incidents

- Prisma setup and migrations.
- Seed a development organization/team.
- Incidents and activity timeline.
- API: create/list/get/status update incident routes.
- Dashboard list and incident detail page.

### Phase 2 — identity and permissions

- Authentication.
- Organizations, users, teams, membership/roles.
- Server-side authorization checks.

### Phase 3 — real-time dashboard

- Socket.IO server and authenticated rooms.
- Live updates for manual create/status/assignment actions.
- Reconnect behaviour that refetches the canonical API state.

### Phase 4 — source integration/webhook

- Integration setup UI.
- Integration key and secret creation/rotation.
- HMAC/timestamp verification and Zod payload validation.
- `received_events` audit record, idempotency constraint, and status UI.
- Local demo event sender that generates realistic checkout/service errors.

### Phase 5 — queues and outbox

- LocalStack.
- SNS, SQS, queues, DLQs.
- Worker application.
- Version-1 transactional outbox and polling dispatcher.
- Rule evaluation, incident auto-creation, dedupe/grouping.

### Phase 6 — notifications/integrations

- In-app notifications.
- Email notification worker.
- Outbound webhook subscription setup, signature, delivery records, retries.

### Phase 7 — AI brief

- Provider adapter.
- Structured output validation.
- Background worker, status updates, human approval UI.

### Phase 8 — cloud and CI/CD

- Docker images.
- ECR and AWS deployment.
- CloudFormation.
- GitHub Actions: lint/typecheck/tests/build in pull requests; build/push/deploy after merge to main.
- AWS OIDC authentication; no permanent credentials committed or stored in CI.

### Version 2

- Debezium CDC.
- Kafka/Confluent for outbox event publishing.
- Retain the same outbox table and domain-event contract.

---

## Current code state — 2026-08-05

- Project directory exists: `/Users/arsahin/Developer/incidentflow`.
- The directory is otherwise empty; no Git repository, Node project, Docker files, or application code has been created yet.
- This file is the first project artifact.

### Recommended local location

Use `/Users/arsahin/Developer/incidentflow`, not `Documents`, to avoid potential iCloud/Dropbox/OneDrive synchronization problems with `node_modules`, file watchers, and Docker bind mounts.

### Initial setup commands

Run manually from Terminal:

```bash
cd /Users/arsahin/Developer/incidentflow

git init -b main
corepack enable
pnpm init

mkdir -p apps/api/src apps/worker/src packages/contracts/src infra/cloudformation
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Then scaffold the web application:

```bash
pnpm create next-app@latest apps/web \
  --ts \
  --eslint \
  --tailwind \
  --app \
  --src-dir \
  --use-pnpm \
  --disable-git \
  --yes
```

Set the web package name to `@incidentflow/web`.

Create the API package:

```bash
cd apps/api
pnpm init
pnpm add fastify zod @fastify/cors
pnpm add -D typescript tsx @types/node
pnpm exec tsc --init
cd ../..
```

Set the API package name to `@incidentflow/api`.

---

## Immediate open tasks for the coding assistant

1. Inspect the actual repository state before modifying anything.
2. Scaffold Phase 0 only; do not jump to queues, AWS, AI, or WebSockets.
3. Create a clean root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, README, and `.env.example`.
4. Scaffold Next.js in `apps/web` and Fastify in `apps/api`.
5. Add `GET /health` to the API and a minimal web dashboard shell.
6. Add Docker Compose with PostgreSQL only, including a named volume and health check.
7. Verify web, API, and database run locally and document the commands.
8. Commit the foundation before beginning Phase 1.

## Working preferences for the coding assistant

- Teach while implementing: explain important architectural choices briefly and concretely.
- Keep changes incremental and runnable. Verify each milestone before proceeding.
- Prefer one strong, understandable implementation over unnecessary abstractions.
- Do not silently introduce Kafka/Confluent, AWS, microservices, or AI before their roadmap phase.
- Be strict about correctness around signatures, retries, idempotency, secrets, and authorization.
- Use honest portfolio-quality documentation. Do not claim "exactly once" delivery when the implementation is at-least-once plus idempotent consumers.
- Preserve the architecture’s future seams: `RealtimePublisher`, AI-provider adapter, and an outbox transport that can change from polling to Debezium without changing domain logic.
