# ADR 0002: Native fetch and shared API response contracts

- Status: Accepted
- Date: 2026-08-27
- Milestone: Phase 2

## Context

The Next.js backend-for-frontend calls the Fastify API for server-rendered reads
and Server Action mutations. The project needs predictable errors, runtime
validation at security-sensitive boundaries, and useful request correlation.
Adding Axios would provide conveniences that overlap with the platform and
Next.js `fetch` implementations while still requiring project-specific error
and contract handling.

## Decision

Keep native `fetch` behind a small server-only wrapper and a pure, independently
tested response parser.

- Consume each response body once as text and parse JSON once.
- Treat `204 No Content` as a valid empty result.
- Classify network failures, malformed or empty successful responses, non-JSON
  failures, and schema-invalid successful responses without exposing raw
  upstream bodies.
- Preserve HTTP status, stable error code, validation issues, and request ID in
  `ApiError` so callers do not match human-readable messages.
- Standardize API failures as
  `{ "error": { "code", "message", "issues"?, "requestId" } }` and mirror the
  correlation value in `X-Request-Id`.
- Store shared runtime Zod schemas and their inferred TypeScript types in
  `@incidentflow/contracts`. Phase 2 validates identity, session, invitation,
  organization, and member responses. Other endpoint responses migrate when
  their boundaries are next changed.

## Consequences

- No additional general-purpose HTTP client dependency is needed.
- Fastify errors have one safe mapping layer and unexpected failures do not
  reveal implementation details.
- The BFF can distinguish an ordinary API rejection from an invalid upstream
  response and retain correlation data for support and logs.
- The contracts workspace package must be built before dependent applications;
  workspace setup and development scripts enforce that order.
- A generated OpenAPI client may be reconsidered when the public API surface is
  large enough to justify specification generation and client regeneration. It
  should replace, not duplicate, hand-maintained endpoint typing.
