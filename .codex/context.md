# IncidentFlow — Project Context and Handoff

## Purpose of this document

This document captures product, domain, architecture, reliability, and implementation decisions so a coding assistant can continue the project without rediscovering its intent. Treat it as the working design authority until a decision is deliberately changed. Keep it current when a milestone changes the product model or architecture; do not let the handoff drift behind the actual repository.

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

### Portfolio quality bar

The product should make a potential employer believe Ali can design, build, operate, secure, and evolve a real SaaS system. A feature is not portfolio-ready merely because its happy path works. Relevant milestones should demonstrate:

- deliberate multi-tenant data isolation and server-side authorization;
- validated API contracts and explicit domain boundaries;
- migrations, constraints, indexes, transactions, and auditable state transitions;
- unit, integration, contract, and selected end-to-end tests;
- idempotency, retries, timeouts, backoff, leases, DLQs, and replay tooling where asynchronous work exists;
- structured logs, correlation IDs, metrics, traces, dashboards, health/readiness checks, and actionable alerts;
- secrets management, rate limiting, input limits, SSRF defenses, dependency scanning, and least-privilege IAM;
- operational tooling for failed work, delivery history, incident history, retention, and recovery;
- CI quality gates, reproducible environments, infrastructure as code, deployment safety, and rollback/runbooks;
- honest documentation of guarantees, tradeoffs, failure modes, and deliberately deferred scale.

Production-ready does **not** mean adding every enterprise feature. It means implementing a coherent scope deeply, testing failure paths, making it operable, and avoiding claims the system cannot support.

---

## Product definition

**IncidentFlow is a multi-tenant alert intake, incident routing, notification, and response-coordination SaaS for engineering and operations teams.**

Opsgenie is the clearest product-category reference. IncidentFlow should demonstrate the core concepts that make an Opsgenie-class product technically interesting: services, alerts/events, rules and deduplication, incident coordination, ownership, responders, notifications, audit history, reliability, and later bounded on-call/escalation behavior. It is not intended to copy Atlassian’s proprietary UI or become a drop-in feature-complete clone.

Jira Service Management is a secondary reference for IT service-management workflows, service catalogs, major incidents, SLAs, stakeholder communication, problems, changes, and post-incident reviews. IncidentFlow is not a general-purpose Jira project or ticket tracker.

### In scope

- Organizations, users, teams, roles, and authorization.
- An organization-wide service catalog representing applications, APIs, platforms, infrastructure, business capabilities, and external dependencies.
- Service ownership, criticality tiers, operational status, service-specific environments, and later service dependencies.
- First-class alerts normalized from manual/API/integration events, with acknowledgement, ownership, deduplication, history, and closure.
- Incidents created manually or from one or more alerts; alerts do not automatically imply a service-disrupting incident.
- Incidents associated with one or more affected services and filterable by service/team/status/priority.
- Manual incident creation and management.
- Source integrations that receive signed error/alert webhooks.
- Declarative, user-configured rules that normalize and route incoming events into alerts and may explicitly create or link incidents from those alerts.
- Dedupe/grouping of incoming alerts.
- Inbound event audit history and processing status.
- S3-backed attachments.
- Asynchronous work through SNS, SQS, workers, retry policies, and DLQs.
- Real-time in-app dashboard updates through WebSockets.
- Email and outbound webhook notifications.
- Major-incident coordination, responders, stakeholders, service-level targets, and post-incident learning in later phases.
- A deliberately bounded on-call schedule and escalation-policy capability after notification delivery is reliable.
- AI-generated incident briefs, always reviewed by a human before any action.
- Docker development workflow, CloudFormation infrastructure, and GitHub Actions CI/CD.

### Explicitly out of scope

- Application performance monitoring (APM), profiling, or building a New Relic clone.
- Collecting raw metrics, logs, distributed traces, or high-cardinality time-series data.
- Building an observability agent or a broad analytics/query platform.
- A general-purpose project-management/issue-tracking product or a clone of Jira Software.
- A full enterprise CMDB in the initial product; the service catalog begins deliberately small.
- Multi-service source-integration credentials. Each initial integration is intentionally scoped to one service environment; centralized providers use separate integration records.
- PagerDuty/Opsgenie-scale global telephony, scheduling, and escalation infrastructure in the initial product. A smaller, well-tested on-call model may be built later.
- A large collection of third-party integrations in the initial product.

### Why this scope

New Relic-like observability is much larger: it requires agents, log/metric/trace ingestion, very high-volume data storage, indexing, query engines, dashboards, retention policies, and profiling. IncidentFlow receives already-detected alert/error events and coordinates a response. This is substantial but realistically buildable.

### Domain terminology: services, applications, projects, and teams

Use **service** as the primary operational entity, not `project` or `application`:

- A **service** is something that delivers value or capability and can be affected by an incident: `checkout-api`, `payment-processing`, `customer-portal`, `mobile-app`, `postgres-primary`, or `stripe`.
- An **application** is one possible service type. The word is too narrow for databases, infrastructure, platforms, business capabilities, and third-party dependencies.
- A **project** usually means a temporary body of work or a Jira-style workspace. Do not use it for the system affected by an incident. Add projects only if IncidentFlow later needs administrative workspaces distinct from services.
- A **team** answers “who normally owns or responds?” A service answers “what is affected?” An incident may be coordinated by a team other than the affected service’s normal owner.
- An **incident** may affect multiple services. Model this with an `incident_affected_services` join table rather than a single `service_id` column. A relation may later mark one affected service as primary without losing the many-to-many model.

The first service-catalog version should include:

```text
services
  id
  organization_id
  owner_team_id (nullable while onboarding)
  name
  slug
  description
  type (application, api, platform, infrastructure, business, external)
  tier (critical, high, medium, low)
  status (operational, degraded, disrupted, maintenance)
  created_at
  updated_at

service_environments
  id
  organization_id
  service_id
  name
  kind (development, test, staging, production, preview, other)
  is_ephemeral
  expires_at (nullable)
  status (active, archived)
  created_at
  updated_at

incident_affected_services
  organization_id
  incident_id
  service_id
  is_primary
  created_at
```

Use composite organization-scoped foreign keys/unique constraints so an incident cannot reference another tenant’s service. Do not automatically derive incident priority from service tier in the first version; make that a later explicit rule so the behavior is visible and configurable.

Environments belong to services, not directly to organizations. An organization may use common names such as development, test, staging, and production across its catalog, while an individual service may also define preview or feature-branch environments. Creating another environment must not create another service. Ephemeral environments may have an expiry/archive lifecycle so the catalog does not grow forever.

Keep these operational records distinct:

- An **event** is an immutable observation received from an integration or internal producer. It is retained for audit/idempotency and may be ignored, rejected, or folded into an alert.
- An **alert** is an actionable, deduplicated signal for responders. Repeated matching events append evidence and update aggregate counters/timestamps on one alert; an alert can be acknowledged, assigned, snoozed later, and closed without declaring a service incident.
- An **incident** coordinates restoration and communication for an actual or suspected service disruption. It may be created manually or linked to one or more alerts and may affect multiple services.
- A **notification/delivery** is an attempt to tell a person or external system about an alert or incident; it is not the alert itself.

Events do not directly create incidents. Event processing creates a new alert or deduplicates the event into an existing alert. A responder or an explicit automation rule may then create an incident and link the relevant alert, or link the alert to an existing incident.

Preserve these relationships through explicit join tables:

```text
alert_events
  organization_id
  alert_id
  received_event_id
  associated_at

incident_alerts
  organization_id
  incident_id
  alert_id
  linked_at
  linked_by_user_id (nullable)
  linked_by_rule_id (nullable)
```

`alert_events` preserves which immutable observations contributed to an alert. `incident_alerts` supports grouping related alerts into an incident without losing each alert's source, deduplication history, or independent lifecycle. Manual and automated linking/unlinking must be auditable. In the first implementation, one received event normally contributes to one alert, but the join-table model keeps lineage explicit and avoids embedding incident references in raw event records.

---

## Core user journeys

### 1. Manual incident lifecycle — first vertical slice

1. A user signs in and selects an organization through a revocable server-managed session.
2. The user creates an incident and identifies priority, owning/coordinating team, and affected service(s) as those capabilities become available.
3. The incident is persisted in PostgreSQL.
4. The dashboard lists the incident and shows its detail page/activity timeline.
5. A user changes its status or assignment and the timeline records that action.

**First milestone:** A user can create, persist, display, and update an incident locally; the data survives a PostgreSQL container restart.

### 2. Service catalog and affected-service lifecycle

1. An organization creates a service such as Checkout API, Payment Processing, Customer Portal, or Stripe.
2. The service has a type, criticality tier, and owning team.
3. A user selects one or more affected services when creating or updating an incident.
4. The incident detail shows affected services and ownership context.
5. The dashboard can filter incidents by affected service and show service-specific incident history.
6. Later, integrations belong to a specific service environment, and service relationships reveal potentially affected upstream/downstream systems.

**Service-catalog milestone:** An organization can model what it operates, associate multiple affected services with an incident, and answer “which incidents affected this service?” without confusing services with teams or projects.

### 3. Inbound source webhook lifecycle

1. An organization creates a source integration in the dashboard.
2. The integration is bound to exactly one service environment in the initial model. A service environment may have several integrations because several trusted tools may observe it.
3. IncidentFlow presents an opaque public integration key in a unique endpoint plus a separate signing secret shown once, e.g. `POST /v1/events/:integrationKey`.
4. The customer API, a demo service, or eventually `@incidentflow/node` sends a signed error event over HTTPS.
5. IncidentFlow verifies the request, records it, and responds quickly with `202 Accepted`.
6. IncidentFlow queues processing asynchronously.
7. A worker evaluates the organization’s declarative rules, service mapping, and alert deduplication/grouping key.
8. The worker creates an alert or deduplicates the event into an existing alert, preserving the event as evidence and updating the alert's occurrence count and last-seen timestamp.
9. An explicit rule or responder action may create an incident and link the alert, or link it to an existing incident, when service-restoration coordination is warranted.
10. Connected browser users receive a real-time UI update; notifications are sent asynchronously.

Example input event:

```json
{
  "eventId": "evt_01HXYZ",
  "occurredAt": "2026-08-05T12:00:00Z",
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

The integration record—not untrusted payload fields—is authoritative for organization, service, and environment. A payload may echo service/environment as assertions for readability, but if present they must match the integration configuration or be rejected.

### 4. Outbound webhook lifecycle

1. A customer configures an outgoing webhook subscription in IncidentFlow.
2. They provide a destination URL and selected event types, e.g. `incident.created`, `incident.resolved`, or `ai_brief.completed`.
3. IncidentFlow stores and verifies the subscription with a test delivery.
4. A delivery worker asynchronously posts signed event payloads to the customer’s endpoint.
5. Failed deliveries retry with exponential backoff and appear in delivery history.

This is deliberately a separate capability from inbound webhook ingestion.

### 5. Major-incident and stakeholder lifecycle — later phase

1. A high-impact incident is declared a major incident manually or by an explicit rule.
2. A coordinator/incident commander, responders, and affected services are visible.
3. Internal responders see the operational timeline; stakeholders receive curated updates rather than every technical event.
4. Acknowledgement, mitigation, restoration, resolution, and closure timestamps are recorded distinctly.
5. Service-level targets show whether acknowledgement and restoration are on track or breached.
6. Resolution requires a summary and suitable closure information; a closed incident may be reopened with an audited reason.
7. A post-incident review records impact, contributing factors, lessons, and follow-up actions.
8. Recurring or root-cause work can link the incident to a problem record; a risky remediation can link to a change record.

This journey is intentionally later than reliable intake, persistence, event processing, and notification delivery. Do not build a ceremonial ITIL form before the operational foundations work.

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

### Source integration model

A source **integration** is not a service and is not a pull subscription. It is the organization-owned credential and configuration boundary that authorizes a particular external sender—such as an application, Datadog monitor, Grafana, Prometheus Alertmanager, or custom script—to push events about one configured service environment.

Initial ownership hierarchy:

```text
organization
  └── service
        └── service environment
              └── one or more source integrations
                    └── received events
```

An external sender cannot use public ingestion without an active integration. Manual alert/incident creation inside the authenticated application is a separate path and does not require a source integration.

Suggested initial fields:

```text
integrations
  id
  organization_id
  service_environment_id
  name
  type
  public_integration_key
  encrypted_signing_secret
  status
  created_at
  last_used_at
  revoked_at
```

Each integration initially belongs to exactly one service environment. This provides explicit attribution, separate credentials, revocation, audit history, and rate limits without forcing users to create separate services for development/staging/production. The same service environment may have multiple integrations when multiple tools observe it.

Multi-service integration credentials are not planned. A centralized provider that observes several services uses separate IncidentFlow integration records for each service environment. This keeps attribution, credentials, revocation, quotas, and blast radius isolated. A future product decision may deliberately revisit this only if measured customer configuration burden justifies the mapping and security complexity; do not preserve speculative schema for it now.

Provisioning flow:

1. An organization admin selects a service and one of its environments, then creates an integration.
2. IncidentFlow generates an opaque `public_integration_key` such as `int_live_abc123` and a separate high-entropy signing secret.
3. IncidentFlow returns an ingest URL such as `POST https://ingest.incidentflow.example/v1/events/int_live_abc123` and shows the signing secret once.
4. The sender computes an HMAC over `timestamp + "." + rawRequestBody` with the signing secret and sends the timestamp, signature, and external event ID in headers.
5. IncidentFlow uses the public key to find the integration, derives organization/service/environment from it, verifies the signature and replay window, validates/stores the event, and enqueues its internal ID.

The public integration key is an identifier, not the authentication secret. Never put the signing secret in the URL because URLs commonly appear in proxy logs, monitoring, and browser/history tooling. Support secret rotation overlap, revocation, and last-used metadata.

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

Keep two rule stages conceptually distinct even if they later share one versioned evaluator:

- **Alert rules** evaluate accepted events and control normalization, explicit suppression, priority, ownership/routing, notification actions, and deduplication inputs. If no custom alert rule matches, a valid event follows a safe default policy that creates or deduplicates an alert; it is not silently ignored.
- **Incident rules** evaluate alerts and may explicitly create an incident or link an alert to a compatible open incident. Responders may perform the same create/link actions manually.

`ignored` means a valid event was intentionally suppressed by an explicit rule or maintenance policy. `rejected` means the request/event is invalid, unauthorized, or permanently unprocessable. A missing custom-rule match by itself is not ignored or rejected.

### Optional Node SDK — later, not MVP

Create a small package such as `@incidentflow/node` only after generic webhooks work. It may expose `reportError()` and Express/Fastify error middleware. It sends HTTPS requests to IncidentFlow; it must **not** publish directly to IncidentFlow’s internal SQS queue or receive AWS credentials.

Start by reporting explicit errors and unhandled 5xx errors. Do not create incidents from every ordinary 4xx response.

---

## ITIL alignment

### What ITIL means for IncidentFlow

ITIL (historically “Information Technology Infrastructure Library”) is adaptable best-practice guidance for managing digital and IT services. It is not a mandated database schema or a single universal status workflow.

The purpose of ITIL Incident Management is to minimize the negative impact of incidents by restoring normal service operation as quickly as possible. IncidentFlow should therefore optimize for rapid detection, triage, ownership, communication, mitigation/restoration, resolution, and learning—not for collecting fields or forcing ceremony.

Use these distinctions consistently:

| Record/practice | Purpose |
|---|---|
| Event/alert | A detected change or signal that may require attention; not every alert becomes an incident. |
| Incident | An unplanned interruption to a service or reduction in service quality; focus on restoring service. |
| Major incident | A high-impact incident requiring exceptional urgency, coordination, and communication. |
| Problem | The actual or potential cause of one or more incidents; focus on root cause, workarounds, and known errors. |
| Change | A controlled modification that may remediate a problem or alter a service; focus on risk and safe implementation. |
| Service request | A normal, predefined user request; it is not an incident and is outside the initial product scope. |

### Product capabilities that support ITIL-aligned incident management

Plan the following capabilities, but add them in the roadmap order rather than all at once:

- service catalog and affected services;
- impact and urgency captured separately from priority;
- configurable priority matrix or explicit priority override with an audit reason;
- categorization and source/channel (`manual`, `monitoring`, `webhook`, later user-reported);
- ownership, responders, coordinator/incident commander, and stakeholder audiences;
- explicit timestamps for detected, created, acknowledged, mitigated/restored, resolved, closed, and reopened;
- an auditable lifecycle that can represent investigation and restoration without conflating resolution with closure;
- major-incident declaration and a stronger coordination/communication path;
- acknowledgement and restoration/resolution service-level targets;
- resolution summary, resolution code, workaround, closure confirmation, and reopen reason;
- knowledge/runbook links and an evidence-preserving activity timeline;
- post-incident review, follow-up actions, and links to problem/change records;
- operational metrics such as MTTA, time to mitigation/restoration, time to resolution, SLA attainment, reopen rate, incident volume per service, and recurring incidents;
- regular review and continual improvement of rules, incident models, runbooks, services, and response performance.

Potential lifecycle vocabulary:

```text
open → acknowledged/investigating → mitigated/restored → resolved → closed
  ↑                                      │                    │
  └──────────────────── reopened ────────┴────────────────────┘
```

This is a starting product model, not a claim that ITIL requires those exact status names. Preserve timestamps for important milestones even if the display workflow is later made configurable.

### Claims and certification language

Until independently accredited, describe IncidentFlow as:

> Designed around ITIL-aligned incident-management practices.

Do **not** call IncidentFlow “ITIL compliant,” “ITIL certified,” or an officially ITIL-compatible tool. PeopleCert’s Accredited Tool Vendor programme is the authoritative route for official tool accreditation. Formal accreditation is not a portfolio milestone, but the design should be explainable against Incident Management, Monitoring and Event Management, Problem Management, Change Enablement, Service Level Management, Knowledge Management, and Continual Improvement concepts.

Reference points as of 2026-08-12:

- PeopleCert ITIL Incident Management: <https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1/itil4-practices-incident-management-3684>
- PeopleCert Accredited Tool Vendors: <https://atv.peoplecert.org/>
- Atlassian services: <https://support.atlassian.com/jira-service-management-cloud/docs/what-is-services/>
- Atlassian services and incidents: <https://support.atlassian.com/jira-service-management-cloud/docs/how-services-work-with-incidents/>
- Opsgenie services: <https://support.atlassian.com/opsgenie/docs/what-are-services-in-opsgenie/>

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
| Internal web-to-API HTTP | Native `fetch` plus a small tested response parser | Next.js already integrates with `fetch`; a focused wrapper supplies typed errors and runtime contracts without Axios-level abstraction. |
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

### Domain and application boundaries

Keep HTTP, domain/application logic, persistence, and external transports separable without creating needless microservices:

- Fastify route handlers authenticate/authorize, validate transport input, call application services, and map errors to HTTP responses.
- Application/domain services own incident transitions, authorization-relevant invariants, affected-service rules, timeline creation, and transactional behavior.
- Repository interfaces hide Prisma where a seam materially improves testing or future transport changes; do not wrap every ORM call mechanically.
- Shared Zod contracts define public API/event boundaries. Generated Prisma types are persistence types and must not become the public contract by accident.
- `packages/contracts` owns the coded error envelope and the first runtime-validated identity/session response schemas. Migrate incident, service, event, and realtime contracts there incrementally when those boundaries change; do not create a speculative all-domain schema rewrite.
- The Next.js backend-for-frontend uses native `fetch`. Its shared parser consumes a response body once, handles `204`, rejects malformed or contract-invalid success responses, safely classifies non-JSON failures, and preserves HTTP status, stable error code, validation issues, and request ID in `ApiError`.
- Domain changes and their activity/outbox records should be committed atomically where consistency requires it.
- External effects—notifications, webhooks, AI calls, email, WebSockets, and broker publishing—must not occur inside a database transaction.
- Preserve ports for realtime publishing, event publishing, notification delivery, object storage, clock/ID generation where deterministic tests or provider replacement justify them.

### Realtime design

Core domain services must not import Socket.IO directly. Phase 3 implements this port:

```ts
interface RealtimePublisher {
  publishIncidentSignal(
    organizationId: string,
    incidentId: string,
    signal: RealtimeIncidentSignal
  ): Promise<void>;
}
```

Current and planned implementations are:

- `SocketIoRealtimeAdapter` for local development.
- `ApiGatewayWebSocketPublisher` for an AWS deployment.
- `NoopRealtimePublisher` for tests.

Suggested Socket.IO rooms:

```text
organization:{organizationId}
incident:{incidentId}
user:{userId}
```

Phase 3 incident signals are `incident.created`, `incident.status_changed`, `incident.assignment_changed`, `incident.affected_services_changed`, and `incident.activity_updated`. They contain only a contract schema version, incident ID, monotonic incident version, and timestamp. Socket rooms, cookie parsing, origin checks, buffering policy, and Socket.IO types stay inside the adapter.

The Socket.IO handshake is the narrow ambient-cookie exception to the normal backend-for-frontend HTTP flow: it reads the existing `HttpOnly` session cookie server-side, requires the exact configured web origin, and reuses the authoritative session service. Organization and user rooms are joined only from authenticated context. Incident-room joins accept only an incident ID and reauthorize tenant membership and `incidents.read` server-side.

WebSocket events are fast, best-effort update signals, not the source of truth or durable domain events. Clients reject non-newer incident versions and refetch canonical API state after accepted signals and reconnects. Logout, organization switching, membership suspension, periodic session revalidation, bounded payloads/room counts, volatile backpressure drops, slow-client disconnection, and transport-neutral metrics seams are part of the Phase 3 boundary. See ADR 0003.

---

## Cross-cutting production-readiness requirements

These are ongoing acceptance criteria, not one final “hardening sprint.” Apply each item when the relevant feature first appears.

### Tenant isolation and authorization

- Never accept an `organization_id` from the browser as proof of tenant context.
- Derive organization/user context from the authenticated session/token and verify membership server-side.
- Scope every tenant-owned query and mutation by organization; prefer composite organization-scoped constraints and foreign keys as defense in depth.
- Define a permission matrix for roles and high-impact actions. A UI-hidden button is not authorization.
- Test cross-tenant access attempts, insecure direct-object references, role boundaries, disabled users, and revoked sessions.
- Record actor identity and request/correlation ID for material audit events once identity exists.

### API and application security

- Validate path, query, headers, and bodies with strict schemas; enforce maximum sizes and reject unknown/unsafe shapes where appropriate.
- Centralize safe error mapping; do not leak stack traces, connection details, secrets, or raw provider responses.
- API failures use `{ error: { code, message, issues?, requestId } }`; every response exposes the same request ID in `X-Request-Id`. UI behavior should branch on stable codes/status rather than matching human-readable messages.
- Use secure cookies or carefully scoped tokens, CSRF protection where cookie authentication requires it, password hashing through an established library, session rotation/revocation, and login rate limiting.
- Apply HMAC verification to raw webhook bytes, timing-safe comparison, replay windows, secret rotation, and idempotency constraints.
- Validate outbound destinations and defend against SSRF, DNS rebinding, private/link-local addresses, redirect abuse, and oversized/slow responses.
- Add dependency/security scanning, secret scanning, locked dependencies, and a documented vulnerability-handling process in CI.

### Reliability and consistency

- Make state transitions explicit and transactionally record the corresponding activity/domain event.
- Use idempotency keys or natural unique constraints for externally retried commands.
- Put timeouts on network calls and database operations where supported; propagate cancellation when practical.
- Classify retryable versus permanent failures. Use capped exponential backoff with jitter, limited attempts, and DLQ/permanent-failure visibility.
- Treat queues and brokers as at-least-once. Consumers must be idempotent; never claim exactly-once processing.
- Provide safe replay/retry tooling with permissions and an audit trail rather than relying on manual database edits.
- Document backup, restore, migration rollback/roll-forward, and disaster-recovery expectations before calling the cloud deployment production-like.

### Observability and operability

- Emit structured logs with timestamp, level, service, environment, request ID, trace/correlation ID, organization ID where safe, route/job name, duration, outcome, and sanitized error classification.
- Add HTTP request metrics, latency/error rates, database-pool saturation, queue age/depth, retry counts, DLQ counts, webhook delivery outcomes, WebSocket connection counts, and AI usage/cost when relevant.
- Add distributed tracing across API → outbox/broker → worker → external delivery paths when asynchronous work exists.
- Separate liveness from readiness. Readiness should fail when a required dependency prevents useful service.
- Define actionable alerts and runbooks for API error/latency, database exhaustion, stuck outbox leases, queue backlog, DLQ messages, and repeated delivery failures.
- Build operator-facing views for received events, processing state, failed messages, retries, deliveries, and replay rather than hiding failures in logs.

### Testing strategy

- Unit tests: schemas, authorization policies, rule evaluation, dedupe keys, priority calculations, transition invariants, retry classification, and pure domain logic.
- Repository/integration tests: real PostgreSQL migrations, organization scoping, constraints, transactions, concurrent claims, and rollback behavior.
- API contract tests: status codes, validation, error shape, authentication, authorization, idempotency, pagination/filtering, and rate limits.
- Worker tests: duplicate delivery, transient/permanent failure, retry scheduling, poison messages, lease expiry, and DLQ behavior.
- End-to-end tests: a small set of valuable journeys such as sign-in, service creation, incident creation, status/assignment change, webhook ingestion, and failure inspection.
- Migration tests: apply all migrations from an empty database and, when practical, upgrade a representative previous schema/data snapshot.
- Do not optimize for coverage percentage alone; cover invariants and failure modes that would create security or reliability incidents.

### Data lifecycle and privacy

- Classify stored data and minimize raw inbound payloads. Redact authorization headers, secrets, tokens, and unnecessary personal data before persistence or logging.
- Define retention for received events, webhook delivery bodies, audit logs, attachments, AI inputs/outputs, and deleted organizations.
- Use UTC timestamps in persistence/contracts and format only at the presentation edge.
- Support safe organization offboarding/export/deletion later; deletion jobs must be idempotent and auditable.
- Encrypt data in transit and at rest; manage secrets with environment isolation locally and Secrets Manager or equivalent in cloud.

### Performance and scalability

- Add pagination to unbounded lists and stable ordering/cursors before volumes make it urgent.
- Create indexes from observed query patterns and inspect query plans for important dashboards and worker claims.
- Avoid N+1 queries and unbounded payload expansion, especially timelines, affected services, event histories, and deliveries.
- Define load-test scenarios and realistic initial service-level objectives before cloud release; measure instead of inventing scale claims.
- Prefer modular-monolith boundaries and independently scalable worker processes before splitting into microservices.

### CI/CD and release discipline

- Pull requests must run formatting/lint, typecheck, tests, production builds, migration validation, and security checks.
- Use ephemeral PostgreSQL in CI for integration/migration tests.
- Use AWS OIDC and least-privilege deployment roles; never store long-lived AWS access keys in GitHub.
- Produce immutable versioned images, track the deployed commit/schema version, and retain a rollback or safe roll-forward procedure.
- Apply infrastructure changes through reviewed CloudFormation change sets. Separate environments and protect production-like deploys.
- Maintain concise architecture decision records and runbooks for decisions/failure modes a reviewer or operator would reasonably ask about.

---

## Data model, event state, and reliability

### Staged business tables

- `organizations`
- `users`
- `organization_memberships`
- `teams`
- `team_memberships`
- `services`
- `service_environments`
- `service_dependencies` (later)
- `alerts`
- `alert_events`
- `incidents`
- `incident_alerts`
- `incident_affected_services`
- `incident_activity`
- `incident_responders` (later)
- `incident_stakeholders` (later)
- `incident_service_targets` (later)
- `post_incident_reviews` and follow-up actions (later)
- `problems` / incident-problem links (later)
- `changes` / incident-change links (later)
- `integrations`
- `alert_rules`
- `incident_rules` (later)
- `received_events`
- `event_processing_attempts` (with bounded retention when async processing exists)
- `outbox_events`
- `processed_messages`
- `webhook_subscriptions`
- `webhook_deliveries`
- `notifications`
- `on_call_schedules`, rotations/overrides, and `escalation_policies` (bounded later phase)
- `ai_runs`

Do not create every table at once. Organizations, teams, incidents, and incident activity were the first slice. Services and affected-service relations are the next domain foundation. Add later tables only with the user-facing/operational milestone that exercises them.

### Incident and service invariants

- Every tenant-owned row has an organization boundary, directly or through a constraint that cannot cross organizations.
- An incident can affect zero services temporarily during migration/onboarding, but normal UI/API flows should encourage at least one affected service once the catalog exists.
- Multiple affected services are allowed. At most one relation may be marked `is_primary = true`; enforce this with an appropriate PostgreSQL partial unique index if Prisma cannot express it directly.
- Service ownership does not silently overwrite the incident’s coordinating team. Automation may suggest or explicitly route based on the primary service owner.
- Service tier is business criticality; incident priority is the urgency/order of response to a specific event. They are related but not identical.
- Incident lifecycle changes, assignments, affected-service changes, priority overrides, major-incident declarations, and reopen/closure actions must be auditable.
- Preserve meaningful milestone timestamps rather than trying to reconstruct them later from mutable status alone.

### Event, alert, and incident invariants

- A received event is immutable after acceptance except for processing status and sanitized error/result metadata.
- Events never directly create or reference incidents. Event processing first creates an alert or associates the event with an existing alert; incident lineage is then represented through `incident_alerts`.
- Alert dedupe keys are organization- and integration/service-scoped; the same customer-provided key in another tenant can never collide.
- Repeated events append evidence/history and update counters/timestamps on an existing open alert rather than overwriting the original event.
- `alert_events` records event-to-alert lineage. Enforce organization consistency and prevent the same event/alert association from being inserted twice.
- Alert acknowledgement/closure and incident lifecycle are separate state machines. Closing an alert must not silently resolve a linked incident, and resolving an incident must not erase alert history.
- An alert may link to zero or more incidents and an incident to zero or more alerts; enforce all links within one organization.
- `incident_alerts` is the sole source of truth for alert-to-incident association; do not duplicate `incident_id` on `received_events`.
- Rule-driven incident creation/linking and manual linking/unlinking must be explicit, idempotent, and recorded in the audit timeline. Store either the initiating user or rule where available.
- Received-event processing status, alert lifecycle status, and incident lifecycle status are three independent state machines.
- Every externally received event is authorized through an active integration and therefore has an unambiguous organization, service, and environment. The integration configuration is authoritative; payload assertions cannot switch those boundaries.
- A missing custom alert-rule match uses the integration's safe default alert policy. Only an explicit suppression/maintenance decision produces `ignored`.

### Received-event inbox and processing audit

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
processing_status
matched_rule_id
processing_attempt_count
next_processing_attempt_at (nullable)
last_processing_error_code (nullable)
last_processing_error_message (sanitized, nullable)
retention_expires_at
```

Suggested status progression:

```text
received → queued → processing → alert_created
                         ↘ alert_deduplicated
                         ↘ ignored
                         ↘ rejected
                         ↘ retry_scheduled → processing
                                             ↘ dead_lettered
```

These are enum-like processing-status values, not embedded alert objects. `alert_created` means the event produced a new alert. `alert_deduplicated` means it matched an existing open alert: the event is linked through `alert_events`, retained as evidence, and the alert's occurrence count and last-seen timestamp are updated. The alert itself lives in `alerts`; related incidents are discovered through `alert_events` and `incident_alerts` rather than a direct `incident_id` on the event.

`processing_attempt_count` counts IncidentFlow worker attempts for this event, not occurrences of the customer's error. `next_processing_attempt_at` is populated only while a transient failure is waiting for retry and records the expected earliest retry time; it is null before failure and after any terminal result. The `last_processing_error_*` fields summarize the latest IncidentFlow processing failure, not the error reported by the customer payload. Stable codes support filtering/metrics/retry classification; the sanitized message helps operators. When async processing is implemented, preserve bounded per-attempt diagnostic history in `event_processing_attempts` and apply retention rather than storing unbounded arrays on `received_events`.

`retry_scheduled` means another automatic attempt is expected. `rejected` is a terminal permanent input/configuration decision for which retry cannot help. `dead_lettered` means retryable or unknown processing failures exhausted the queue's automatic-attempt policy and now require inspected, audited replay.

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

`processed_messages` is not a customer-facing event index or query optimization. It records completion independently per consumer because one domain message may be handled by notification, webhook, realtime, analytics, and other consumers. `received_events.processing_status` describes inbound event processing and cannot prove that every downstream consumer completed the same message.

### Retries and exponential backoff

For transient failures, retry with increasing waits capped at a maximum and add jitter to avoid synchronized retry storms. The worker leaves the SQS message unacknowledged and may change its visibility timeout to the selected delay; after the visibility period, SQS can deliver it again. Persist `retry_scheduled`, the attempt count, expected next attempt time, and sanitized latest processing error for operator visibility.

Classify failures explicitly:

- retryable: temporary dependency, database, lock, or infrastructure failure;
- permanent: invalid/unsupported data or configuration that retry cannot repair; record `rejected` and acknowledge the message;
- unknown: retry a small bounded number of times, then dead-letter for investigation.

Use an SQS redrive policy with a deliberately chosen maximum receive count (approximately five initially, validated through failure tests). Once exhausted, SQS moves the message to a DLQ and normal workers stop receiving it. A DLQ reconciliation consumer—initially another consumer mode in the same worker application—durably marks the received event `dead_lettered`, records final metadata, and only then deletes the DLQ copy. PostgreSQL becomes the operator-facing dead-letter work queue because the sanitized event already exists there.

Replay requires an authorized human/operator action, a reason, and an audit record. It publishes a new processing message without erasing prior attempts or dead-letter history. Alert on any DLQ depth and on queue age/backlog breaching the processing SLO. These are IncidentFlow platform alarms evaluated by CloudWatch from SQS metrics and delivered through an independent operator-notification path; do not rely solely on the possibly unhealthy IncidentFlow pipeline to report its own outage.

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

Each phase must produce a demonstrable user or operator outcome, include tests proportionate to risk, update documentation, and leave the project runnable. Cross-cutting production requirements apply from the phase in which their underlying capability first exists.

### Phase 0 — foundation (complete)

- pnpm workspace with Next.js web and Fastify API.
- `GET /health`.
- PostgreSQL in Docker Compose with a named volume and health check.
- Root environment example, README, lint/typecheck/test/build scripts.
- Initial Git foundation commit.

### Phase 1 — manual incident lifecycle (complete)

- Prisma 7 with PostgreSQL driver adapter, migration, and idempotent seed.
- Seeded development organization and Platform team.
- Organization-scoped incidents and transactional activity timeline.
- API routes for teams and create/list/get/update incident operations with Zod validation.
- Dashboard incident summary/list, creation form, detail view, status/team controls, loading/error/not-found states.
- Browser-level lifecycle verification and PostgreSQL container-restart persistence verification.

The earlier fixed-development-tenant limitation was removed in Phase 2. Protected API operations now require authenticated, server-derived tenant context.

### Phase 1.5 — service catalog and affected services (complete)

This is a domain-foundation milestone, not scope creep. It makes IncidentFlow authentically service-oriented before authentication, webhook routing, rules, and notifications depend on the wrong model.

Implemented outcome: the organization has a service catalog with service-owned environments; incidents can affect multiple services with one primary designation; users can manage services/environments, see service-specific incident history, and filter incidents by service, team, status, and priority. Existing development incidents were intentionally left unclassified rather than receiving fabricated affected-service history. Newly created incidents require at least one affected service at the API/UI boundary.

#### Data and invariants

- Add `services` with organization, owning team, name/slug, description, type, tier, operational status, timestamps, and suitable indexes.
- Add service-owned environments with a unique name/slug per service, kind, active/archived lifecycle, and optional ephemeral/expiry metadata. Seed normal development/staging/production examples without requiring every service to use the same set.
- Enforce that only ephemeral service environments may have an expiry through API validation, repository state validation, and a PostgreSQL check constraint.
- Add `incident_affected_services` with organization-scoped composite foreign keys, unique incident/service membership, `is_primary`, and an at-most-one-primary constraint.
- Seed realistic services such as Checkout API, Payment Processing, Customer Portal, PostgreSQL Primary, and Stripe.
- Migrate existing development incidents safely; either leave them temporarily unclassified with clear UI or attach an explicit seeded service based on a documented migration decision.
- Record affected-service additions/removals/primary changes in `incident_activity`.
- Keep service ownership and incident coordinating-team assignment distinct.

#### API and UI

- Service create/list/get/update/archive APIs with strict organization scoping and validation.
- Service catalog/detail page with type, tier, owner, status, service environments, and incident counts/history.
- Service environment create/update/archive workflows; creating an environment never creates a duplicate service.
- Incident creation/update supports multiple affected services and one optional primary service.
- Incident detail displays affected services and owner context.
- Dashboard filtering by service, team, status, and priority with URL-backed filters.
- Add pagination/stable ordering before lists become unbounded.

#### Quality and operations

- Unit tests for service schemas and primary-service invariant.
- PostgreSQL integration tests for cross-tenant foreign keys and unique constraints.
- API tests for service filtering and invalid/cross-organization references.
- Browser tests for service creation, incident association, and service filtering.
- Add baseline GitHub Actions CI now if it is not already present: install with frozen lockfile, Prisma generation, migration validation/integration database, lint, typecheck, tests, and production build.

Do not add dependency graphs, automatic priority mapping, broad CMDB fields, or status-page publishing yet. Preserve seams for those later capabilities.

### Phase 2 — identity, memberships, and authorization (complete)

- Opaque server-managed sessions use random bearer secrets while PostgreSQL stores only SHA-256 digests. The Next.js backend-for-frontend keeps the secret in an `HttpOnly`, `SameSite=Lax`, production-`Secure` cookie and forwards it to Fastify through a non-ambient authorization header. See `docs/decisions/0001-server-managed-sessions.md`.
- Users, organization memberships, team memberships, invitations, session revocation, organization switching, organization-local suspension, and global disabled-user behavior are implemented through an additive migration and idempotent development seed.
- A centralized named-action permission matrix defines owner, admin, responder, and viewer access. API checks are authoritative; the web UI also removes controls users cannot exercise.
- All protected routes derive organization/user context from the validated session. The former fixed development organization is no longer an authorization mechanism.
- Argon2id passwords use automatic per-password salts plus a required, separately stored native Argon2 secret (`PASSWORD_PEPPER`) of at least 32 random bytes. Stored hashes carry a pepper-version marker without containing the pepper; legacy Phase 2 hashes migrate after successful authentication, unknown versions fail closed, and loss/compromise of the single currently supported pepper requires password resets. Generic invalid-login responses, database-backed failure throttling, seven-day expiry, logout revocation, organization-switch rotation, hashed single-use 48-hour invitation tokens, and a last-active-owner invariant form the initial security baseline.
- Because the browser never authenticates directly to Fastify with ambient cookies, cross-site requests cannot carry API authority. Next.js Server Actions provide the cookie-authenticated mutation boundary and same-origin validation; any future conventional cookie-authenticated route must add explicit CSRF protection.
- Incident/service/activity/permission changes record actor identity and material organization administration actions also write audit-log records.
- Real-PostgreSQL tests cover cross-tenant IDOR attempts, viewer write denial, invitations, team membership, last-owner protection, organization-switch token rotation, membership suspension/revocation, disabled users, and login throttling.
- `packages/contracts` now provides runtime Zod identity/session schemas and the common coded API error envelope. Fastify maps expected and unexpected failures centrally with correlation IDs and without leaking internal details.
- The Next.js backend-for-frontend deliberately keeps native `fetch`; its tested response parser handles no-content, malformed/empty JSON, non-JSON upstream failures, network failure classification, and structured `ApiError` metadata. Identity/session/member responses are runtime-validated first, while incident/service response contracts will migrate incrementally.
- Password reset/change and controlled first-owner organization registration are planned for Phase 3.5. MFA, enterprise SSO, personal API tokens, and end-user session-device management remain deliberately deferred beyond that milestone.

### Phase 3 — real-time incident coordination (complete)

- Socket.IO is behind `RealtimePublisher`; domain/application code does not import Socket.IO, and publication happens only after the business transaction commits.
- Handshakes reuse the opaque server-managed session cookie with an exact-origin check. Organization/user rooms are server-derived, and incident rooms require an organization-scoped authorization query.
- Live incident create/status/assignment/affected-service/activity signals use shared runtime contracts and a positive monotonic incident version.
- The browser treats messages as hints, rejects stale/equal versions, and refetches canonical API state after accepted signals and reconnects.
- Default 4 KiB inbound and 1 KiB outbound payload limits, bounded incident-room membership, volatile delivery, pending-packet/backpressure drops, repeated-slow-client disconnection, and periodic session revalidation bound resource use.
- Logout/organization-switch session rotation and membership suspension proactively disconnect affected sockets, with periodic validation as a fail-closed fallback.
- `RealtimeMetrics`, `InMemoryRealtimeMetrics`, `NoopRealtimeMetrics`, `NoopRealtimePublisher`, publisher/application tests, client sequencing tests, and focused Socket.IO integration tests provide the initial operational/testing seams.
- Realtime is deliberately best-effort and single-process in this phase. Durable publication/outbox delivery and distributed socket fan-out are not claimed.

### Phase 3.5 — account lifecycle and recovery (planned)

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

### Phase 4 — source integrations and secure webhook intake

- Integration setup UI requires a service environment and allows multiple independently managed integrations per service environment.
- Generate an opaque public integration key for `POST /v1/events/:integrationKey` plus a separate signing secret shown once; store a secure verifier/encrypted representation, support rotation overlap, revoke, and last-used metadata.
- Derive organization, service, and environment from the integration record. Payload service/environment fields are optional assertions only and must match configuration when present.
- HMAC SHA-256 of `timestamp + "." + rawBody`, timing-safe verification before parsing, replay window, body-size/content-type limits, and per-integration rate limits.
- Zod event contract with stable API versioning and sanitized validation errors.
- `received_events` audit/inbox record, payload redaction/hash, retention, unique `(integration_id, external_event_id)` idempotency, and fast `202 Accepted` semantics.
- Received-event UI shows processing status, matched service/rule, resulting alert, any incidents linked through that alert, sanitized failure, and correlation ID.
- Local demo sender generates realistic checkout/payment errors and supports duplicate/invalid-signature/replay scenarios.
- Integration tests cover raw-body signatures, rotated/revoked secrets, replay, duplicates, malformed/oversized input, and cross-tenant isolation.

### Phase 5 — asynchronous alert processing, rules, dedupe, and outbox

- Add LocalStack only now, plus SNS, SQS, queues, DLQs, and the worker application.
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

### Phase 6 — notifications, stakeholder delivery, and outbound webhooks

- In-app notification model/preferences and realtime delivery signal.
- Email delivery through a provider adapter with templates, provider message IDs, suppression/bounce handling where available, and per-recipient delivery history.
- Outbound webhook subscriptions with selected event types, verified ownership/test delivery, encrypted secret, signing, delivery records, timeouts, retry/backoff/jitter, disablement policy, and manual replay.
- Strong SSRF defense: URL validation, allowed schemes/ports, DNS/IP checks, redirect policy, private/link-local blocking, response-size/time limits, and revalidation at delivery time.
- Separate internal responder events from curated stakeholder updates.
- Operator/customer UI exposes attempts, sanitized request/response metadata, next retry, permanent failure, and replay audit.
- Contract and failure tests cover signatures, duplicates, slow/down destinations, redirects, retry classification, and secret rotation.

### Phase 7 — ITIL-aligned operational incident management

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

### Phase 8 — bounded on-call schedules and escalations

- Build only after reliable notifications exist.
- Team schedules, time zones, rotations, effective intervals, overrides, and “who is on call now?” calculation.
- Escalation policies with ordered delays/targets, acknowledgement cancellation, deduplicated notifications, and an audit timeline.
- Contact-method preferences and safe test notification flow; start with email/in-app or one provider before considering SMS/voice.
- Schedule preview, gaps/overlaps validation, override UI, and escalation simulation/testing tools.
- Tests emphasize DST/time-zone transitions, concurrent acknowledgements, delayed jobs, overrides, retries, and escalation cancellation.
- Do not claim global telephony/PagerDuty-scale availability; document provider and delivery limitations honestly.

### Phase 9 — AI incident brief with human review

- Provider-agnostic adapter and versioned structured-output Zod contract.
- Inputs are least-privilege, redacted, size-limited, and explicitly selected from incident/activity/service/attachment evidence.
- Asynchronous execution, idempotency, timeouts, retry classification, quotas/cost controls, cancellation, and provider/model metadata.
- Output includes summary, affected service/system, suggested severity, possible next steps, confidence, and evidence references.
- Human approve/reject/edit workflow; AI never autonomously declares major incidents, pages responders, changes status, or triggers high-impact actions.
- Prompt-injection-aware attachment handling, retention controls, audit history, and evaluation fixtures for groundedness/structure/safety.

### Phase 10 — cloud platform, CI/CD, and infrastructure as code

- Web/API/worker Docker images with non-root users, health checks, minimal runtime layers, pinned bases, scanning, and reproducible builds.
- Intentionally choose Lambda containers versus ECS/App Runner or another container service based on WebSocket/process/concurrency needs; record the ADR.
- ECR, selected compute, API Gateway where appropriate, S3, SNS, SQS/DLQs, IAM, Secrets Manager, CloudWatch, and networking through CloudFormation.
- Neon PostgreSQL remains acceptable initially; document connectivity, pooling, backup/restore, migration, and environment isolation.
- GitHub Actions uses AWS OIDC, immutable image tags, environment protections, CloudFormation change sets, deployment smoke tests, and rollback/safe roll-forward instructions.
- WAF and API Gateway throttling complement application tenant quotas; they do not replace them.
- Structured centralized logs, metrics, traces, dashboards, alarms, runbooks, and cost/budget alerts.

### Phase 11 — production-readiness review and portfolio release

- Threat model and abuse-case review covering authentication, tenancy, webhook intake, outbound SSRF, secrets, uploads, replay, rate limits, and AI data flow.
- Load tests for dashboard/API, webhook bursts, rule/dedupe processing, outbox, workers, notifications, and WebSockets against documented initial SLOs.
- Backup/restore and disaster-recovery exercise; migration from a representative prior version; DLQ/outbox replay exercise.
- Retention/deletion jobs, attachment/payload limits, organization offboarding, audit/export expectations, and privacy/security documentation.
- Operational game day: database unavailable, queue backlog, worker crash, stuck lease, provider outage, notification failure, and deployment rollback.
- Architecture diagrams, ADRs, API/event contracts, runbooks, demo data/script, screenshots, and an honest portfolio README describing scope, guarantees, tradeoffs, and future work.
- No unresolved high-severity security findings and no hidden manual steps required for the documented deployment/demo path.

### Version 2 / scale evolution

- Debezium CDC reads the retained outbox table and publishes to Kafka/Confluent without changing domain code/event contracts.
- Schema registry/versioning, consumer groups, replay strategy, partition-key decisions, and migration/coexistence plan.
- Service dependency graph and impact propagation/suggestions with explicit confidence; avoid claiming causality merely from topology.
- More advanced analytics, incident correlation, status-page publishing, integration marketplace, and on-call/notification providers only when justified by measured needs.
- Keep the polling outbox as a well-understood version-1 architecture; Kafka is an evolution, not proof of production readiness by itself.

---

## Current code state — 2026-08-27

- Repository: `/Users/arsahin/Developer/incidentflow`.
- Git is initialized. At the time of this handoff, the checked-out branch is `phase_3`; always inspect current branch/status before modifying files.
- Phase 0 foundation, Phase 1 manual incident lifecycle, Phase 1.5 service catalog/affected services, and Phase 2 identity/authorization are merged to `main` at merge commit `59e8877`. Phase 3 is committed on `phase_3` and ready for the user to open a pull request; the user owns PR creation and merging to `main`.
- Phase 1 baseline commit: `e43f355 feat: complete phase 1 manual incident lifecycle`.
- pnpm workspace contains `apps/web`, `apps/api`, and the active `packages/contracts` package. The contracts package builds shared ESM/Zod identity and error contracts before dependent applications.
- Next.js dashboard supports login/logout, invitation acceptance, member/role/access/team administration, permission-aware incident/service workflows, activity history, URL-backed filtering, pagination, and service catalog/detail/environment management.
- Fastify API exposes health, authentication/session, invitation/member/team-access, service, service-environment, and incident lifecycle routes with Zod validation and repository seams.
- Prisma/PostgreSQL includes users, organization/team memberships, sessions, invitations, login throttles, audit logs, organizations, teams, services, service environments, incidents with monotonic positive versions, affected-service joins, and actor-aware incident activity. Organization-scoped constraints protect tenant boundaries.
- The idempotent seed creates the development organization, an owner (`admin@incidentflow.local`), Platform team, five representative services, and realistic environments. Its local-only password is documented in the README.
- The API resolves active user and organization membership on every protected request from a hashed opaque-session record. Central named permissions replace scattered role comparisons; suspended memberships, disabled users, expired sessions, and revoked sessions fail closed.
- The web uses an HttpOnly cookie as the backend-for-frontend credential; regular Fastify HTTP routes do not accept browser ambient cookies. The Phase 3 Socket.IO handshake is the narrow exact-origin exception described in ADR 0003. The optimistic Next.js proxy checks cookie presence, while the API remains authoritative and safely handles stale/invalid cookies.
- Auth/security decisions and deliberate deferrals are recorded in ADR 0001.
- Native-fetch response handling, runtime contract validation, and the coded correlated-error format are recorded in ADR 0002.
- Authenticated realtime update signals, the Socket.IO cookie/origin boundary, room authorization, canonical refetch strategy, delivery limits, and deliberate best-effort/single-process guarantees are recorded in ADR 0003.
- The API application layer publishes incident create/status/assignment/affected-service/activity signals through `RealtimePublisher` only after repository transactions complete. Socket.IO remains confined to `SocketIoRealtimeAdapter`; ordinary tests use `NoopRealtimePublisher`.
- The Socket.IO adapter authenticates with the existing revocable session service, automatically joins server-derived organization/user rooms, authorizes incident rooms against the authenticated organization, bounds payloads/room counts/backpressure, periodically revalidates sessions, and exposes transport-neutral metrics seams.
- The dashboard and incident detail show connection state, runtime-validate signals, ignore stale/equal incident versions, and use `router.refresh()` to fetch canonical authenticated API data on updates and reconnects.
- Web and API configuration now fail fast through separate Zod boundaries. Required database/origin/API/realtime URLs and the password pepper have no silent fallbacks, public Next.js configuration is checked during build and must be supplied consistently at startup because its bundled value is immutable, server configuration is checked at process startup, Prisma generation remains install-safe while migration/seed commands validate their required database/pepper inputs, and sanitized structured failures preserve configuration errors instead of misclassifying them as network errors. Root, API, and web environment examples reflect their actual loading boundaries; API liveness and PostgreSQL-backed readiness are separate endpoints.
- `docs/phase-3-demo-deployment.md` documents a deliberately bounded, single-origin HTTPS demo deployment. It keeps the API private behind a WebSocket-capable reverse proxy so the existing host-only session cookie can authenticate the Socket.IO handshake. This is a sharing path for the current milestone, not a substitute for the Phase 10 cloud platform or production-readiness work.
- Baseline GitHub Actions CI provisions PostgreSQL and runs frozen installation, migration deployment, lint, typecheck, unit tests, database integration tests, production build, and a high-severity production-dependency audit.
- PostgreSQL runs through Docker Compose with persistent storage. Phase 3 was verified through warning-free lint and typecheck, shared-contract/application/client sequencing tests, focused loopback Socket.IO integration tests, the additive migration and current migration-status check, warning-free real-PostgreSQL identity/authorization/constraint/version tests, production builds, a high-severity production-dependency audit, and a local login-page smoke test.
- The database contains development records created during verification, including an Order Routing API service, preview environment, linked incident, and a browser-verification viewer account; do not assume it is empty.
- Phase 3 authenticated real-time incident coordination is implemented locally and committed for review. Phase 3.5 account lifecycle and recovery is the planned next milestone, but it must not begin until the user merges the Phase 3 pull request, updates local `main`, and creates the `phase_3_5` branch. Do not begin Phase 4 before Phase 3.5 is completed and approved.
- Existing uncommitted user changes may be present. Always inspect and preserve them; never treat a dirty worktree as disposable.

### Local development

```bash
cd /Users/arsahin/Developer/incidentflow
cp .env.example .env         # only if .env does not already exist
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
docker compose up -d db
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Expected local URLs:

- Dashboard: <http://localhost:3000>
- API health: <http://localhost:4000/health>

Quality gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm audit --prod --audit-level high
```

---

## Immediate open tasks for the coding assistant

1. Inspect Git status, branch, recent commits, running services, applicable `AGENTS.md`, and actual schema/code before editing. Preserve unrelated/user changes.
2. Preserve the Phase 3 `RealtimePublisher`/Socket.IO boundary, server-derived rooms, strict-origin cookie handshake, best-effort signal semantics, and canonical-refetch/version guarantees.
3. Remain on `phase_3` while the user reviews the committed Phase 3 work. The full quality gate, including real-PostgreSQL integration tests and Prisma migration status, is passing. Keep any requested fixes within Phase 3, and do not switch or update branches on the user's behalf unless explicitly requested.
4. The user owns opening and merging the Phase 3 pull request. Do not begin Phase 3.5 until they confirm the merge, local `main` update, and `phase_3_5` branch creation.
5. Begin Phase 3.5 only after the user confirms Phase 3 was merged, local `main` was updated, and the `phase_3_5` branch was created. Implement its account lifecycle/recovery scope incrementally before Phase 4.
6. Continue migrating endpoint success schemas into `packages/contracts` when their APIs are actively changed; keep the stable coded error contract centralized.
7. Keep the milestone local and runnable. Do not begin Phase 4 or jump to webhooks, AWS, queues, AI, Kafka, broad notifications, or on-call without explicit user approval.
8. Keep this context, README, ADRs, and roadmap status synchronized with implemented behavior.

## Working preferences for the coding assistant

- Teach while implementing: explain important architectural choices briefly and concretely.
- Keep changes incremental and runnable. Verify each milestone before proceeding.
- Prefer one strong, understandable implementation over unnecessary abstractions.
- Do not silently introduce Kafka/Confluent, AWS, microservices, or AI before their roadmap phase.
- Be strict about correctness around signatures, retries, idempotency, secrets, and authorization.
- Use honest portfolio-quality documentation. Do not claim "exactly once" delivery when the implementation is at-least-once plus idempotent consumers.
- Preserve the architecture’s future seams: `RealtimePublisher`, AI-provider adapter, and an outbox transport that can change from polling to Debezium without changing domain logic.
