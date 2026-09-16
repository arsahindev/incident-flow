# Product and domain requirements

Read when designing or changing domain behavior, schemas, alert intake, rules,
or incident workflows. This is the authoritative product model, including
future requirements; it is not a list of implemented features. Phases 0–3 are
complete. Alert intake, async processing and later capabilities remain planned.
Use [the roadmap](roadmap.md) when deciding sequencing and approval boundaries,
and [architecture](architecture.md) when checking implemented behavior.
AWS technology goals below are future learning goals, not current hosting.
Do not provision services or advance a phase just because it is described here.

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

| Direction, relative to IncidentFlow | Meaning                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Inbound webhook                     | A customer service calls IncidentFlow because an event happened.                          |
| Outbound webhook                    | IncidentFlow calls a customer-controlled endpoint because an IncidentFlow event happened. |

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

| Record/practice | Purpose                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Event/alert     | A detected change or signal that may require attention; not every alert becomes an incident.                      |
| Incident        | An unplanned interruption to a service or reduction in service quality; focus on restoring service.               |
| Major incident  | A high-impact incident requiring exceptional urgency, coordination, and communication.                            |
| Problem         | The actual or potential cause of one or more incidents; focus on root cause, workarounds, and known errors.       |
| Change          | A controlled modification that may remediate a problem or alter a service; focus on risk and safe implementation. |
| Service request | A normal, predefined user request; it is not an incident and is outside the initial product scope.                |

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

## Domain data model and event processing requirements

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

Do not create every table at once. Organizations, teams, incidents, and incident activity were the first slice. Services and affected-service relations were completed in Phase 1.5. Add later tables only with the user-facing/operational milestone that exercises them.

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
