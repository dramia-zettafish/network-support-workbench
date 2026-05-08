# Network Vcode - Networking Workspace

This branch is the active workspace for the standalone Next.js runtime. The app now runs as Next.js pages plus Next.js API routes backed by PostgreSQL.

## Branch Purpose

`next-api-backend-foundation` starts from the polished Networking workspace UI and is the active branch for the local Next.js/PostgreSQL runtime:

- Node/Postgres database access with `pg`
- Next.js API routes for current ticket and UPS behavior
- PostgreSQL schema initialization from SQL
- Archived Python backend for temporary reference
- No auth, production routing, TLS, or deployment hardening in this phase

Major workflow rewrites should wait until the standalone runtime has settled.

## Branch Map

- `v3`: legacy stable FastAPI plus vanilla HTML/CSS/JS app with the full Tickets/RMA/UPS workflow.
- `nextjs-baseline`: completed Next.js migration checkpoint.
- `nextjs-migration-complete`: tag marking the exact migration baseline commit.
- `networking-workspace`: active redesign branch built from the Next.js baseline.
- `ups-workflow-polish`: stable polished UI/UX checkpoint before Next API migration.
- `next-api-backend-foundation`: active local backend migration branch.

## Current Architecture

```text
repo/
  archive/python-backend/
                       Archived FastAPI backend, models, schemas, and Alembic migrations
  db/network_vcode_schema.sql
                       PostgreSQL schema source for local development
  frontend/            Next.js frontend using the App Router
  frontend/app/api     Next.js API routes
  caddy/Caddyfile      Single browser entrypoint and API proxy
  docker-compose.yml   Local development stack
```

PostgreSQL initializes from `db/network_vcode_schema.sql` on a fresh Docker volume. FastAPI and Alembic are archived and are not part of the normal runtime.

## Local Services

Docker Compose starts three services:

- `db`: PostgreSQL 16
- `frontend`: Next.js on port `3000`
- `caddy`: public entrypoint on `http://localhost:8080`

Caddy routes requests as follows:

```text
/*         -> Next.js frontend:3000
```

The Next.js frontend should call backend endpoints through `/api`, for example:

```text
/api/tickets/
```

Next.js owns both page rendering and API routes.

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

To reset local development data and reinitialize the schema from SQL:

```powershell
docker compose down -v
docker compose up --build
```

## Current Frontend State

The Next.js app currently includes:

- App Router setup
- Global CSS variable system in `frontend/app/globals.css`
- Plain CSS modules for component styles
- Dark theme by default
- Light mode through `data-theme="light"` on `<html>`
- Persistent app shell
- Left sidebar with `Dashboard`, `Networking`, `Inventory`, `Reports`, and `Settings`
- Networking workspace top tabs with `Operations`, `Tickets`, and `UPS`
- Functional Operations landing page backed by existing ticket and UPS APIs
- Functional Tickets tab
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
- Row-click Device Response modal for AP and switch response workflows
- No Replacement response as the default modal workflow
- Permanent replacement response template copied to clipboard
- Temporary device plus RMA replacement response templates copied to clipboard
- Resolution type locking after the first response is copied
- Temporary + RMA flow with clipboard-ready RMA email handoff after the temporary response
- RMA email generation with fixed `HISD` customer, ticket campus, defective model/SN, Dynamics Case #, and Issue
- UPS-specific ticket response flow with editable response note, one default UPS row, optional added UPS rows, and optional battery packs
- Copy UPS Response closes the ticket and seeds the existing UPS pending install record with the first UPS and battery pack details
- UPS response fields intentionally start blank so device details are entered from the technician response

The standalone RMA frontend tab has been retired. RMA email handoff now lives inside the Temporary + RMA ticket response flow.

The UPS tab currently supports:

- Pending installs table from `/api/ups-installations/?status=intake`
- In Progress table from `/api/ups-installations/?status=scheduled` and `/api/ups-installations/?status=servicing`
- Row selection state
- Derived equipment display
- Status labels
- NOC schedule generation from selected pending rows
- Per-row proposed install date editing before moving records to In Progress, defaulting to Monday of the next calendar week
- Outlook-friendly schedule table copied to clipboard
- Highlighted install date badges in the In Progress table
- Warehouse email preview from selected In Progress rows
- `Select Scheduled` batch selection for visible scheduled UPS records before warehouse generation
- Editable UPS PO and BP PO fields in the warehouse preview
- Blank warehouse email fields normalized to `N/A`
- Outlook-friendly warehouse table copied to clipboard
- Warehouse copy marks selected records as `Servicing`
- Servicing In Progress rows open the Phase 3 fulfillment modal
- Scheduled In Progress rows remain non-clickable until the warehouse table has been copied
- Row-level `Remove` action sends an In Progress record back to Pending
- Phase 3 device save through `/api/ups-installations/{id}/phase3-devices`
- Explicit Move to Completed action for selected In Progress rows
- Completed UPS table from `/api/ups-installations/?status=fulfilled`
- Completed UPS search scoped to the Completed table
- Completed UPS asset-reference columns for asset tag, UPS SN, MAC, SNMP IP, and status
- Completed UPS row-click summary modal for full install details

UPS records now stay in In Progress while fulfillment details are saved, then move to Completed only when selected and explicitly closed out.

The Operations dashboard currently supports:

- Open Tickets section with an open count, on-hold detail, create-ticket action, and open/on-hold preview table
- UPS This Week section with pending count, current-week install count, and a Monday-Friday install table
- Current-day UPS install dates highlighted in the weekly table
- Recent Closed Work table from closed tickets and fulfilled UPS installs
- Quick Actions for ticket creation and UPS workflow navigation inside their related sections
- Dashboard buttons on Tickets and UPS workflow pages
- Dashboard refresh without changing backend routes

## Backend Notes

The active backend is implemented with Next.js API routes and Node.js `pg`. The old FastAPI/Alembic backend has been moved to `archive/python-backend/` for temporary reference only.

Important existing backend behavior:

- Tickets default to `Open`.
- Ticket # is stored as `external_ticket_number` and is limited to 8 characters.
- TEA code is limited to 3 digits.
- Ticket edits are limited to `note` and `status`.
- Device responses are stored one per ticket in `device_responses`.
- Device response routes live under `/api/tickets/{ticket_number}/response` in the Next.js API layer.
- Legacy RMA backend routes remain available but are no longer exposed in the Next.js workspace.
- Tickets and UPS routes are available through the Next.js API layer under `/api/*`.
- Local schema initialization is handled by `db/network_vcode_schema.sql`.

Migrated Next.js API routes currently include:

- `GET /api/tickets`
- `POST /api/tickets`
- `PUT /api/tickets/{ticket_number}`
- `DELETE /api/tickets/{ticket_number}`
- `GET /api/tickets/{ticket_number}/response`
- `POST /api/tickets/{ticket_number}/response`
- `PATCH /api/tickets/{ticket_number}/response`
- `GET /api/ups-installations`
- `PUT /api/ups-installations/{ups_installation_id}`
- `PATCH /api/ups-installations/{ups_installation_id}/phase2`
- `PATCH /api/ups-installations/{ups_installation_id}/phase3-schedule`
- `PATCH /api/ups-installations/{ups_installation_id}/phase3-warehouse`
- `PATCH /api/ups-installations/{ups_installation_id}/phase3-devices`
- `POST /api/ups/schedule`
- `POST /api/ups/schedule/custom`
- `PATCH /api/ups/{ups_installation_id}/rollback`

Manual parity verification was completed locally through `http://localhost:8080` after the Next.js API migration foundation was added. Verified workflows include ticket create/edit/delete, device response create/update, UPS ticket to pending, scheduling, rollback, warehouse PO/status update, fulfillment save, completed summary, and Operations dashboard refresh.

Fresh runtime verification was also completed after removing the FastAPI service from Docker Compose. Verified `docker compose up --build` with a fresh PostgreSQL volume, schema initialization from SQL, frontend load, ticket API list/create/edit, UPS auto-create, scheduling, warehouse update, fulfillment save, and rollback.

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

## Runtime Guardrails

For the next phase, keep the standalone runtime behavior intact:

- Keep API calls behind `/api/*`.
- Keep colors in CSS variables.
- Prefer small route-compatible changes over broad rewrites.
- Keep the archived Python backend untouched unless a future cleanup task explicitly removes it.
