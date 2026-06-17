# Network Vcode

Network Vcode is a Dockerized Next.js and PostgreSQL workspace for managing network operations tickets and UPS installation workflows.

The app is built around a practical operations dashboard: teams can create and track tickets, generate device-response notes, move UPS records through scheduling and fulfillment, and review completed installation details from a single browser-based interface.

Network Vcode is currently a standalone local app intended for local or trusted team access over Tailscale. It is not production-authenticated yet; the future EUSupport merge is expected to provide Duo NG/session authentication and the shared server deployment boundary.

## Features

- Operations dashboard with ticket and UPS workflow summaries
- Ticket creation, search, filtering, editing, and deletion
- Device response workflows with clipboard-ready response templates
- UPS installation intake, scheduling, warehouse handoff, fulfillment, rollback, and completed-record review
- Next.js API routes backed by PostgreSQL
- Docker Compose runtime with Caddy as the local entrypoint
- EUSupport-aligned top navigation shell with a standalone local current-user seam

## Tech Stack

- Next.js 16 with App Router
- React 19
- PostgreSQL 16
- Node.js `pg`
- CSS modules
- Docker Compose
- Caddy

## Project Structure

```text
.
├── caddy/                  Caddy reverse proxy config
├── db/                     PostgreSQL schema initialization
├── docs/                   Workflow and migration notes
├── frontend/               Next.js app, components, API routes, and shared libs
├── scripts/                Utility/import scripts
├── docker-compose.yml      Local development stack
└── README.md
```

The active application lives in `frontend/`. Historical Python backend code is preserved under `archive/` for reference only.

## Getting Started

Requirements:

- Docker Desktop or compatible Docker Engine
- Docker Compose

Start the full local stack:

```powershell
docker compose up --build
```

Open the app through Caddy:

```text
http://localhost:8080
```

The Next.js server is also exposed directly at:

```text
http://localhost:3000
```

For normal testing, use `http://localhost:8080` so requests exercise the same frontend and API routing path as the composed runtime.

For team testing over Tailscale, keep the app behind the local Caddy entrypoint and expose only the trusted Tailscale address. Standalone mode uses a local/mock `Network Team` user from `GET /api/auth/me`; it does not enforce EUSupport Duo NG or session cookies.

## Database

PostgreSQL initializes from:

```text
db/network_vcode_schema.sql
```

To reset local development data and rebuild from the schema:

```powershell
docker compose down -v
docker compose up --build
```

## UPS Workflow

UPS tickets create intake records that move through Pending, Scheduled, Servicing, and Completed. Multiple UPS records can belong to the same ticket when a campus needs more than one unit replaced.

Pending and servicing records keep defective UPS asset/MAC data separate from replacement UPS asset/MAC data. Fulfillment captures replacement UPS serial, replacement asset tag, replacement MAC, SNMP/IP details, and replacement battery pack details. Completed records are shown as a lookup table with the core fields: ticket, school, UPS serial, MAC, and IP.

Historical UPS imports are standalone completed records and do not create ticket rows. The importer maps historical replacement asset tags and MAC addresses into the replacement fields, strips spreadsheet `.0` suffixes from asset tags, and skips rows that collide with active pending or in-progress UPS work.

## Useful Commands

Run a production build inside the frontend container:

```powershell
docker compose exec -e NODE_ENV=production frontend npm run build
```

Check running services:

```powershell
docker compose ps
```

Smoke test the app and ticket API:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080/
Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/tickets?limit=1&offset=0"
```

Both requests should return HTTP `200` when the stack is healthy.

## Screenshot Demo Mode

For public-safe Dashboard and UPS screenshots, run the frontend screenshot mode:

```bash
cd frontend
npm run demo:screenshots
```

Open `http://localhost:4005/` for the Dashboard and `http://localhost:4005/ups` for UPS. This mode is enabled by `NEXT_PUBLIC_SCREENSHOT_MODE=true`, uses `Network Support Workbench` as the visible app name, and swaps only the Dashboard and UPS pages to the safe fake data in `frontend/lib/screenshotData.js`.

Keep this mode narrow: do not use it as a full demo app, database seed, or replacement for normal development data. Normal development behavior stays database-backed unless the screenshot flag is enabled.

## API Surface

The Next.js API layer exposes routes under `/api/*`, including:

- `/api/tickets`
- `/api/tickets/{ticket_number}`
- `/api/tickets/{ticket_number}/response`
- `/api/ticket-responses/{ticket_number}`
- `/api/ups-installations`
- `/api/ups-installations/{ups_installation_id}`
- `/api/ups-installations/{ups_installation_id}/phase2`
- `/api/ups-installations/{ups_installation_id}/phase3-schedule`
- `/api/ups-installations/{ups_installation_id}/phase3-warehouse`
- `/api/ups-installations/{ups_installation_id}/phase3-devices`
- `/api/ups/schedule`
- `/api/ups/schedule/custom`
- `/api/ups/{ups_installation_id}/rollback`

## Development Notes

- Keep API calls routed through `/api/*`.
- Use `NEXT_PUBLIC_NETWORK_API_BASE` only when testing a future API mount; it defaults to `/api`.
- Current standalone routes are `/`, `/tickets`, and `/ups`; the future EUSupport target is the same workflow under `/network`.
- Keep generated folders such as `frontend/node_modules/` and `frontend/.next/` out of version control.
- Prefer focused changes that preserve the current Next.js/PostgreSQL architecture.
- Use the workflow notes in `docs/` for implementation context, including `docs/EUSUPPORT_ALIGNMENT_NOTES.md`.

## Status

This repository contains the working application form and current Docker-based runtime.
