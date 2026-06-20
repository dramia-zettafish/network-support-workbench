# EUS Support - Next.js App (Shell)

## Purpose

This `next-app/` directory contains the Next.js App Router frontend shell for the EUS Support application. It is a cleanly separated JavaScript-only frontend project that coexists alongside the existing Python/FastAPI backend without any interference.

**This is the initial shell only — no business logic has been migrated.**

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 14 (App Router)
- **Language**: JavaScript (.js/.jsx only — no TypeScript)
- **Runtime**: Node.js

## Prerequisites

- **Node.js**: v18+ (v24+ recommended)
- **npm**: v9+ (v11+ recommended)

## Getting Started

### Install Dependencies

```bash
cd next-app
npm install
```

### Run Development Server

```bash
npm run dev
```

The development server starts at [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm run start
```

The production server starts at [http://localhost:3000](http://localhost:3000).

### Lint

```bash
npm run lint
```

## Available Endpoints

### Health Check

```
GET /api/health
```

Returns a JSON response confirming the application is running:

```json
{
  "status": "ok",
  "timestamp": "2026-05-06T18:00:00.000Z",
  "version": "0.1.0"
}
```

### Environment Label

```
GET /api/env-label
```

Returns the current environment label:

```json
{
  "environment": "development"
}
```

The environment label is read from the `NEXT_PUBLIC_ENV_LABEL` or `ENV_LABEL` environment variable, defaulting to `"development"` if not set.

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure as needed:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_ENV_LABEL` | Environment label displayed in the UI and API | `development` |

## Project Structure

```
next-app/
├── app/
│   ├── api/
│   │   ├── env-label/
│   │   │   └── route.js        # Environment label endpoint
│   │   └── health/
│   │       └── route.js        # Health check endpoint
│   ├── components/
│   │   ├── dashboard-cards.module.css  # Dashboard card grid styles
│   │   ├── db-health-card.jsx          # Live DB health status card
│   │   ├── nav-header.jsx             # Global navigation header
│   │   └── nav-header.module.css      # Navigation header styles
│   ├── globals.css             # Global styles
│   ├── layout.jsx              # Root layout (includes NavHeader)
│   └── page.jsx                # Dashboard landing page with cards
├── .env.local.example          # Environment variable template
├── .gitignore                  # Next.js-specific ignores
├── jsconfig.json               # JavaScript path aliases
├── next.config.js              # Next.js configuration
├── package.json                # Project manifest
├── package-lock.json           # Dependency lock file
└── README.md                   # This file
```

## Production Readiness

See **[docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md)** for the full production readiness checklist, including:

- Module status (RMA, Logistics, Auth, Write Safety)
- Required environment variables
- Validation commands
- Manual smoke test checklist
- Known limitations and deferred work
- Rollback/disable guidance

### Quick Validation

```bash
npm run validate:db-readonly
npm run validate:write-safety
npm run validate:auth-safety
npm run validate:production-readiness
```

All four must pass before deployment.

## Important Notes

- The existing Python/FastAPI application remains completely unmodified and continues to operate independently.
- No connection to production data or production services has been established without explicit configuration.
- Auth defaults to mock (dev-only) — set `AUTH_PROVIDER=legacy` for production.
- Writes are disabled by default — set `WRITES_ENABLED=true` only when ready.
- No TypeScript is used in this project — all source files use `.js` or `.jsx` extensions.

---

## Navigation Shell

### Overview

A persistent global navigation header and dashboard landing page provide a clean read-only navigation experience linking the Inventory, Cases, and Case Detail views together.

### Components

| File | Purpose |
|------|---------|
| `app/components/nav-header.jsx` | Client component rendering a horizontal navigation bar with active route highlighting |
| `app/components/nav-header.module.css` | Navigation bar styles (white bg, blue accents, system font) |
| `app/components/db-health-card.jsx` | Client component displaying live database connectivity status |
| `app/components/dashboard-cards.module.css` | Card grid and status indicator styles |

### Navigation Bar

The NavHeader component is rendered in the root layout (`app/layout.jsx`) and appears on every page. It provides:

- **Brand link** — "EUS Support" links back to the dashboard (/).
- **Environment badge** — displays the current environment label (development/staging/production).
- **Navigation links** — Dashboard (/), Inventory (/inventory), Cases (/cases).
- **Active route highlighting** — the current route's link is visually distinguished with a blue bottom border and bold weight. The Cases link is also highlighted when viewing `/cases/[id]` detail pages.

### Dashboard Landing Page

The root page (`/`) displays:

- An operational status message confirming the shell is running.
- A card grid with:
  - **Inventory card** — links to /inventory with a description of parts catalog and stock levels.
  - **Cases card** — links to /cases with a description of case management and tracking.
  - **Database Health card** — fetches GET /api/db-health on mount and shows a green (Connected) or red (Disconnected) status indicator. This card does not navigate; it shows live status.
- A shell status section showing version, framework, and mode information.

### Read-Only Constraint

All navigation features are strictly read-only:
- No database writes are performed.
- No POST, PUT, PATCH, or DELETE requests are made.
- No auth implementation changes are introduced.
- The only HTTP request made by the dashboard is GET /api/db-health for the status indicator.

### Additive Design

This navigation shell is additive. Existing per-page dashboard-header sections on /inventory, /cases, /cases/[id], and /protected pages are preserved unchanged. The global NavHeader sits above page content without replacing page-specific headers.

### Validation

```bash
# Confirm navigation renders on all pages
curl -I http://localhost:18004/
curl -I http://localhost:18004/inventory
curl -I http://localhost:18004/cases

# Run safety validation
cd next-app && npm run validate:db-readonly
```

---

## PostgreSQL Read-Only Data Foundation

### What Was Added

This transformation adds a safe, read-only PostgreSQL database access foundation to the Next.js application:

- **Server-only connection utility** (`lib/db.js`) — Singleton pg Pool with environment-based configuration and a parameterized `query()` helper. Guarded with `import 'server-only'` to prevent client-side bundling.
- **Read-only query helpers** (`lib/db-read-queries.js`) — Configurable table allowlist, `validateTableName()`, `fetchAllFromTable()`, and `fetchById()` utilities.
- **API route handlers**:
  - `GET /api/db-health` — Database connectivity health check
  - `GET /api/parts` — Query parts catalog (read-only)
  - `GET /api/stock` — Query inventory with parts catalog join (read-only)
- **Environment configuration** (`.env.local.example`) — PostgreSQL variable placeholders
- **Safety validation script** (`scripts/validate-db-readonly.js`) — Automated checks for write operations, client-side imports, TypeScript artifacts, and auth boundary violations

### How to Configure

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Set your database connection. **Preferred:** use a full connection string:
   ```
   DATABASE_URL=postgresql://your_user:your_password@your_host:5432/your_database
   ```

   **Alternative:** set individual variables if a connection string is not available:
   ```
   DB_HOST=your_host
   DB_PORT=5432
   DB_NAME=your_database
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_SSL=false
   ```

3. The connection utility resolves credentials in this priority order:
   - `DATABASE_URL` (full connection string)
   - `DB_URL` (alias for DATABASE_URL)
   - Individual `DB_*` variables (fallback)

### Table Mappings

The `DB_ALLOWED_TABLES` environment variable controls which tables can be queried. It defaults to:

```
DB_ALLOWED_TABLES=parts_catalog,inventory,cm_cases,cm_case_workflow_rma,cm_case_notes,cm_case_requirements,users,teams
```

Additional tables can be added as a comma-separated list if needed. Only tables in this allowlist can be queried through the helper functions.

### How to Validate

Run the safety validation script to check for accidental write queries, client-side imports of server modules, TypeScript artifacts, and auth boundary violations:

```bash
npm run validate:db-readonly
```

This script verifies:
- No prohibited SQL write keywords (INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE) in db/route files
- No client-side files import server-only database modules
- No TypeScript files exist outside node_modules
- No @types packages in package.json
- No modifications to lib/auth/ files
- server-only imported only from server-side files
- No process.env values exposed in API responses

### Read-Only Constraint

This foundation intentionally supports **only SELECT queries**. No INSERT, UPDATE, DELETE, ALTER, DROP, or TRUNCATE operations are permitted in any generated file. Write operations require a separate, deliberate implementation with appropriate review and approval.

### Authentication Note

> **The current authentication implementation is temporary.** It will be replaced by Cisco Duo MFA in a future phase. Do not expand, migrate, or heavily invest in the existing auth stack. Treat auth boundaries as-is and use them where they exist.

The `/api/parts` and `/api/stock` routes use the existing `requireAuth()` helper to gate access. The `/api/db-health` route is unauthenticated for monitoring purposes.

### API Routes

#### `GET /api/db-health`

Database connectivity health check. Executes `SELECT 1` to verify the connection.

**Response (success):**
```json
{ "status": "ok" }
```

**Response (failure — 503):**
```json
{ "status": "error" }
```

No database credentials or connection details are exposed in error responses.

---

#### `GET /api/parts`

Query the `parts_catalog` table for active parts. Requires authentication.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string (optional) | Filter by part_no or description (case-insensitive partial match) |

**Response (success):**
```json
{
  "data": [
    { "part_no": "ABC-123", "description": "Widget Assembly", "active": 1 }
  ]
}
```

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

---

#### `GET /api/stock`

Query inventory levels joined with parts catalog. Returns only active parts. Requires authentication.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string (optional) | Filter by part_no or description (case-insensitive partial match) |

**Response (success):**
```json
{
  "data": [
    {
      "part_no": "ABC-123",
      "description": "Widget Assembly",
      "qty_on_hand": 50,
      "location": "Warehouse A",
      "active": 1
    }
  ]
}
```

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

---

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Preferred | Full PostgreSQL connection string | — |
| `DB_URL` | Fallback | Alias for DATABASE_URL | — |
| `DB_HOST` | Fallback | Database host | — |
| `DB_PORT` | Fallback | Database port | `5432` |
| `DB_NAME` | Fallback | Database name | — |
| `DB_USER` | Fallback | Database user | — |
| `DB_PASSWORD` | Fallback | Database password | — |
| `DB_SSL` | Optional | Enable SSL (`true`/`false`) | `false` |
| `DB_ALLOWED_TABLES` | Optional | Comma-separated table allowlist | `parts_catalog,inventory,cm_cases,cm_case_workflow_rma,cm_case_notes,cm_case_requirements,users,teams` |


---

## Read-Only Inventory UI

### Overview

The `/inventory` route provides an authenticated, browser-based read-only view of the parts catalog and stock levels. It consumes the existing `/api/db-health`, `/api/parts`, and `/api/stock` API routes.

### Authentication

Requires authentication via `requireAuth()`. In development with `AUTH_PROVIDER=mock` (the default), the mock user always resolves automatically — no login is required.

### Read-Only Constraint

This page displays data only. No database writes, mutations, or editing capabilities are exposed. All data fetching uses GET requests to the existing read-only API routes.

### Files Added

| File | Purpose |
|------|---------|
| `app/inventory/page.jsx` | Server component with auth gate and page shell |
| `app/inventory/inventory-client.jsx` | Client component with data fetching, search, and table rendering |
| `app/inventory/inventory.module.css` | Inventory-specific styles |

### Features

- **Database health indicator** — colored dot showing connectivity status (green = connected, red = disconnected)
- **Search filtering** — text input that filters both parts and stock tables via the `?search=` API parameter
- **Parts Catalog table** — displays part number, description, and active status
- **Stock Levels table** — displays part number, description, quantity on hand, and location
- **Loading/error/empty states** — graceful handling of all data states

### Validation Steps

```bash
# Confirm valid Next.js components
npm run build

# Confirm no write operations, no TypeScript, no auth violations
npm run validate:db-readonly

# Start development server
npm run dev -- -H 0.0.0.0 -p 3001

# Navigate to the inventory page
# http://localhost:3001/inventory
```

Verify:
- Tables load with data from `parts_catalog` and `inventory`
- Search filtering works via the `?search=` parameter
- Database health indicator shows green "Connected" status

### Note

> The page requires authentication. In development with `AUTH_PROVIDER=mock`, the mock provider auto-resolves with a development user. In production (future), unauthenticated users will be redirected to Cisco Duo MFA.


---

## Read-Only Cases UI

### Overview

The `/cases` route provides an authenticated, browser-based read-only view of case management data from the `cm_cases` table. It consumes the `/api/cases` API route.

### Authentication

Requires authentication via `requireAuth()`. In development with `AUTH_PROVIDER=mock` (the default), the mock user always resolves automatically — no login is required.

### Read-Only Constraint

This page displays data only. No database writes, mutations, or editing capabilities are exposed. All data fetching uses GET requests to the read-only `/api/cases` endpoint.

### Files Added

| File | Purpose |
|------|---------|
| `app/cases/page.jsx` | Server component with auth gate and page shell |
| `app/cases/cases-client.jsx` | Client component with data fetching, search, and table rendering |
| `app/cases/cases.module.css` | Cases-specific styles |
| `app/api/cases/route.js` | GET endpoint querying cm_cases with optional search filtering |

### API Endpoint: `GET /api/cases`

Query the `cm_cases` table for case records. Requires authentication.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string (optional) | Filter by case_number, title, or customer_name (case-insensitive partial match via ILIKE) |

**Response (success — 200):**
```json
{
  "data": [
    {
      "id": 1,
      "case_number": "CS-2026-001",
      "title": "Network connectivity issue",
      "customer_name": "Acme Corp",
      "workflow_key": "standard",
      "stage": "investigation",
      "status": "open",
      "priority": "high",
      "last_activity_at": "2026-05-07T12:00:00.000Z"
    }
  ]
}
```

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

**Response (server error — 500):**
```json
{ "error": "Unable to retrieve cases data" }
```

No database credentials, raw SQL errors, table names, or internal details are exposed in error responses.

### Table Columns Displayed

| Column | Source Field |
|--------|-------------|
| Case Number | `case_number` |
| Title | `title` |
| Customer | `customer_name` |
| Workflow | `workflow_key` |
| Stage | `stage` |
| Status | `status` |
| Priority | `priority` |
| Last Activity | `last_activity_at` (formatted as locale date string) |

### Validation Steps

```bash
# 1. Validate docker-compose configuration
docker compose -p eusupport_dev -f docker-compose.dev.yml config

# 2. Build and start development environment
docker compose -p eusupport_dev -f docker-compose.dev.yml up -d --build

# 3. Confirm containers are running
docker compose -p eusupport_dev -f docker-compose.dev.yml ps

# 4. Health checks
curl http://localhost:18004/api/health
curl http://localhost:18004/api/db-health

# 5. Test cases API endpoint
curl http://localhost:18004/api/cases

# 6. Confirm cases page is accessible
curl -I http://localhost:18004/cases

# 7. Run safety validation (from next-app/)
npm run validate:db-readonly
```

### Note

> The page requires authentication. In development with `AUTH_PROVIDER=mock`, the mock provider auto-resolves with a development user. In production (future), unauthenticated users will be redirected to Cisco Duo MFA.


---

## Read-Only Case Detail

### Overview

The `/cases/[id]` route provides an authenticated, browser-based read-only view of a single case record from the `cm_cases` table. It consumes the `/api/cases/[id]` API route. The cases list page (`/cases`) links each case number to this detail page for navigation.

### Authentication

Requires authentication via `requireAuth()`. In development with `AUTH_PROVIDER=mock` (the default), the mock user always resolves automatically — no login is required.

### Read-Only Constraint

This page displays data only. No database writes, mutations, workflow actions, or editing capabilities are exposed. All data fetching uses GET requests to the read-only `/api/cases/[id]` endpoint. A "Read-Only" badge is prominently displayed on the detail page.

### Files Added

| File | Purpose |
|------|---------|
| `app/cases/[id]/page.jsx` | Server component with auth gate and page shell |
| `app/cases/[id]/case-detail-client.jsx` | Client component with data fetching, loading/error/not-found states, and field rendering |
| `app/cases/[id]/case-detail.module.css` | Case detail-specific styles |
| `app/api/cases/[id]/route.js` | GET endpoint querying cm_cases by id with parameterized SQL |

### Files Modified

| File | Change |
|------|--------|
| `app/cases/cases-client.jsx` | Added Link import and wrapped case_number cells with links to `/cases/[id]` |

### API Endpoint: `GET /api/cases/[id]`

Retrieve a single case record by ID from the `cm_cases` table. Requires authentication.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The unique identifier of the case |

**Response (success — 200):**
```json
{
  "data": {
    "id": "5622a648-ab5f-4983-a706-2f3f6f9cdf62",
    "case_number": "CS-2026-001",
    "title": "Network connectivity issue",
    "description": "User reports intermittent network drops",
    "customer_name": "Acme Corp",
    "requester_name": "Jane Doe",
    "requester_email": "jane.doe@example.com",
    "requester_phone": "555-0100",
    "request_source": "email",
    "workflow_key": "standard",
    "stage": "investigation",
    "status": "open",
    "priority": "high",
    "last_activity_at": "2026-05-07T12:00:00.000Z",
    "created_at": "2026-05-01T09:00:00.000Z",
    "updated_at": "2026-05-07T12:00:00.000Z",
    "closed_at": null,
    "facility": "Building A",
    "poc_name": "John Smith",
    "poc_email": "john.smith@example.com",
    "poc_phone": "555-0200"
  }
}
```

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

**Response (not found — 404):**
```json
{ "error": "Case not found" }
```

**Response (server error — 500):**
```json
{ "error": "Unable to retrieve case data" }
```

No database credentials, raw SQL errors, table names, or internal details are exposed in error responses.

### Columns Displayed on Detail Page

| Field Label | Source Column |
|-------------|--------------|
| Case Number | `case_number` |
| Title | `title` |
| Description | `description` |
| Customer Name | `customer_name` |
| Requester Name | `requester_name` |
| Requester Email | `requester_email` |
| Requester Phone | `requester_phone` |
| Request Source | `request_source` |
| Workflow | `workflow_key` |
| Stage | `stage` |
| Status | `status` |
| Priority | `priority` |
| Facility | `facility` |
| POC Name | `poc_name` |
| POC Email | `poc_email` |
| POC Phone | `poc_phone` |
| Last Activity | `last_activity_at` (formatted as locale date string) |
| Created At | `created_at` (formatted as locale date string) |
| Updated At | `updated_at` (formatted as locale date string) |
| Closed At | `closed_at` (formatted as locale date string) |

### UI States

- **Loading** — spinner/message while data is fetching
- **Error** — generic error message if the API returns a non-404 error
- **Not Found** — distinct message when the case ID does not exist (404 response)
- **Success** — structured field layout with all case data displayed

### Validation Steps

```bash
# 1. Validate docker-compose configuration
docker compose -p eusupport_dev -f docker-compose.dev.yml config

# 2. Build and start development environment
docker compose -p eusupport_dev -f docker-compose.dev.yml up -d --build

# 3. Confirm containers are running
docker compose -p eusupport_dev -f docker-compose.dev.yml ps

# 4. Health checks
curl http://localhost:18004/api/health
curl http://localhost:18004/api/db-health

# 5. Test cases list API endpoint
curl http://localhost:18004/api/cases

# 6. Test case detail API endpoint
curl http://localhost:18004/api/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62

# 7. Confirm cases list page is accessible
curl -I http://localhost:18004/cases

# 8. Confirm case detail page is accessible
curl -I http://localhost:18004/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62

# 9. Run safety validation (from next-app/)
cd next-app && npm run validate:db-readonly
```

### Note

> The page requires authentication. In development with `AUTH_PROVIDER=mock`, the mock provider auto-resolves with a development user. In production (future), unauthenticated users will be redirected to Cisco Duo MFA.



---

## Read-Only Case Related Data

### Overview

The `/api/cases/[id]/related` endpoint provides read-only access to related case data including RMA (Return Merchandise Authorization) details, case notes/activity timeline, and case requirements. This data supplements the core case detail view at `/cases/[id]`.

All queries are read-only SELECT operations using parameterized SQL. No write operations are introduced by this feature.

### API Endpoint: `GET /api/cases/[id]/related`

Retrieve related data for a case by ID. Queries three additional tables: `cm_case_workflow_rma`, `cm_case_notes`, and `cm_case_requirements`. Requires authentication.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The unique identifier of the parent case |

**Response (success — 200):**
```json
{
  "data": {
    "rma": {
      "manufacturer": "Cisco",
      "product_id": "WS-C3850-48T",
      "serial_number": "FCW1234ABCD",
      "mac_address": "00:1A:2B:3C:4D:5E",
      "issue_description": "Port failure on interface Gi1/0/1",
      "rma_status": "Approved",
      "rma_number": "RMA-2026-001",
      "entitlement_status": "Active",
      "vendor_sr_number": "SR-12345",
      "replacement_ship_to": "123 Main St, Building A",
      "inbound_tracking": "1Z999AA10123456784",
      "outbound_tracking": "1Z999AA10123456785",
      "inbound_shipping_carrier": "UPS",
      "outbound_shipping_carrier": "UPS"
    },
    "notes": [
      {
        "id": "d2527c98-4ed6-42df-a5e1-4bdfcd1ef540",
        "note_type": "SystemEvent",
        "body": "Case created.",
        "created_at": "2026-05-04T22:08:37.126Z"
      },
      {
        "id": "c585e951-4f13-4b43-9889-627b76981117",
        "note_type": "InformationCollection",
        "body": "Customer provided serial number and MAC address.",
        "created_at": "2026-05-04T22:10:00.000Z"
      }
    ],
    "requirements": [
      {
        "id": "64c0b302-ac41-4f8c-8239-4c6432e1013f",
        "key": "issue_description",
        "label": "Issue Description",
        "is_required": 1,
        "is_present": 1
      },
      {
        "id": "1ab466bb-433d-4714-a67c-8999c0bd2ae6",
        "key": "mac_address",
        "label": "MAC Address",
        "is_required": 0,
        "is_present": 0
      }
    ]
  }
}
```

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

**Response (not found — 404):**
```json
{ "error": "Case not found" }
```

**Response (server error — 500):**
```json
{ "error": "Unable to retrieve related case data" }
```

No database credentials, raw SQL errors, table names, or internal details are exposed in error responses.

### Tables Queried

| Table | Description | Key Fields |
|-------|-------------|------------|
| `cm_case_workflow_rma` | RMA/warranty replacement data | case_id (FK to cm_cases.id) |
| `cm_case_notes` | Case notes, activity, and timeline events | case_id (indexed), note_type, body, created_at |
| `cm_case_requirements` | Case data requirements checklist | case_id (indexed), key, label, is_required, is_present |

### UI Panels

The case detail page (`/cases/[id]`) renders four additional read-only panels below the core case data:

| Panel | Description |
|-------|-------------|
| **RMA Details** | Grid display of RMA/warranty fields. Shows "No RMA data" if null. |
| **Activity / Timeline** | Entries with note_type in `['SystemEvent', 'Field Update']`, reverse-chronological. Shows "No activity records" if empty. |
| **Notes** | All remaining note_type entries (e.g., InformationCollection, VendorCommunication, CustomerUpdate, Cancellation), reverse-chronological. Shows "No notes" if empty. |
| **Requirements** | Checklist of data requirements with present/not-present indicators. Shows "No requirements" if empty. |

All panels display a **"Read-Only"** badge in the panel header. Each panel handles loading, error, empty, and populated states gracefully.

### Note Type Grouping

The `note_type` grouping is performed **exclusively on the client side** in `case-detail-client.jsx`. The API route returns all notes with their `note_type` value as-is without filtering or hardcoding note_type values. This design avoids false positives from the `validate:db-readonly` script which scans API route files for prohibited write keywords.

### Validation Steps

```bash
# 1. Validate docker-compose configuration
docker compose -p eusupport_dev -f docker-compose.dev.yml config

# 2. Build and start development environment
docker compose -p eusupport_dev -f docker-compose.dev.yml up -d --build

# 3. Confirm containers are running
docker compose -p eusupport_dev -f docker-compose.dev.yml ps

# 4. Health checks
curl http://localhost:18004/api/health
curl http://localhost:18004/api/db-health

# 5. Test cases API endpoint (existing)
curl http://localhost:18004/api/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62

# 6. Test related data endpoint
curl http://localhost:18004/api/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62/related

# 7. Test 404 for non-existent case
curl http://localhost:18004/api/cases/nonexistent-id/related

# 8. Confirm case detail page is accessible
curl -I http://localhost:18004/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62

# 9. Run safety validation (from next-app/)
cd next-app && npm run validate:db-readonly
```

### Note

> The page and API require authentication. In development with `AUTH_PROVIDER=mock`, the mock provider auto-resolves with a development user. In production (future), unauthenticated users will be redirected to Cisco Duo MFA.


---

## Reference Data API (Users & Teams)

### Overview

Read-only reference data endpoints expose user and team lookup data for resolving assigned user/team IDs in case views into human-readable names. All endpoints are **GET-only** and **read-only** — no write operations or mutation methods (POST, PUT, PATCH, DELETE) are exposed.

### Authentication

All reference data endpoints require authentication via `requireAuth()`. In development with `AUTH_PROVIDER=mock`, the mock user always resolves automatically.

### Endpoints

#### `GET /api/reference/users`

Returns all active users with safe reference fields only. No sensitive fields (email, role, password hashes, auth secrets, MFA fields, tokens) are exposed.

**Response (success — 200):**
```json
{
  "data": [
    { "id": 1, "upn": "Savitha", "display_name": "Savitha Ramakrishnan" },
    { "id": 2, "upn": "Brandon", "display_name": "Brandon McMillan" }
  ]
}
```

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

**Response (server error — 500):**
```json
{ "error": "Unable to retrieve user reference data" }
```

---

#### `GET /api/reference/teams`

Returns all enabled teams with safe reference fields only.

**Response (success — 200):**
```json
{
  "data": [
    { "id": 2340, "key": "parts_administrators", "label": "Parts Administrators" },
    { "id": 2341, "key": "rma_administrators", "label": "RMA Administrators" }
  ]
}
```

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

**Response (server error — 500):**
```json
{ "error": "Unable to retrieve team reference data" }
```

---

#### `GET /api/reference/lookups`

Consolidated endpoint returning both users and teams in a single response. Uses `Promise.allSettled` to return partial data if one source fails.

**Response (success — 200):**
```json
{
  "data": {
    "users": [
      { "id": 1, "upn": "Savitha", "display_name": "Savitha Ramakrishnan" }
    ],
    "teams": [
      { "id": 2340, "key": "parts_administrators", "label": "Parts Administrators" }
    ]
  },
  "meta": {
    "users": "ok",
    "teams": "ok"
  }
}
```

If one dataset fails, its value will be `null` and the corresponding meta field will show `"unavailable"`.

**Response (unauthenticated — 401):**
```json
{ "error": "Authentication required" }
```

**Response (complete failure — 500):**
```json
{ "error": "Unable to retrieve reference data" }
```

---

### Integration with Case Views

The `/cases` list page and `/cases/[id]` detail page fetch reference data from `/api/reference/lookups` to resolve:

| Case Field | Resolved To |
|------------|-------------|
| `assigned_to_user_id` | User display name (column: "Assigned To") |
| `created_by_user_id` | User display name (column: "Created By") |
| `owning_team_id` | Team label (column: "Team" / "Owning Team") |

If reference data fails to load, the UI gracefully degrades to showing raw IDs.

### Files Added

| File | Purpose |
|------|---------|
| `lib/db-reference-queries.js` | Read-only query functions for users and teams tables |
| `app/api/reference/users/route.js` | GET-only users reference endpoint |
| `app/api/reference/teams/route.js` | GET-only teams reference endpoint |
| `app/api/reference/lookups/route.js` | GET-only consolidated lookups endpoint |

### Files Modified

| File | Change |
|------|--------|
| `docker-compose.dev.yml` | Added `users,teams` to `DB_ALLOWED_TABLES` |
| `.env.local.example` | Added `users,teams` to `DB_ALLOWED_TABLES` |
| `app/api/cases/route.js` | Added `owning_team_id`, `assigned_to_user_id`, `created_by_user_id` to SELECT |
| `app/api/cases/[id]/route.js` | Added `owning_team_id`, `assigned_to_user_id`, `created_by_user_id` to SELECT |
| `app/cases/cases-client.jsx` | Enhanced with reference data resolution (Assigned To, Team columns) |
| `app/cases/[id]/case-detail-client.jsx` | Enhanced with reference data resolution (Assigned To, Created By, Owning Team fields) |

### Validation Steps

```bash
# 1. Validate docker-compose configuration
docker compose -p eusupport_dev -f docker-compose.dev.yml config

# 2. Build and start development environment
docker compose -p eusupport_dev -f docker-compose.dev.yml up -d --build

# 3. Confirm containers are running
docker compose -p eusupport_dev -f docker-compose.dev.yml ps

# 4. Health checks
curl http://localhost:18004/api/health
curl http://localhost:18004/api/db-health

# 5. Test reference data endpoints
curl http://localhost:18004/api/reference/users
curl http://localhost:18004/api/reference/teams
curl http://localhost:18004/api/reference/lookups

# 6. Verify existing case endpoints still work
curl http://localhost:18004/api/cases
curl http://localhost:18004/api/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62

# 7. Verify pages load
curl -I http://localhost:18004/cases
curl -I http://localhost:18004/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62

# 8. Run safety validation (from next-app/)
cd next-app && npm run validate:db-readonly
```

### Security Notes

- No password hashes, auth secrets, MFA fields, tokens, or credential-related columns are exposed
- No raw SQL errors or internal database details are exposed in error responses
- The `auth_users`, `auth_mfa_codes`, and `auth_user_requests` tables are NOT exposed
- Only `users` table fields `id`, `upn`, `display_name` are returned (excludes `email`, `role`, `created_at`, `teams`)
- Only `teams` table fields `id`, `key`, `label` are returned (excludes `description`, `created_at`, `updated_at`)
- All endpoints are GET-only — no POST, PUT, PATCH, or DELETE handlers exist

### Note

> All reference data endpoints require authentication. In development with `AUTH_PROVIDER=mock`, the mock provider auto-resolves with a development user. In production (future), unauthenticated users will be redirected to Cisco Duo MFA.



---

## Write Safety Foundation

### Overview

A reusable safety foundation for future write operations (POST, PUT, PATCH, DELETE) has been added to the codebase. This module provides guardrail functions that every future write route must call before performing any mutation. **All write operations are disabled by default.**

> **⚠️ Important:** NO real write endpoints, database mutations, or workflow implementations are included in this foundation. It is preparation-only infrastructure that will be consumed by future write route implementations.

### Helper Functions

All helpers are located in `lib/write-safety/` and can be imported as:

```javascript
import {
  requireWriteEnabled,
  assertAllowedMethod,
  requireWritePermission,
  sanitizeWriteError,
  createAuditContext,
} from '@/lib/write-safety';
```

| Function | Purpose |
|----------|---------|
| `getWriteSafetyStatus()` | Returns `{ enabled, reason }` object — safe for API responses |
| `assertWritesEnabled()` | Throws an error if writes are disabled (for server-side logic) |
| `requireWriteEnabled()` | Checks `WRITES_ENABLED` env var; returns 403 response if writes are disabled |
| `assertAllowedMethod(req, allowedMethods)` | Validates HTTP method against a whitelist; returns 405 if not allowed |
| `requireWritePermission(req)` | Verifies authentication and write-capable role (admin, manager, technician) |
| `sanitizeWriteError(error)` | Strips sensitive internal details from errors before returning to client |
| `createAuditContext(req)` | Builds an audit context object (user, timestamp, action, resource) for future logging |

### Composition Pattern for Future Write Routes

Future write routes should compose the helpers in this order:

```javascript
import { NextResponse } from 'next/server';
import {
  requireWriteEnabled,
  assertAllowedMethod,
  requireWritePermission,
  sanitizeWriteError,
  createAuditContext,
} from '@/lib/write-safety';

export async function POST(req) {
  // 1. Global write gate
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  // 2. Method validation
  const methodCheck = assertAllowedMethod(req, ['POST']);
  if (methodCheck) return methodCheck;

  // 3. Authentication + write permission
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  // 4. Audit context
  const audit = await createAuditContext(req);

  try {
    // 5. Business logic (future implementation)
    // ...

    return NextResponse.json({ success: true });
  } catch (error) {
    // 6. Sanitize error for client
    return sanitizeWriteError(error);
  }
}
```

### Environment Configuration

| Variable | Side | Default | Purpose |
|----------|------|---------|---------|
| `WRITES_ENABLED` | Server | `false` | Authoritative gate — blocks all write API requests when disabled |
| `NEXT_PUBLIC_WRITES_ENABLED` | Client | `false` | UI display flag — shows read-only notice when disabled |

Both flags default to `false`. The server-side `WRITES_ENABLED` is the authoritative enforcement mechanism. The client flag controls only UI display.

### WriteDisabledNotice Component

A client-side component at `app/components/WriteDisabledNotice.jsx` displays a read-only mode banner when `NEXT_PUBLIC_WRITES_ENABLED` is not `'true'`. It can be conditionally included on any page:

```javascript
import WriteDisabledNotice from '@/app/components/WriteDisabledNotice';

export default function SomePage() {
  return (
    <div>
      <WriteDisabledNotice />
      {/* page content */}
    </div>
  );
}
```

### Write Safety Status Endpoint

```
GET /api/write-safety/status
```

Returns the current write-safety status. No authentication required. No secrets or env values are exposed.

**Response:**
```json
{
  "writesEnabled": false,
  "reason": "Write operations are disabled (default). Set WRITES_ENABLED=true to enable.",
  "timestamp": "2026-05-07T23:30:00.000Z"
}
```

### Enabling Writes Safely (Future)

To enable write operations when ready:

1. Set `WRITES_ENABLED=true` in the server environment
2. Set `NEXT_PUBLIC_WRITES_ENABLED=true` for the client UI
3. Implement write route handlers using the composition pattern above
4. Test thoroughly in a non-production environment
5. Deploy with monitoring — revert by setting flags back to `false` if issues arise

### Read-Only Constraint

This foundation does NOT include:
- Any POST, PUT, PATCH, or DELETE route handlers
- Any INSERT, UPDATE, DELETE, ALTER, DROP, or TRUNCATE SQL statements
- Any database mutation logic or workflow implementations
- Any modifications to existing read-only endpoints or the `lib/auth/` directory

For full documentation, see `lib/write-safety/README.md`.
