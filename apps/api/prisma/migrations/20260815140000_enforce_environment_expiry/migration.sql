-- Preserve the invariant even when service environments are written outside the API.
ALTER TABLE "service_environments"
ADD CONSTRAINT "service_environments_expiry_requires_ephemeral"
CHECK ("expires_at" IS NULL OR "is_ephemeral" = true);
