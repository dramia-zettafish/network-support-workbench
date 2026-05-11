# Network Vcode

Network Vcode is a Dockerized Next.js and PostgreSQL workspace for managing network operations tickets and UPS installation workflows.

The app is built around a practical operations dashboard: teams can create and track tickets, generate device-response notes, move UPS records through scheduling and fulfillment, and review completed installation details from a single browser-based interface.

## Features

- Operations dashboard with ticket and UPS workflow summaries
- Ticket creation, search, filtering, editing, and deletion
- Device response workflows with clipboard-ready response templates
- UPS installation intake, scheduling, warehouse handoff, fulfillment, rollback, and completed-record review
- Next.js API routes backed by PostgreSQL
- Docker Compose runtime with Caddy as the local entrypoint

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

## API Surface

The Next.js API layer exposes routes under `/api/*`, including:

- `/api/tickets`
- `/api/tickets/{ticket_number}`
- `/api/tickets/{ticket_number}/response`
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
- Keep generated folders such as `frontend/node_modules/` and `frontend/.next/` out of version control.
- Prefer focused changes that preserve the current Next.js/PostgreSQL architecture.
- Use the workflow notes in `docs/` for implementation context.

## Status

This repository contains the working application form and current Docker-based runtime.
