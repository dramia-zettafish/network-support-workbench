# EUS Support — Production Cutover Plan

**Target:** eusupport.netsync.com (10.214.30.244)
**From:** FastAPI/Python monolith (main branch, port 18002 via Caddy)
**To:** Next.js app (develop branch, port 3000 via Caddy)
**Date prepared:** 2026-05-26

---

## ⚠️ BLOCKING ISSUE: Hardcoded Dev Team IDs

The Next.js app has **~30 hardcoded references** to dev team IDs (2340–2350) that must be remapped to production IDs (1–11) **before cutover**. These are in:

| Dev ID | Prod ID | Team Key |
|--------|---------|----------|
| 2340 | 1 | parts_administrators |
| 2341 | 2 | rma_administrators |
| 2342 | 3 | internal_support_technicians |
| 2343 | 4 | computer_technicians |
| 2344 | 5 | intake_administrators |
| 2345 | 6 | route_coordinators |
| 2346 | 7 | order_administrators |
| 2347 | 8 | quote_administrators |
| 2348 | 9 | network_technicians |
| 2349 | 10 | logistics_technicians |
| 2350 | 11 | reporting_administrators |

**Affected files (must be fixed on develop before release branch):**
```
app/api/logistics/refresh-cases/route.js          (2349)
app/api/logistics/refresh-cases/submit/route.js   (2343, 2345)
app/api/cases/bulk-logistics/route.js             (2349)
app/api/cases/order-details/route.js              (2345)
app/api/cases/purchase-info/route.js              (2340)
app/api/cases/[id]/defective-parts/route.js       (2340)
app/api/cases/[id]/logistics/route.js             (2340-2349 mapping)
app/api/issue/eu-support/route.js                 (2343)
app/api/data-management/refresh-pickup-results/route.js (2343)
app/route-coordination/page.jsx                   (2349)
app/logistics/page.jsx                            (2345)
app/cases/cases-client.jsx                        (2349)
app/cases/[id]/case-detail-client.jsx             (2340-2347)
```

**Recommended fix:** Replace hardcoded IDs with a lookup by team `key`:
```js
// In a shared config or at route level:
const TEAM_IDS = await query(`SELECT id, key FROM teams WHERE is_enabled = 1`);
// Then reference: TEAM_IDS.find(t => t.key === 'computer_technicians').id
```

Or at minimum, create a constants file with environment-aware team IDs.

---

## Pre-Cutover Checklist

- [ ] Fix hardcoded team IDs in next-app (see above)
- [ ] Create production Dockerfile for next-app (build mode, not dev)
- [ ] Create production docker-compose for next-app
- [ ] Update Caddyfile to proxy to Next.js (port 3000) instead of FastAPI (port 8000)
- [ ] Configure `.env` with `DATABASE_URL` pointing to existing prod PostgreSQL
- [ ] Set `WRITES_ENABLED=true` in production env
- [ ] Set `AUTH_PROVIDER=legacy` in production env
- [ ] Verify `SESSION_SECRET` is set
- [ ] Verify SMTP credentials are configured

---

## Cutover Commands

### Phase 1: Backup Production

```bash
# 1a. Full database backup (custom format for selective restore)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec webstack-api-pg-db pg_dump -U inventory -d inventory \
  --format=custom \
  -f /tmp/eusupport_pre_cutover_${TIMESTAMP}.dump

# Copy backup out of container
docker cp webstack-api-pg-db:/tmp/eusupport_pre_cutover_${TIMESTAMP}.dump \
  /home/eusadmin/eusupport/backups/eusupport_pre_cutover_${TIMESTAMP}.dump

# 1b. Plain SQL backup (human-readable, for emergency)
docker exec webstack-api-pg-db pg_dump -U inventory -d inventory \
  --format=plain \
  -f /tmp/eusupport_pre_cutover_${TIMESTAMP}.sql

docker cp webstack-api-pg-db:/tmp/eusupport_pre_cutover_${TIMESTAMP}.sql \
  /home/eusadmin/eusupport/backups/eusupport_pre_cutover_${TIMESTAMP}.sql

# 1c. Verify backup integrity
docker exec webstack-api-pg-db pg_restore --list /tmp/eusupport_pre_cutover_${TIMESTAMP}.dump | wc -l
```

### Phase 2: Tag Current Main

```bash
cd /home/eusadmin/eusupport

# Tag the current production state
git tag -a v1.0-pre-cutover -m "Production state before Next.js cutover $(date -I)" main
git push origin v1.0-pre-cutover
```

### Phase 3: Create Release Branch from Develop

```bash
cd /home/eusadmin/eusupport

# Create release branch
git checkout develop
git pull origin develop
git checkout -b release/v2.0.0

# *** FIX TEAM IDS HERE (see blocking issue above) ***
# After fixing:
git add -A
git commit -m "fix: remap dev team IDs to production (1-11)"

# Push release branch
git push -u origin release/v2.0.0
```

### Phase 4: Run Database Migrations

```bash
# Run schema upgrade (idempotent — safe to run multiple times)
docker exec -i webstack-api-pg-db psql -U inventory -d inventory \
  < /home/eusadmin/eusupport/migrations/001_schema_upgrade.sql

# Run seed data (idempotent — ON CONFLICT DO NOTHING)
docker exec -i webstack-api-pg-db psql -U inventory -d inventory \
  < /home/eusadmin/eusupport/migrations/002_seed_reference_data.sql

# Verify migration success
docker exec webstack-api-pg-db psql -U inventory -d inventory -c "
  SELECT 'tables' as check, count(*) as val FROM information_schema.tables WHERE table_schema='public'
  UNION ALL SELECT 'cm_workflows', count(*) FROM cm_workflows
  UNION ALL SELECT 'cm_programs', count(*) FROM cm_programs
  UNION ALL SELECT 'cm_defective_parts_catalog', count(*) FROM cm_defective_parts_catalog
  UNION ALL SELECT 'cm_cases (preserved)', count(*) FROM cm_cases
  UNION ALL SELECT 'ledger (preserved)', count(*) FROM ledger;"
```

Expected output: 58 tables, 2 workflows, 2 programs, 51 parts catalog, 11 cases, 13081 ledger.

### Phase 5: Deploy Next.js Container

```bash
cd /home/eusadmin/eusupport

# Create production Dockerfile for next-app (if not already created)
cat > next-app/Dockerfile.prod << 'EOF'
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
EOF

# Update next.config.js to enable standalone output (if not already)
# Ensure: module.exports = { output: 'standalone' }

# Stop the old FastAPI app container (keep database running!)
docker stop webstack-api-pg
# DO NOT run: docker compose down -v
# DO NOT remove the database container or volume

# Update Caddyfile to point to the new Next.js container
# Change: reverse_proxy api_pg:8000
# To:     reverse_proxy nextjs_prod:3000

# Build and start the Next.js production container
docker compose -f docker-compose.nextjs-prod.yml up -d --build

# Restart Caddy to pick up new config
docker restart webstack-caddy
```

### Phase 6: Validate Health

```bash
# Check container is running
docker ps | grep nextjs

# Check Next.js health (internal)
curl -s http://127.0.0.1:3000/ | head -5

# Check via Caddy (external)
curl -sk https://eusupport.netsync.com/ | head -5

# Check API routes respond
curl -sk https://eusupport.netsync.com/api/cases/catalogs | head -1

# Check database connectivity through the app
curl -sk https://eusupport.netsync.com/api/admin/users 2>&1 | head -1

# Verify login page loads
curl -sk https://eusupport.netsync.com/login -o /dev/null -w "%{http_code}"
# Expected: 200
```

### Phase 7: Merge Release to Main (after validation)

```bash
cd /home/eusadmin/eusupport
git checkout main
git merge --no-ff release/v2.0.0 -m "Release v2.0.0: Next.js production cutover"
git push origin main
git tag -a v2.0.0 -m "Next.js production release"
git push origin v2.0.0
```

---

## Rollback Procedures

### Rollback Code Only (database is forward-compatible)

```bash
# Stop Next.js container
docker stop nextjs_prod  # or whatever the container name is

# Revert Caddyfile to point back to FastAPI
# Change: reverse_proxy nextjs_prod:3000
# To:     reverse_proxy api_pg:8000

# Restart the old FastAPI container
docker start webstack-api-pg

# Restart Caddy
docker restart webstack-caddy

# Verify old app is serving
curl -sk https://eusupport.netsync.com/ | head -5
```

The FastAPI app is schema-adaptive (`db_core.table_columns()` discovers columns at runtime), so it will continue to work with the new columns and tables present. The migration is **non-destructive** and **backward-compatible**.

### Rollback Database (LAST RESORT — only if migration caused corruption)

```bash
# This drops and recreates the database. Only use if data is corrupted.
# The backup from Phase 1 must exist.

BACKUP_FILE="/home/eusadmin/eusupport/backups/eusupport_pre_cutover_XXXXXXXX_XXXXXX.dump"

# Stop all app containers first
docker stop webstack-api-pg nextjs_prod 2>/dev/null

# Drop and recreate
docker exec webstack-api-pg-db psql -U inventory -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='inventory' AND pid <> pg_backend_pid();"
docker exec webstack-api-pg-db psql -U inventory -d postgres -c "DROP DATABASE inventory;"
docker exec webstack-api-pg-db psql -U inventory -d postgres -c "CREATE DATABASE inventory OWNER inventory;"

# Restore from backup
docker cp ${BACKUP_FILE} webstack-api-pg-db:/tmp/restore.dump
docker exec webstack-api-pg-db pg_restore -U inventory -d inventory /tmp/restore.dump

# Restart the old app
docker start webstack-api-pg
docker restart webstack-caddy
```

---

## Staging Validation Results (2026-05-26)

Migration tested against a fresh copy of production data:

| Table | Before | After | Status |
|-------|--------|-------|--------|
| cm_cases | 11 | 11 | ✅ Preserved |
| ledger | 13,081 | 13,081 | ✅ Preserved |
| transactions | 13,005 | 13,005 | ✅ Preserved |
| users | 19 | 19 | ✅ Preserved |
| auth_users | 20 | 20 | ✅ Preserved |
| work_orders | 4,391 | 4,391 | ✅ Preserved |
| inventory | 157 | 157 | ✅ Preserved |
| cm_case_notes | 82 | 82 | ✅ Preserved |
| ops_logistics_activity_log | 1,050 | 1,050 | ✅ Preserved |
| user_teams | 33 | 33 | ✅ Preserved |
| cm_workflows | 1 | 2 | ✅ +1 (refresh) |
| cm_programs | — | 2 | ✅ New table |
| cm_defective_parts_catalog | — | 51 | ✅ New table |
| Total tables | 41 | 58 | ✅ +17 new |

Idempotency verified: second run produces zero changes.

---

## Key Constraints Honored

- ✅ Production database NOT replaced with inventory-dev
- ✅ No `docker compose down -v`
- ✅ No database volume deletion
- ✅ No DROP/TRUNCATE/DELETE in migrations
- ✅ Production data is source of truth
- ✅ inventory-dev used as schema reference only
- ✅ All transactional records preserved
- ✅ Migrations are idempotent and re-runnable
