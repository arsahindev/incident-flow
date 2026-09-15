#!/usr/bin/env bash
# Disposable TLS PostgreSQL and full-container regression check; no cloud secrets.
set -euo pipefail
image=${1:?Usage: $0 image}
work=$(mktemp -d)
suffix="$$"
network="incidentflow-tls-${suffix}"
database="incidentflow-tls-db-${suffix}"
application="incidentflow-tls-app-${suffix}"
cleanup() {
  docker rm -f "$application" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=IncidentFlow-Test-CA \
  -keyout "$work/ca.key" -out "$work/ca.pem" >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -subj /CN=tls-db \
  -keyout "$work/server.key" -out "$work/server.csr" >/dev/null 2>&1
printf 'subjectAltName=DNS:tls-db\nextendedKeyUsage=serverAuth\n' > "$work/extensions"
openssl x509 -req -in "$work/server.csr" -CA "$work/ca.pem" -CAkey "$work/ca.key" \
  -CAcreateserial -days 1 -extfile "$work/extensions" -out "$work/server.pem" >/dev/null 2>&1
# Put the test CA last, reproducing the multi-root RDS bundle.
cat infra/docker/certs/eu-central-1-bundle.pem "$work/ca.pem" > "$work/bundle.pem"
chmod 0644 "$work/bundle.pem" "$work/ca.pem" "$work/server.pem" "$work/server.key"
docker network create "$network" >/dev/null
docker run -d --name "$database" --network "$network" --network-alias tls-db \
  --network-alias wrong-host -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=incidentflow -e POSTGRES_DB=incidentflow \
  -v "$work:/tls:ro" postgres:17-alpine sh -c \
  'cp /tls/server.key /tmp/server.key && chown postgres /tmp/server.key && chmod 0600 /tmp/server.key && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tls/server.pem -c ssl_key_file=/tmp/server.key' >/dev/null
for attempt in {1..60}; do
  if docker exec "$database" pg_isready -U incidentflow >/dev/null 2>&1; then break; fi
  sleep 1
done
# Confirm the actual node-postgres driver rejects an untrusted CA and a wrong host.
for mode in untrusted wrong-host; do
  host=tls-db
  ca=/app/infra/docker/certs/eu-central-1-bundle.pem
  if [[ "$mode" == wrong-host ]]; then host=wrong-host; ca=/tls/ca.pem; fi
  docker run --platform linux/amd64 --rm --network "$network" -v "$work/ca.pem:/tls/ca.pem:ro" \
    -e "DATABASE_URL=postgresql://incidentflow@${host}:5432/incidentflow?sslmode=verify-full&sslrootcert=${ca}" \
    -e "EXPECTED_ERROR=$mode" --entrypoint node "$image" --input-type=module -e '
      import pg from "/app/apps/api/node_modules/pg/lib/index.js";
      const client = new pg.Client({connectionString: process.env.DATABASE_URL});
      try { await client.connect(); throw new Error("TLS unexpectedly accepted"); }
      catch (error) {
        const expected = process.env.EXPECTED_ERROR === "wrong-host"
          ? "ERR_TLS_CERT_ALTNAME_INVALID" : "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
        if (error.code !== expected) throw error;
        console.log(`PASS TLS rejection: ${expected}`);
      } finally { await client.end(); }
    '
done
docker run --platform linux/amd64 -d --name "$application" --network "$network" \
  -v "$work/bundle.pem:/app/infra/docker/certs/eu-central-1-bundle.pem:ro" \
  -e DB_HOST=tls-db -e DB_PORT=5432 -e DB_NAME=incidentflow -e DB_USER=incidentflow \
  -e DB_PASSWORD=disposable-test-only \
  -e PASSWORD_PEPPER=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
  -e WEB_ORIGIN=https://deployment-test.invalid -e SEED_DEMO_DATA=true \
  -e SEED_OWNER_EMAIL=owner@deployment-test.invalid -e SEED_OWNER_PASSWORD=Disposable-Test-Only-2026 \
  "$image" >/dev/null
for attempt in {1..90}; do
  if docker exec "$application" node -e 'fetch("http://127.0.0.1:8080/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then break; fi
  if [[ $(docker inspect -f '{{.State.Running}}' "$application") != true ]]; then
    docker logs "$application"
    exit 1
  fi
  sleep 1
done
docker exec "$application" node --input-type=module -e '
  for (const path of ["/health", "/ready", "/login"]) {
    const r = await fetch(`http://127.0.0.1:8080${path}`);
    if (r.status !== 200) throw new Error(`${path}: ${r.status}`);
    const body = await r.text();
    if (path === "/login" && !body.includes("IncidentFlow")) throw new Error("Wrong web page");
    console.log(`PASS ${path}: ${r.status}`);
  }
'
docker exec "$database" psql -U incidentflow -d incidentflow -Atc \
  'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'
echo 'PASS full startup: trusted TLS, migrations, seed, API, Next.js, Nginx'
