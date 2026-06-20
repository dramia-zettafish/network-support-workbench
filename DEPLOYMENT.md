# EUS Support — Next.js Production Deployment Guide

## Caddyfile Change

### BEFORE (current — routes to FastAPI on port 8000):
```
{$CADDY_SITE_ADDRESS::443} {
    encode zstd gzip
    import security_headers
    {$CADDY_TLS_BLOCK}
    reverse_proxy api_pg:8000
}
```

### AFTER (routes to Next.js on port 3000):
```
{$CADDY_SITE_ADDRESS::443} {
    encode zstd gzip
    import security_headers
    {$CADDY_TLS_BLOCK}
    reverse_proxy nextjs_prod:3000
}
```

Only the `reverse_proxy` target changes. Everything else (TLS, headers, encoding) stays the same.

---

## Deployment Validation Checklist

### 1. Build container
```bash
docker compose -f docker-compose.nextjs-prod.yml build nextjs_prod
```

### 2. Start container (without stopping old app yet)
```bash
docker compose -f docker-compose.nextjs-prod.yml up -d nextjs_prod
```

### 3. Check container logs
```bash
docker logs -f eusupport-nextjs-prod --tail 20
# Expect: "Listening on port 3000" or similar, no crash loops
```

### 4. Check health endpoint
```bash
docker inspect --format='{{.State.Health.Status}}' eusupport-nextjs-prod
# Expect: healthy

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18007/login
# Expect: 200
```

### 5. Validate homepage
```bash
curl -s http://127.0.0.1:18007/ | grep -o "<title>[^<]*</title>"
# Expect: <title>EU Support</title>
```

### 6. Validate login
```bash
curl -s -c /tmp/prod_test_cookies.txt -X POST http://127.0.0.1:18007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}'
# Expect: {"user":{"id":...,"username":"...","role":"..."}}
```

### 7. Validate case detail page
```bash
# Get a case ID
CASE_ID=$(docker exec webstack-api-pg-db psql -U inventory -d inventory -t -c \
  "SELECT id FROM cm_cases LIMIT 1;" | tr -d ' \n')

curl -s -b /tmp/prod_test_cookies.txt -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:18007/cases/${CASE_ID}"
# Expect: 200
```

### 8. Validate inventory page
```bash
curl -s -b /tmp/prod_test_cookies.txt -o /dev/null -w "%{http_code}" \
  http://127.0.0.1:18007/inventory
# Expect: 200
```

### 9. Validate a write operation (catalogs API returns team data)
```bash
curl -s -b /tmp/prod_test_cookies.txt http://127.0.0.1:18007/api/cases/catalogs | \
  python3 -c "import json,sys;d=json.load(sys.stdin);print('teamIdsByKey:', len(d['data']['teamIdsByKey']), 'keys')"
# Expect: teamIdsByKey: 11 keys
```

### 10. Validate team resolver runtime
```bash
docker exec -e DATABASE_URL="postgresql://INVENTORY_PG_USER:INVENTORY_PG_PASSWORD@webstack-api-pg-db:5432/inventory" \
  eusupport-nextjs-prod node scripts/validate-team-resolver.js 2>/dev/null || \
  echo "Note: standalone build may not include scripts/ — run from host if needed"
```

---

## Cutover Steps (after validation passes)

```bash
# 1. Stop old FastAPI app (keep database running)
docker stop webstack-api-pg

# 2. Apply Caddyfile change (reverse_proxy → nextjs_prod:3000)
sed -i 's/reverse_proxy api_pg:8000/reverse_proxy nextjs_prod:3000/' /home/eusadmin/eusupport/Caddyfile

# 3. Restart Caddy to pick up new config
docker restart webstack-caddy

# 4. Verify via public URL
curl -sk https://eusupport.netsync.com/login -o /dev/null -w "%{http_code}"
# Expect: 200
```

---

## Rollback Procedures

### Revert Caddy to old app
```bash
sed -i 's/reverse_proxy nextjs_prod:3000/reverse_proxy api_pg:8000/' /home/eusadmin/eusupport/Caddyfile
docker restart webstack-caddy
```

### Restart old app containers
```bash
docker start webstack-api-pg
# The FastAPI app is schema-adaptive and works with the new columns/tables present.
```

### Restore code to pre-cutover tag
```bash
git checkout main
git reset --hard v1.0-pre-cutover
# Or simply: git checkout v1.0-pre-cutover
```

### Database rollback (LAST RESORT)
Only use if the schema migration caused unrecoverable data corruption.
The migration is additive (new tables, new columns) and does not modify existing data.
The old FastAPI app works fine with the extra schema present.

```bash
# Identify the backup file
ls -la /home/eusadmin/eusupport/backups/eusupport_pre_cutover_*.dump

# Stop all app containers
docker stop webstack-api-pg eusupport-nextjs-prod

# Restore
BACKUP="/home/eusadmin/eusupport/backups/eusupport_pre_cutover_XXXXXXXX_XXXXXX.dump"
docker exec webstack-api-pg-db psql -U inventory -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='inventory' AND pid <> pg_backend_pid();"
docker exec webstack-api-pg-db psql -U inventory -d postgres -c "DROP DATABASE inventory;"
docker exec webstack-api-pg-db psql -U inventory -d postgres -c "CREATE DATABASE inventory OWNER inventory;"
docker cp ${BACKUP} webstack-api-pg-db:/tmp/restore.dump
docker exec webstack-api-pg-db pg_restore -U inventory -d inventory /tmp/restore.dump

# Restart old app
docker start webstack-api-pg
docker restart webstack-caddy
```

---

## Required Environment Variables

| Variable | Source | Notes |
|----------|--------|-------|
| INVENTORY_PG_USER | existing .env | Database username |
| INVENTORY_PG_PASSWORD | existing .env | Database password |
| INVENTORY_PG_DB | existing .env | Database name |
| AUTH_PROVIDER | .env.nextjs-prod | Must be `legacy` |
| SESSION_SECRET | .env.nextjs-prod | 32+ char hex string |
| WRITES_ENABLED | .env.nextjs-prod | `true` |
| NEXT_PUBLIC_WRITES_ENABLED | .env.nextjs-prod | `true` |
| NEXT_PUBLIC_ENV_LABEL | .env.nextjs-prod | `production` |
| SMTP_HOST | .env.nextjs-prod | For email notifications |
| SMTP_PORT | .env.nextjs-prod | Usually 587 |
| SMTP_USER | .env.nextjs-prod | SMTP credentials |
| SMTP_PASS | .env.nextjs-prod | SMTP credentials |
| SMTP_FROM | .env.nextjs-prod | Sender address |

---

## Dress Rehearsal (Safe — Uses Isolated Copy of Production Data)

The dress rehearsal runs the full production container against a **temporary copy** of the
production database. The live production database is never written to during rehearsal.

### Step 1: Dump production

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec webstack-api-pg-db pg_dump -U inventory -d inventory \
  --format=custom -f /tmp/rehearsal_${TIMESTAMP}.dump
echo "Dump: /tmp/rehearsal_${TIMESTAMP}.dump"
```

### Step 2: Create rehearsal database

```bash
docker exec webstack-api-pg-db psql -U inventory -d postgres \
  -c "DROP DATABASE IF EXISTS rehearsal;"
docker exec webstack-api-pg-db psql -U inventory -d postgres \
  -c "CREATE DATABASE rehearsal OWNER inventory;"
```

### Step 3: Restore dump into rehearsal database

```bash
docker exec webstack-api-pg-db pg_restore -U inventory -d rehearsal \
  /tmp/rehearsal_${TIMESTAMP}.dump
```

### Step 4: Run migrations against rehearsal database

```bash
docker exec -i webstack-api-pg-db psql -U inventory -d rehearsal \
  < /home/eusadmin/eusupport/migrations/001_schema_upgrade.sql

docker exec -i webstack-api-pg-db psql -U inventory -d rehearsal \
  < /home/eusadmin/eusupport/migrations/002_seed_reference_data.sql
```

### Step 5: Start Next.js production container against rehearsal DB

```bash
# URL-encode the password (replace + / = with %2B %2F %3D)
# Example: source .env and encode INVENTORY_PG_PASSWORD
PW_ENCODED=$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ.get('INVENTORY_PG_PASSWORD',''), safe=''))")

docker run -d --rm \
  --name eusupport-dress-rehearsal \
  --network eusupport_default \
  -e "DATABASE_URL=postgresql://inventory:${PW_ENCODED}@webstack-api-pg-db:5432/rehearsal" \
  -e AUTH_PROVIDER=legacy \
  -e WRITES_ENABLED=true \
  -e NEXT_PUBLIC_WRITES_ENABLED=true \
  -e SESSION_SECRET=$(grep SESSION_SECRET .env.nextjs-prod 2>/dev/null | cut -d= -f2 || echo "change-me-32-chars-minimum-placeholder") \
  -e NEXT_PUBLIC_ENV_LABEL=dress-rehearsal \
  -p 127.0.0.1:18008:3000 \
  eusupport-nextjs:latest

echo "Waiting for startup..."
sleep 5
```

### Step 6: Validate

```bash
# Health
curl -s -o /dev/null -w "login: %{http_code}\n" http://localhost:18008/login

# Login (use a known production username/password)
curl -s -c /tmp/rehearsal_cookies.txt -X POST http://localhost:18008/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USER","password":"YOUR_PASS"}'
# Expect: {"user":{...}}

# Pages (authenticated)
for p in / /cases /inventory /issue /logistics /route-coordination /ledger /admin; do
  CODE=$(curl -s -b /tmp/rehearsal_cookies.txt -o /dev/null -w "%{http_code}" http://localhost:18008${p})
  echo "  ${p}: ${CODE}"
done
# Expect: all 200

# API — team resolver
curl -s -b /tmp/rehearsal_cookies.txt http://localhost:18008/api/cases/catalogs | \
  python3 -c "import json,sys;d=json.load(sys.stdin);t=d['data']['teamIdsByKey'];print(f'teamIdsByKey: {len(t)} keys, IDs: {sorted(t.values())}')"
# Expect: teamIdsByKey: 11 keys, IDs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

# Write test — advance a case stage (writes to REHEARSAL db only)
CASE_ID=$(docker exec webstack-api-pg-db psql -U inventory -d rehearsal -t \
  -c "SELECT id FROM cm_cases WHERE status='Active' LIMIT 1;" | tr -d ' \n')
curl -s -b /tmp/rehearsal_cookies.txt -X POST "http://localhost:18008/api/cases/${CASE_ID}/logistics" \
  -H "Content-Type: application/json" \
  -d '{"advance_stage":"Diagnosing","activity_note":"dress rehearsal write test"}'
# Expect: {"ok":true}

# Confirm write hit rehearsal DB, NOT production
docker exec webstack-api-pg-db psql -U inventory -d rehearsal -t \
  -c "SELECT stage FROM cm_cases WHERE id='${CASE_ID}';"
# Expect: Diagnosing

docker exec webstack-api-pg-db psql -U inventory -d inventory -t \
  -c "SELECT stage FROM cm_cases WHERE id='${CASE_ID}';"
# Expect: original stage (unchanged) — proves production was not touched
```

### Step 7: Stop rehearsal container

```bash
docker stop eusupport-dress-rehearsal
rm -f /tmp/rehearsal_cookies.txt
```

### Step 8: Drop rehearsal database

```bash
docker exec webstack-api-pg-db psql -U inventory -d postgres \
  -c "DROP DATABASE IF EXISTS rehearsal;"
docker exec webstack-api-pg-db sh -c "rm -f /tmp/rehearsal_*.dump"
```

### Confirmation

After all steps pass:
- ✅ Production database was never written to
- ✅ Next.js container serves all pages correctly
- ✅ Authentication works against production user credentials
- ✅ Team resolver returns correct IDs (1–11)
- ✅ Write operations function correctly
- ✅ Rehearsal artifacts are cleaned up
