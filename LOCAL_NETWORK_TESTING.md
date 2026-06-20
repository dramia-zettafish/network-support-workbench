# Local Network Workbench Testing

EUSupport is the parent application. The Network Workbench is hosted inside EUSupport at `/network`; its API routes are under `/api/network/*`; and its database uses `NETWORK_DATABASE_URL`, separate from EUSupport `DATABASE_URL`.

## Recommended Docker Startup

From this directory:

```sh
cp .env.local.example .env.local
docker compose --env-file .env.local -f docker-compose.local.yml up -d --build
docker compose --env-file .env.local -f docker-compose.local.yml exec nextjs_dev npm run seed:local-network-users
```

Open:

```text
http://localhost:18004
```

## What Docker Initializes

- `eusupport_db`: restores `../inventory_dev_sanitized_20260513_194234.dump`, then applies `migrations/*.sql`.
- `network_db`: applies `network-workbench-db/network_vcode_schema.sql`, then applies `network-workbench-db/patches/*.sql`.
- `nextjs_dev`: runs EUSupport Next.js on container port `3000`, exposed locally as `18004`.

## Environment Variables

The Docker stack sets these inside the app container:

```sh
DATABASE_URL=postgresql://eusupport:eusupport@eusupport_db:5432/eusupport_local
NETWORK_DATABASE_URL=postgresql://network:network@network_db:5432/network_workbench_local
AUTH_PROVIDER=legacy
NEXT_PUBLIC_NETWORK_ROUTE_PREFIX=/network
NEXT_PUBLIC_NETWORK_API_BASE=/api/network
```

For host-based `npm run dev:local`, create `next-app/.env.local` with equivalent host URLs:

```sh
AUTH_PROVIDER=legacy
SESSION_SECRET=local-dev-session-secret-change-me-32chars
DATABASE_URL=postgresql://eusupport:eusupport@localhost:15432/eusupport_local
NETWORK_DATABASE_URL=postgresql://network:network@localhost:15433/network_workbench_local
NEXT_PUBLIC_NETWORK_ROUTE_PREFIX=/network
NEXT_PUBLIC_NETWORK_API_BASE=/api/network
NEXT_PUBLIC_ENV_LABEL=local
WRITES_ENABLED=true
NEXT_PUBLIC_WRITES_ENABLED=true
```

Then run:

```sh
cd next-app
npm install
npm run seed:local-network-users
PORT=18004 npm run dev:local
```

## Local Test Users

Run `npm run seed:local-network-users` after the EUSupport DB is restored.

| Username | Password | Role | Teams |
| --- | --- | --- | --- |
| `NTech` | `T3sting!` | `technician` | `network_technicians` |
| `Dev User` | `Admin123!` | `manager` | all workspace teams |

Expected visibility:

- `NTech`: `My Workspace` and `Network Technician`; access to `/network`, `/network/tickets`, and `/network/ups`.
- `Dev User`: all workspace tabs, Management, and Network Technician routes.

## Manual Smoke Checks

```sh
curl -i http://localhost:18004/network
curl -i http://localhost:18004/api/network/tickets
```

Unauthenticated requests should redirect to `/login` for pages and return `401` for protected APIs.

After logging in through the browser, verify:

- Network module links are `/network`, `/network/tickets`, `/network/ups`, and `/runbook`.
- Browser network calls use `/api/network/*`.
- No workbench calls go to old standalone paths such as `/api/tickets` or `/api/ups-installations`.

## Reset Local Databases

```sh
docker compose --env-file .env.local -f docker-compose.local.yml down -v
docker compose --env-file .env.local -f docker-compose.local.yml up -d --build
docker compose --env-file .env.local -f docker-compose.local.yml exec nextjs_dev npm run seed:local-network-users
```
