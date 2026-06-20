# EUS Support — DEV Deployment

DEV runs alongside production on the same VM. It uses a separate Docker Compose project, database, volumes, and port.

## Quick Reference

| | Production | DEV |
|---|---|---|
| Compose file | `docker-compose.nextjs-prod.yml` | `docker-compose.dev.yml` |
| Env file | `.env.nextjs-prod` | `.env.dev` |
| Project name | `eusupport` | `eusupport_dev` |
| URL | https://EUSupport.netsync.com (port 443) | http://10.214.30.244:18003 |
| DB volume | `eusupport_api_pg_data` | `eusupport_dev_dev_api_pg_data` |
| Containers | `eusupport-nextjs-prod`, `webstack-api-pg-db`, `webstack-caddy` | `dev-nextjs`, `dev-api-pg-db` |
| App framework | Next.js (App Router) | Next.js (App Router, dev mode) |

## Deploy / Update

```bash
./scripts/dev-up.sh
```

Or manually:

```bash
docker compose -p eusupport_dev --env-file .env.dev -f docker-compose.dev.yml up -d --build
```

## Manual Commands

All DEV commands use the `-p eusupport_dev` project flag to isolate from production.

```bash
# Start / rebuild
docker compose -p eusupport_dev --env-file .env.dev -f docker-compose.dev.yml up -d --build

# Stop (DEV only — production is untouched)
docker compose -p eusupport_dev --env-file .env.dev -f docker-compose.dev.yml down

# Logs
docker compose -p eusupport_dev -f docker-compose.dev.yml logs -f

# Status
docker compose -p eusupport_dev -f docker-compose.dev.yml ps

# Verify health
curl http://10.214.30.244:18003/login
```

## Wipe DEV Data (reset database)

```bash
docker compose -p eusupport_dev --env-file .env.dev -f docker-compose.dev.yml down -v
./scripts/dev-up.sh
```

The `-v` flag removes the DEV database volume. Production volumes are not affected.

## Environment File

Copy `.env.dev` from `.env.dev.ubuntu.example` and update secrets as needed. Key differences from production:
- `DEV_INVENTORY_PG_DB=inventory_dev` — separate database
- `NEXT_PUBLIC_ENV_LABEL=development` — triggers the dev UI banner
- `SESSION_SECRET` — different from production (DEV sessions won't work in prod)

`.env.dev` is gitignored. Do not commit it.

## Database

PostgreSQL 16, accessed directly by Next.js API routes via the `pg` driver.

- Schema migrations are in `migrations/*.sql`
- Run manually against the dev database when new migrations are added:
  ```bash
  docker exec dev-api-pg-db psql -U inventory_dev -d inventory_dev -f /path/to/migration.sql
  ```

## Architecture

```
┌──────────────┐     ┌───────────────┐
│  Next.js     │────▶│ PostgreSQL 16 │
│  (port 3000) │     │ (port 5432)   │
│  dev-nextjs  │     │ dev-api-pg-db │
└──────────────┘     └───────────────┘
       ↑
 http://10.214.30.244:18003
```
