#!/usr/bin/env bash
set -euo pipefail

# EUS Support — Branch Readiness Check
# Validates june-15-refinement-brandon after legacy Python/FastAPI removal.
# Does NOT merge, modify containers, or touch databases.
#
# Options:
#   --allow-dirty   Proceed even if working tree has uncommitted changes
#   --run-dev-up    Run scripts/dev-up.sh to rebuild the dev stack
#   --push          Push branch and safety tag to origin (requires all checks pass)

BRANCH="june-15-refinement-brandon"
TAG="pre-python-removal-20260615"
ALLOW_DIRTY=false
RUN_DEV_UP=false
DO_PUSH=false

for arg in "$@"; do
  case "$arg" in
    --allow-dirty) ALLOW_DIRTY=true ;;
    --run-dev-up)  RUN_DEV_UP=true ;;
    --push)        DO_PUSH=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN + 1)); }
header() { echo ""; echo "━━━ $1 ━━━"; }

# Track results for summary
COMPOSE_DEV_OK=false
COMPOSE_PROD_OK=false
BUILD_OK=false
SMOKE_PROD_OK=false
SMOKE_DEV_OK=false
FASTAPI_ABSENT=false
DB_PRESENT=false
PUSHED=false

# ─── 1. Branch Safety ───────────────────────────────────────────────────────

header "Branch Safety"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  fail "Not on $BRANCH (currently on: $CURRENT_BRANCH)"
  echo "    Run: git checkout $BRANCH"
  exit 1
fi
pass "On branch $BRANCH"

echo ""
echo "  Latest 5 commits:"
git log --oneline -5 | sed 's/^/    /'

echo ""
DIRTY=$(git status --short)
if [ -n "$DIRTY" ]; then
  echo "  Working tree:"
  echo "$DIRTY" | sed 's/^/    /'
  if [ "$ALLOW_DIRTY" = true ]; then
    warn "Working tree is dirty (--allow-dirty passed)"
  else
    fail "Working tree is dirty. Use --allow-dirty to proceed anyway."
    exit 1
  fi
else
  pass "Working tree is clean"
fi

# ─── 2. Safety Tag ──────────────────────────────────────────────────────────

header "Safety Tag"

TAG_COMMIT=$(git rev-parse "$TAG" 2>/dev/null || true)
if [ -z "$TAG_COMMIT" ]; then
  fail "Tag $TAG does not exist"
  echo "    Create it manually: git tag $TAG <commit-hash>"
  exit 1
fi
pass "Tag $TAG exists → $TAG_COMMIT"

# ─── 3. Container Safety ────────────────────────────────────────────────────

header "Container Safety"

# Old FastAPI containers should NOT be running
for ctr in webstack-api-pg dev-api-pg; do
  if docker ps --format '{{.Names}}' | grep -q "^${ctr}$"; then
    fail "Old FastAPI container '$ctr' is still running"
  else
    pass "Container '$ctr' is not running (expected)"
  fi
done

# Database containers SHOULD be running
DB_ALL_OK=true
for ctr in webstack-api-pg-db dev-api-pg-db; do
  if docker ps --format '{{.Names}}' | grep -q "^${ctr}$"; then
    pass "Database container '$ctr' is running"
  else
    fail "Database container '$ctr' is NOT running"
    DB_ALL_OK=false
  fi
done

if docker ps --format '{{.Names}}' | grep -qE "^(webstack-api-pg|dev-api-pg)$"; then
  FASTAPI_ABSENT=false
else
  FASTAPI_ABSENT=true
fi
[ "$DB_ALL_OK" = true ] && DB_PRESENT=true

# ─── 4. Compose Validation ──────────────────────────────────────────────────

header "Compose Validation"

if docker compose -p eusupport_dev --env-file .env.dev -f docker-compose.dev.yml config > /dev/null 2>&1; then
  pass "docker-compose.dev.yml validates"
  COMPOSE_DEV_OK=true
else
  fail "docker-compose.dev.yml failed validation"
fi

if docker compose -f docker-compose.nextjs-prod.yml config > /dev/null 2>&1; then
  pass "docker-compose.nextjs-prod.yml validates"
  COMPOSE_PROD_OK=true
else
  fail "docker-compose.nextjs-prod.yml failed validation"
fi

# ─── 5. Legacy Reference Check ──────────────────────────────────────────────

header "Legacy Reference Check"

HISTORICAL_EXCLUDES="AS_BUILT.md|KIRO_PROJECT_CONTEXT.md|RELEASE_v2.0.0.md|CUTOVER_PLAN.md"
SEARCH_PATTERN="deploy-dev\.sh|docker-compose\.inventory-prod|api_pg|18002|18006|uvicorn|FastAPI|dev/app|dev/Dockerfile|dev/requirements\.txt"

# Find all matches excluding .git, node_modules, .next
ALL_REFS=$(grep -rn "$SEARCH_PATTERN" \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next \
  . 2>/dev/null || true)

# Split into historical and operational
HISTORICAL_REFS=$(echo "$ALL_REFS" | grep -E "$HISTORICAL_EXCLUDES" || true)
OPERATIONAL_REFS=$(echo "$ALL_REFS" | grep -vE "$HISTORICAL_EXCLUDES" || true)

# Filter operational: allow api_pg_db references (the database, not FastAPI) and prod compose db service
OPERATIONAL_REFS=$(echo "$OPERATIONAL_REFS" | grep -v "api_pg_db\|api_pg_data" || true)

if [ -n "$OPERATIONAL_REFS" ]; then
  fail "Stale references found in operational files:"
  echo "$OPERATIONAL_REFS" | sed 's/^/    /'
else
  pass "No stale operational references"
fi

if [ -n "$HISTORICAL_REFS" ]; then
  HIST_COUNT=$(echo "$HISTORICAL_REFS" | wc -l)
  echo "  ℹ $HIST_COUNT references in historical docs (acceptable)"
fi

# ─── 6. Next.js Build ───────────────────────────────────────────────────────

header "Next.js Build"

if (cd next-app && npm run build) > /dev/null 2>&1; then
  pass "npm run build succeeded"
  BUILD_OK=true
else
  fail "npm run build failed"
fi

# ─── 7. Endpoint Smoke Tests ────────────────────────────────────────────────

header "Endpoint Smoke Tests"

PROD_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" http://localhost:18007/login 2>/dev/null || echo "000")
if [ "$PROD_CODE" = "200" ]; then
  pass "Production (localhost:18007) → HTTP $PROD_CODE"
  SMOKE_PROD_OK=true
else
  fail "Production (localhost:18007) → HTTP $PROD_CODE"
fi

DEV_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" http://localhost:18003/login 2>/dev/null || echo "000")
if [ "$DEV_CODE" = "200" ]; then
  pass "Dev (localhost:18003) → HTTP $DEV_CODE"
  SMOKE_DEV_OK=true
else
  fail "Dev (localhost:18003) → HTTP $DEV_CODE"
fi

# ─── 8. Dev Script Check ────────────────────────────────────────────────────

header "Dev Script Check"

if [ -f scripts/dev-up.sh ]; then
  pass "scripts/dev-up.sh exists"
  if [ -x scripts/dev-up.sh ]; then
    pass "scripts/dev-up.sh is executable"
  else
    fail "scripts/dev-up.sh is not executable"
  fi
else
  fail "scripts/dev-up.sh does not exist"
fi

if [ "$RUN_DEV_UP" = true ]; then
  echo ""
  echo "  Running: ./scripts/dev-up.sh $BRANCH"
  if ./scripts/dev-up.sh "$BRANCH"; then
    pass "dev-up.sh completed successfully"
    # Re-check dev endpoint
    sleep 5
    DEV_CODE2=$(curl -fsS -o /dev/null -w "%{http_code}" http://localhost:18003/login 2>/dev/null || echo "000")
    if [ "$DEV_CODE2" = "200" ]; then
      pass "Dev (localhost:18003) post-rebuild → HTTP $DEV_CODE2"
      SMOKE_DEV_OK=true
    else
      fail "Dev (localhost:18003) post-rebuild → HTTP $DEV_CODE2"
      SMOKE_DEV_OK=false
    fi
  else
    fail "dev-up.sh failed"
  fi
fi

# ─── 9. Push (optional) ─────────────────────────────────────────────────────

if [ "$DO_PUSH" = true ]; then
  header "Push"
  if [ "$FAIL" -gt 0 ]; then
    fail "Cannot push — $FAIL validation failure(s) detected"
  else
    echo "  Pushing branch and tag..."
    git push -u origin "$BRANCH" 2>&1 | sed 's/^/    /'
    git push origin "$TAG" 2>&1 | sed 's/^/    /'
    pass "Pushed $BRANCH and tag $TAG to origin"
    PUSHED=true
  fi
fi

# ─── 10. Summary ────────────────────────────────────────────────────────────

header "Summary"

CURRENT_COMMIT=$(git rev-parse --short HEAD)

echo ""
echo "  Branch:              $BRANCH"
echo "  Current commit:      $CURRENT_COMMIT"
echo "  Safety tag:          $TAG → ${TAG_COMMIT:0:7}"
echo "  Compose (dev):       $( [ "$COMPOSE_DEV_OK" = true ] && echo "PASS" || echo "FAIL" )"
echo "  Compose (prod):      $( [ "$COMPOSE_PROD_OK" = true ] && echo "PASS" || echo "FAIL" )"
echo "  Next.js build:       $( [ "$BUILD_OK" = true ] && echo "PASS" || echo "FAIL" )"
echo "  Smoke prod (18007):  $( [ "$SMOKE_PROD_OK" = true ] && echo "PASS" || echo "FAIL" )"
echo "  Smoke dev (18003):   $( [ "$SMOKE_DEV_OK" = true ] && echo "PASS" || echo "FAIL" )"
echo "  FastAPI absent:      $( [ "$FASTAPI_ABSENT" = true ] && echo "YES" || echo "NO — old containers still running!" )"
echo "  DB containers:       $( [ "$DB_PRESENT" = true ] && echo "PRESENT" || echo "MISSING!" )"
echo "  Pushed:              $( [ "$PUSHED" = true ] && echo "YES" || echo "NO" )"
echo ""
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  ✗ BRANCH NOT READY — fix $FAIL failure(s) above"
  exit 1
else
  echo "  ✓ BRANCH READY"
  exit 0
fi
