#!/usr/bin/env bash
set -euo pipefail

# EUS Support — DEV stack deploy/rebuild (Next.js)
# Usage: ./scripts/dev-up.sh [branch]
#   If branch is provided, checks out that branch before building.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -p eusupport_dev --env-file .env.dev -f docker-compose.dev.yml"
VM_IP="10.214.30.244"
PORT="18003"

cd "$PROJECT_DIR"

if [ "${1:-}" != "" ]; then
  echo "── Switching to branch: $1 ──"
  git fetch origin
  git checkout "$1"
  git pull origin "$1" 2>/dev/null || true
fi

echo "── Building DEV stack ──"
$COMPOSE build

echo "── Starting DEV stack ──"
$COMPOSE up -d

echo "── Waiting for health check ──"
for i in $(seq 1 30); do
  if curl -sf "http://${VM_IP}:${PORT}/login" >/dev/null 2>&1; then
    echo "✓ DEV is healthy at http://${VM_IP}:${PORT}"
    exit 0
  fi
  sleep 2
done

echo "✗ DEV did not become healthy within 60 seconds"
$COMPOSE logs --tail=30
exit 1
