# EUS Support — Project Context

> Internal End User Support system for inventory, logistics, and case management.
> Last updated: 2026-05-02

---

## Project Overview

EUS Support is an internal web application used by a support organization to manage spare parts inventory, logistics work order processing, and RMA (Return Merchandise Authorization) case workflows. It runs as a containerized monolith on a private network at `EUSupport.netsync.com` (10.214.30.244).

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Caddy 2   │────▶│  FastAPI/Uvicorn  │────▶│ PostgreSQL 16│
│  (port 443) │     │   (port 8000)    │     │  (port 5432) │
│  TLS + CSP  │     │   Python 3.11    │     │    Alpine    │
└─────────────┘     └──────────────────┘     └──────────────┘
```

- **3 Docker containers** via `docker-compose.inventory-prod.yml`
- Caddy handles TLS termination (manual certs), security headers, gzip/zstd
- FastAPI serves both API and static frontend at `/ui/` and `/static/`
- PostgreSQL 16 with persistent volume (migrated from SQLite)

---

## Key Files and Folders

```
eusupport/
├── .env                              # Environment config (secrets — do not print values)
├── .gitignore                        # Protects .env, certs, DB files, caches
├── docker-compose.inventory-prod.yml # Container orchestration (3 services)
├── Caddyfile                         # Reverse proxy + TLS + security headers
├── caddy-certs/                      # Manual TLS cert + key
├── backups/                          # Database dump files
├── index.html                        # Root smoke-test page (not the app)
└── dev/
    ├── Dockerfile                    # Python 3.11-slim, non-root user
    ├── requirements.txt              # Pinned deps: fastapi, sqlalchemy, asyncpg, openpyxl, etc.
    └── app/
        ├── main.py              (98KB)  # FastAPI app, inventory/checkout/admin routes
        ├── case_management.py   (194KB) # RMA case lifecycle, reminders, catalogs
        ├── workbook_modules.py  (129KB) # Logistics workbook upload/update/download cycle
        ├── auth.py              (26KB)  # JWT auth, MFA, rate limiting, roles
        ├── db_core.py           (3KB)   # SQLAlchemy async engine, schema introspection
        ├── permissions.py       (1KB)   # Team-based permission checks
        ├── permission_rules.py  (1KB)   # Pure-logic permission rules (no DB)
        ├── teams.py             (6KB)   # Team management routes
        ├── team_db.py           (12KB)  # Team DB operations (async)
        ├── migrate_*.py                 # Idempotent schema migrations (15+ files)
        ├── test_*.py                    # Unit tests (10 files, unittest framework)
        ├── tools/                       # generate_logistics_test_workbook + archived SQLite scripts
        ├── static/
        │   ├── index.html       (89KB)  # SPA HTML — all 13 tab panels
        │   ├── app.js           (384KB) # Vanilla JS — all frontend logic (~9200 lines)
        │   ├── assets/                  # Logo, favicon, grain texture
        │   └── processFlows/            # JSON flow definitions + screenshots
        └── process-flows/               # React/xyflow sub-app (builds to static/process-flows.bundle.js)
```

---

## Module Map

### 13 UI Tabs

| Tab | Backend File | Purpose | Team Access |
|-----|-------------|---------|-------------|
| **Issue** | `main.py` | Check out parts → cart → commit | Parts Administrators |
| **Check In** | `main.py` | Receive/return parts | Parts Administrators |
| **Inventory** | `main.py` | Stock dashboard, search, CSV export | Parts Administrators |
| **Ledger** | `main.py` | Audit trail of all inventory changes | Supervisor/Manager + Parts Admins |
| **Notifications** | `main.py` | Pending approval requests | Supervisor/Manager only |
| **Reminders** | `case_management.py` | Due reminders for assigned cases | RMA/Internal Support/Computer/Intake |
| **Case Management** | `case_management.py` | Full RMA case lifecycle | RMA/Internal Support/Computer/Intake |
| **Route Coordination** | `workbook_modules.py` | Upload logistics workbook (.xlsx) | Route Coordinators |
| **Logistics** | `workbook_modules.py` | Technician sub-status updates | Logistics Technicians |
| **Logistics Log** | `workbook_modules.py` | Activity history (append-only) | Logistics Techs + Supervisor/Manager |
| **Data Management** | `workbook_modules.py` | Download compiled workbook | Reporting Administrators |
| **Operations Runbook** | `main.py` + React bundle | Process flow diagrams | All authenticated users |
| **Admin** | `main.py` | Users, inventory wipe, CSV import, catalogs | Manager role only |

---

## Auth / Permissions Model

### Roles (hierarchy: highest → lowest)
- **manager** — Full admin access (despite `admin_only` naming in code, this gates on `manager` role)
- **supervisor** — Notifications, ledger, review queues
- **admin** — System admin (legacy naming, below supervisor in operational hierarchy)
- **tech** — Standard technician
- **user** — Basic access

### Authentication
- JWT (HS256) via `python-jose`, 8-hour expiry
- Passwords: bcrypt via passlib
- Rate limiting: per-IP and per-username sliding window
- MFA: email-based 6-digit codes (password change only)
- Token in `localStorage`, injected via `apiFetch()` wrapper

### 11 Teams (control module visibility)
| Team Key | Grants Access To |
|----------|-----------------|
| `parts_administrators` | issue, checkin, inventory, ledger |
| `rma_administrators` | case-management, reminders, process-flows |
| `internal_support_technicians` | case-management, reminders, process-flows |
| `computer_technicians` | case-management, reminders, process-flows |
| `intake_administrators` | case-management, reminders |
| `route_coordinators` | route-coordination |
| `logistics_technicians` | logistics, logistics-log |
| `reporting_administrators` | data-management |
| `order_administrators` | (no modules — directory only) |
| `quote_administrators` | (no modules — directory only) |
| `network_technicians` | (no modules — directory only) |

### Special Permission Teams
- **Intake Administrators** → can create cases/work orders
- **Parts Administrators** → can issue/checkout parts

---

## Logistics Workflow Summary

```
Route Coordinator                Logistics Technician              Reporting Admin
      │                                │                                │
      ▼                                │                                │
  Upload .xlsx ──────────────────▶ See assigned rows                    │
  (POST /api/route-coordination/    (matched by Owner                  │
   workbook)                        display_name)                      │
      │                                │                                │
      │                                ▼                                │
      │                          Update sub-statuses ──────────────────▶│
      │                          (POST /api/logistics/                  │
      │                           workbook/updates)                     │
      │                                │                                │
      │                          Can escalate rows                      │
      │                          Can "Notify RC"                        │
      │                          Can undo (rework)                      │
      │                          Can request correction                 │
      │                                │                                ▼
      │                                │                          Download compiled
      │                                │                          workbook (.xlsx)
      │                                │                          (GET /api/data-management/
      │                                │                           workbook/download)
      │                                │                                │
      │                                │                          Marks submissions
      │                                │                          as "downloaded"
```

### Key Rules
- Only **one active workbook** at a time (keyed by `test_bulk_wo_update`)
- Each upload increments `cycle_version` and resets cycle data
- Rows matched to technicians by `Owner` column ↔ `display_name` (case-insensitive)
- Only "Ready for Pickup" and "Ready for Delivery" rows are editable
- Sub-status options: Pick up Successful, Pick Up Failed, Device Not On Pickup List, Delivery Successful, Delivery Unsuccessful
- "Device Not On Pickup List" and "Delivery Unsuccessful" are **omitted** from compiled download
- Pickup Scheduled Attempts ≥ 2 triggers `notify_rc_required_for_pickup_failure`
- Submission states: `submitted → downloaded → rework_in_progress | correction_requested`

### Logistics Log Events
- Sub-Status Update Submitted, Escalation Submitted, Notify RC Submitted, Correction Request Submitted, Undo Request Submitted

---

## Database Notes

### Engine
- **Production**: PostgreSQL 16 (via `asyncpg`)
- **Legacy/Tests**: SQLite (via `aiosqlite`)
- **ORM**: None — all queries use raw SQL via `sqlalchemy.text()`
- **Connection**: `create_async_engine` + `async_sessionmaker` from `db_core.py`

### ~40 Tables (key prefixes)
- **Core**: `users`, `auth_users`, `auth_mfa_codes`, `teams`, `user_teams`
- **Inventory**: `stock`, `inventory`, `parts_catalog`, `inventory_add_requests`
- **Transactions**: `ledger`, `transactions`, `checkout_cart`, `checkout_cart_lines`, `work_orders`
- **Case Management** (`cm_*`): `cm_cases`, `cm_case_notes`, `cm_case_requirements`, `cm_case_reminders`, `cm_case_workflow_rma`, `cm_workflows`, `cm_message_templates`, `cm_customer_catalog`, `cm_rma_manufacturers`
- **Workbook/Ops** (`ops_*`): `ops_active_workbooks`, `ops_workbook_source_rows`, `ops_workbook_merged_updates`, `ops_workbook_owner_submissions`, `ops_workbook_completed_rows`, `ops_workbook_logistics_submissions`, `ops_workbook_logistics_submission_rows`, `ops_workbook_submission_audit`, `ops_logistics_activity_log`, `ops_workbook_download_history`
- **Other**: `runbook_documents`, `session_log`, `idempotency`

### Migration Approach
- Every `migrate_*.py` is **idempotent** and runs on import (`_run_on_import()`)
- Dual-path: SQLite (`sqlite3`) and Postgres (`asyncpg`) branches in each file
- Uses `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- Fail-open: exceptions caught silently to avoid blocking app startup
- Schema-adaptive queries: `db_core.table_columns()` discovers columns at runtime

### Important Patterns
- `norm_id()` — uppercase + collapse spaces for part numbers
- `_resolve_user_id()` — lazy user provisioning (auto-creates on first encounter)
- `_begin_ctx()` — nested savepoint if already in transaction
- `_inventory_write_target()` — auto-detects table vs view for writes
- `_error_json()` — consistent `{error: {code, message, request_id}}` responses

---

## Safe Development Workflow

### Before Making Changes
1. **Read the relevant file(s)** before modifying — files are large monoliths
2. **Check `db_core.table_columns()`** usage — queries adapt to schema dynamically
3. **Understand team gating** — most routes check team membership, not just role
4. **Check migration files** — schema may have evolved; read the latest `migrate_*.py`

### Code Conventions
- **No ORM** — raw SQL via `sqlalchemy.text()` with `:param` binding
- **Async everywhere** — all route handlers and DB operations are `async def`
- **Pydantic models** for request/response validation (defined inline in module files)
- **Router pattern** — `case_management.py` and `workbook_modules.py` use `APIRouter`, included in `main.py`
- **Idempotent migrations** — new schema changes go in a new `migrate_*.py` file that runs on import
- **Frontend** — vanilla JS, no build step, no framework. DOM manipulation via `document.getElementById()` / `innerHTML`
- **CSS** — custom properties with 3 themes (dark, light, netsync). No CSS framework.
- **Error responses** — use `_error_json(status, code, message, request_id)` pattern

### What NOT to Do
- Don't use an ORM — the project uses raw SQL consistently
- Don't add a JS framework — the frontend is vanilla JS by design
- Don't modify migration files after they've run — create new ones
- Don't hardcode role checks — use `require_role()` dependency and team-based `permissions.py`
- Don't skip the dual SQLite/Postgres path in migrations

### Environment Variables (keys only — never print values)
- `JWT_SECRET`, `DB_URL` (constructed in docker-compose)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_TLS`, `SMTP_SSL`
- `INVENTORY_PG_DB`, `INVENTORY_PG_USER`, `INVENTORY_PG_PASSWORD`
- `INVENTORY_PUBLIC_BASE_URL`, `INVENTORY_ALLOWED_ORIGINS`
- `CADDY_CERT_MODE`, `CADDY_PUBLIC_HOSTNAME`, `CADDY_HTTPS_SITE_ADDRESS`

---

## Testing / Checklist Guidance

### Test Framework
- **Python `unittest`** (not pytest)
- Async tests via `unittest.IsolatedAsyncioTestCase`
- Run: `python -m unittest discover dev/app/` or `python -m unittest dev/app/test_<name>.py`

### Test Patterns
- Each test creates an **ephemeral SQLite database** (tempfile)
- Schema + seed data created with raw `sqlite3`, then migrations run
- **No HTTP client** — route handler functions called directly with constructed args
- User simulation: `auth.UserOut(username="...", role="...")` objects
- Permission testing: verify 403 for unauthorized, team-gated access, admin overrides
- Excel workbooks built in-memory with `openpyxl` for upload tests

### Test Coverage (10 test files)
| File | Covers |
|------|--------|
| `test_workbook_modules.py` | Logistics upload → submit → download cycle, team access |
| `test_case_management_rma.py` | RMA workflow, templates, email actions |
| `test_team_associations.py` | Team helpers, migration backfill, runbook filtering |
| `test_team_catalog.py` | Team seed idempotency, all 11 teams verified |
| `test_permissions_issue_vs_case.py` | Parts vs case permission separation |
| `test_intake_administrators.py` | Work order creation gating |
| `test_cart.py` | Cart creation, batch add, summary |
| `test_ledger_case_search.py` | Ledger prefix search |
| `test_checkout_commit.py` | Checkout commit, error handling |
| `test_jwt_expiration.py` | JWT TTL verification |

### Pre-Change Checklist
- [ ] Read the target file(s) and understand existing patterns
- [ ] Write or update tests for the change
- [ ] Run `python -m unittest discover dev/app/` — all tests pass
- [ ] New DB columns → new `migrate_*.py` file (idempotent, dual SQLite/Postgres)
- [ ] New routes → add `require_role()` or team check
- [ ] Frontend changes → test in all 3 themes (dark, light, netsync)
- [ ] No secrets in code or responses

---

## Risks and Observations

- **Monolith scale**: `main.py` (98KB), `case_management.py` (194KB), `workbook_modules.py` (129KB), `app.js` (384KB) are very large single files. Read carefully before editing.
### Role Gates (FastAPI dependency injection)
- `any_staff = require_role("admin", "supervisor", "manager")` — any staff member
- `supervisor_or_manager = require_role("supervisor", "manager")` — ledger, review queues
- `manager_only = require_role("manager")` — admin endpoints, inventory wipe, user management
- Both `main.py` and `case_management.py` define their own `manager_only`
- **Dual user tables**: `users` (business) and `auth_users` (credentials) must stay in sync. Password hashes are synced between them.
- **Legacy SQLite artifacts**: Old CLI tools archived to `tools/_archived_sqlite/` — do not use. `account_creation.py` rewritten to read credentials from env vars (no hardcoded secrets).
- **No build step for frontend**: `app.js` and `index.html` are edited directly. The only built artifact is `process-flows.bundle.js` (React/esbuild).
- **Fail-open migrations**: Migration errors are caught silently — check logs if schema changes don't take effect.
- **Frontend scripts**: `admin.js` and `setpw.js` were removed (duplicated app.js logic). All admin UI is now in `app.js` only.
