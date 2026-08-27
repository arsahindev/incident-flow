# ADR 0001: Server-managed web sessions and named permissions

- Status: Accepted
- Date: 2026-08-15
- Milestone: Phase 2

## Context

IncidentFlow is a multi-tenant operations product. Every protected request must establish both a user and an active organization membership without trusting organization identifiers supplied by the browser. Sessions must be revocable immediately when a user logs out, is suspended, or is disabled.

The initial client is the IncidentFlow web application. Native/mobile clients and third-party API access are not Phase 2 requirements.

## Decision

Use opaque, database-backed sessions for the web application.

- Login creates 32 random bytes and returns the base64url token once. PostgreSQL stores only its SHA-256 digest.
- The Next.js server stores the token in an `HttpOnly`, `SameSite=Lax`, path-scoped cookie; production cookies also use `Secure`.
- Browser code never reads the session secret. Next.js Server Actions and server components forward it to Fastify through `Authorization: Session <token>`.
- Fastify resolves the user, selected organization, membership status, role, and named permissions on every protected request. Route payloads and URL parameters never select the tenant.
- Sessions expire after seven days, are revoked on logout or organization switch, and become unusable immediately when their user is disabled or their organization membership is suspended.
- Switching organization rotates the session token instead of changing an existing session in place.
- Passwords use Argon2id. Login responses do not disclose whether an email exists, and repeated failures are throttled by a hashed email/client-address key.
- Invitation tokens are also random and stored only as SHA-256 digests. They expire after 48 hours and are single-use.

The browser does not call the authenticated Fastify API with ambient cookies. Consequently, a cross-site request cannot automatically authenticate to Fastify, and the primary cookie-authenticated mutation surface is Next.js Server Actions, which perform same-origin validation. `SameSite=Lax` supplies an additional browser boundary. If IncidentFlow later adds conventional cookie-authenticated route handlers, each unsafe method must add an explicit CSRF token or equivalent origin-bound defense.

## Authorization model

Routes authorize named actions through one centralized matrix rather than scattering role-name checks:

| Permission | Owner | Admin | Responder | Viewer |
|---|:---:|:---:|:---:|:---:|
| `incidents.read` | yes | yes | yes | yes |
| `incidents.manage` | yes | yes | yes | no |
| `services.read` | yes | yes | yes | yes |
| `services.manage` | yes | yes | no | no |
| `teams.read` | yes | yes | yes | yes |
| `members.read` | yes | yes | yes | yes |
| `members.manage` | yes | yes | no | no |

Only owners and admins can invite members, change organization roles/access, and manage team membership. The last active owner cannot be demoted or suspended. Organization suspension is distinct from globally disabling a user, because one user may belong to multiple organizations.

## Consequences

- Revocation and role changes take effect without waiting for a token to expire.
- API authorization remains authoritative even when the UI hides unavailable controls.
- Database lookup cost is paid on protected requests; this is acceptable for the current scale and can later be reduced without changing the external contract.
- The Next.js server is a trusted backend-for-frontend and must never log or expose the session token.
- Password reset/change, MFA, enterprise SSO, personal API tokens, and session-device management remain deliberate future capabilities rather than implicit guarantees.
