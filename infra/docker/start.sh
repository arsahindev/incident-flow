#!/usr/bin/env bash
set -euo pipefail

required=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD PASSWORD_PEPPER WEB_ORIGIN)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required runtime configuration: ${name}" >&2
    exit 1
  fi
done

database_base_url="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
database_ca=/app/infra/docker/certs/eu-central-1-bundle.pem
export SSL_CERT_FILE="$database_ca"
export DATABASE_URL="${database_base_url}?sslmode=verify-full&sslrootcert=${database_ca}"
export API_HOST="127.0.0.1"
export API_PORT="4000"
export API_URL="${API_URL:-http://127.0.0.1:4000}"
export NEXT_PUBLIC_REALTIME_URL="${NEXT_PUBLIC_REALTIME_URL:-same-origin}"

# Prisma's sslcert loads only one PEM certificate. OpenSSL's trust store loads
# the whole regional bundle via SSL_CERT_FILE; keep strict verification enabled.
DATABASE_URL="${database_base_url}?sslmode=require&sslaccept=strict" \
  pnpm --filter @incidentflow/api exec prisma migrate deploy

if [[ "${SEED_DEMO_DATA:-false}" == "true" ]]; then
  pnpm --filter @incidentflow/api db:seed
fi

node apps/api/dist/server.js &
api_pid=$!
(cd apps/web && PORT=3000 exec node node_modules/next/dist/bin/next start -H 127.0.0.1) &
web_pid=$!
nginx -g "daemon off;" &
nginx_pid=$!

cleanup() {
  kill "$api_pid" "$web_pid" "$nginx_pid" 2>/dev/null || true
  wait "$api_pid" "$web_pid" "$nginx_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait -n "$api_pid" "$web_pid" "$nginx_pid"
