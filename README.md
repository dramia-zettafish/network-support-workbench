# Network Vcode - Networking Workspace

This branch is the active workspace for the post-migration UI redesign. The FastAPI backend remains in `app/`, and the frontend now runs as a separate Next.js app in `frontend/`.

## Branch Purpose

`networking-workspace` starts from the completed Next.js migration baseline and is the active branch for the structural UI pass:

- Shared app shell
- Sidebar layout
- Networking workspace
- Top tab navigation
- Operations landing page
- Shared card and table UI system

Major workflow rewrites should wait until the shell and navigation structure are stable.

## Branch Map

- `v3`: legacy stable FastAPI plus vanilla HTML/CSS/JS app with the full Tickets/RMA/UPS workflow.
- `nextjs-baseline`: completed Next.js migration checkpoint.
- `nextjs-migration-complete`: tag marking the exact migration baseline commit.
- `networking-workspace`: active redesign branch built from the Next.js baseline.

## Current Architecture

```text
repo/
  app/                 FastAPI backend, database models, schemas, Alembic migrations
  frontend/            Next.js frontend using the App Router
  caddy/Caddyfile      Single browser entrypoint and API proxy
  docker-compose.yml   Local development stack
```

The backend routes, models, schemas, and database logic are unchanged from the migration baseline.

## Local Services

Docker Compose starts four services:

- `db`: PostgreSQL 16
- `app`: FastAPI on port `8000` inside Docker
- `frontend`: Next.js on port `3000`
- `caddy`: public entrypoint on `http://localhost:8080`

Caddy routes requests as follows:

```text
/api/*     -> FastAPI app:8000, with /api stripped
/*         -> Next.js frontend:3000
```

The Next.js frontend should call backend endpoints through `/api`, for example:

```text
/api/tickets/
```

FastAPI still receives the original route:

```text
/tickets/
```

## Run Locally

```powershell
docker compose up --build
```

Open:

```text
http://localhost:8080
```

The Next.js dev server is also exposed directly at:

```text
http://localhost:3000
```

Use Caddy on port `8080` for normal app testing because it verifies the same frontend/API routing used by the stack.

## Verification

Run a production frontend build:

```powershell
docker compose exec -e NODE_ENV=production frontend npm run build
```

Check containers:

```powershell
docker compose ps
```

Check the Caddy routes:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080/
Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/tickets/?limit=1&offset=0"
```

Expected result: both return HTTP `200`.

## Current Frontend State

The Next.js app currently includes:

- App Router setup
- Global CSS variable system in `frontend/app/globals.css`
- Plain CSS modules for component styles
- Dark theme by default
- Light mode through `data-theme="light"` on `<html>`
- Persistent app shell
- Left sidebar with `Dashboard`, `Networking`, `Inventory`, `Reports`, and `Settings`
- Networking workspace top tabs with `Operations`, `Tickets`, `UPS`, and `RMA`
- Functional Operations landing page with mock control-center data
- Functional Tickets tab
- Functional RMA tab
- UPS foundation view with Pending and In Progress tables

Shared components currently include:

- `PageHeader`
- `StatCard`
- `SectionCard`
- `DataTable`
- `StatusBadge`
- `EmptyState`
- `TabNavigation`
- `SidebarNavigation`

The Tickets tab currently supports:

- Ticket creation
- Ticket list
- Status filter
- Search
- Pagination
- Edit modal
- Delete action

The RMA tab currently supports:

- RMA creation
- RMA list/search
- Edit modal
- Delete action
- Related open-ticket dropdown
- Clipboard-ready admin prompt after creation

The UPS tab currently supports:

- Pending installs table from `/api/ups-installations/?status=intake`
- In Progress table from `/api/ups-installations/?status=scheduled`
- Search
- Row selection state
- Derived equipment display
- Status labels
- Pending row service-info modal
- Phase 2 service-info save through `/api/ups-installations/{id}/phase2`
- Service response email copy from the service-info modal
- NOC schedule generation from selected pending rows
- Per-row proposed install date editing before moving records to In Progress
- Outlook-friendly schedule table copied to clipboard
- Warehouse email preview from selected In Progress rows
- Warehouse missing-field warnings
- Outlook-friendly warehouse table copied to clipboard
- Read-only In Progress row summary modal
- Phase 3 fulfillment modal for In Progress rows
- Phase 3 device save through `/api/ups-installations/{id}/phase3-devices`

UPS completion actions are intentionally deferred to later branches.

## Backend Notes

The backend remains FastAPI and PostgreSQL. Alembic runs automatically when the `app` service starts.

Current migration head:

```text
012_add_ticket_mdf_idf
```

Important existing backend behavior:

- Tickets default to `Open`.
- Ticket # is stored as `external_ticket_number` and is limited to 8 characters.
- TEA code is limited to 3 digits.
- Ticket edits are limited to `note` and `status`.
- RMA and UPS backend routes still exist, but their Next.js tabs are placeholders on this branch.

## Dependency Notes

The frontend uses:

- Next.js `16.2.5`
- React `19.2.0`
- CSS modules
- No Tailwind
- No CSS-in-JS

`frontend/package-lock.json` is committed so installs are repeatable. Generated folders are ignored:

```text
frontend/node_modules/
frontend/.next/
```

## Redesign Guardrails

For the next phase, keep the migration baseline behavior intact while building the shell:

- Do not change FastAPI routes unless a future task explicitly calls for it.
- Keep API calls behind `/api/*`.
- Keep colors in CSS variables.
- Prefer shared layout primitives before adding new workflow-specific screens.
- Bring RMA and UPS into Next.js after the app shell pattern is stable.
