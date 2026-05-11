# Network Vcode - Networking Workspace

A Next.js + PostgreSQL ticket and UPS installation tracking application for network infrastructure management. This is the active production runtime.

## Stack

- **Frontend:** Next.js 16+ with App Router, React 19, plain CSS modules
- **Backend:** Next.js API routes using Node.js `pg` for PostgreSQL access
- **Database:** PostgreSQL 16 with schema initialization from SQL
- **Proxy:** Caddy reverse proxy for routing and local HTTPS (dev)
- **Container:** Docker Compose for local development

**For detailed workflow documentation, see [WORKFLOW.md](WORKFLOW.md).**

## Project Structure

```text
repo/
  db/network_vcode_schema.sql     PostgreSQL schema source
  frontend/                       Next.js frontend (App Router + API routes)
  frontend/app/                   Next.js pages
  frontend/app/api/               Next.js API routes
  caddy/Caddyfile                 Reverse proxy configuration
  docker-compose.yml              Local development stack
  WORKFLOW.md                     Business logic and state machines
```

PostgreSQL initializes from `db/network_vcode_schema.sql` on a fresh Docker volume.

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

The backend is implemented with Next.js API routes and Node.js `pg` client for database access.

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

The current runtime has been verified with a fresh PostgreSQL volume, schema initialization from SQL, frontend load, ticket API operations (list/create/edit), UPS auto-create and full workflow (scheduling, warehouse update, fulfillment save).

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
- Maintain the current Next.js/PostgreSQL architecture as the stable runtime.
- Keep older implementation references under `archive/`; do not reintroduce legacy runtime entrypoints at the repo root.
