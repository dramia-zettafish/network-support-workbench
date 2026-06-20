# EUS Support — As-Built Document

**System:** EUS Support (End User Support)
**Generated:** 2026-05-04
**Host:** ns-daldb-eusupport (10.214.30.244)
**URL:** https://EUSupport.netsync.com (10.214.30.244:443)

---

## 1. Purpose

EUS Support is an internal web application for managing spare parts inventory, logistics work order processing, and RMA (Return Merchandise Authorization) case workflows. It serves a support organization's daily operations across multiple teams and roles.

---

## 2. Host Environment

| Attribute | Value |
|-----------|-------|
| Hostname | ns-daldb-eusupport |
| OS | Ubuntu 24.04.4 LTS (Noble Numbat) |
| Kernel | 6.8.0-106-generic (x86_64) |
| IP Address | 10.214.30.244/24 |
| RAM | 16 GB (10 GB available) |
| Disk | 48 GB LVM volume (34 GB used / 12 GB free — 75%) |
| Docker | 28.2.2 |
| Docker Compose | 2.37.1 |

---

## 3. Architecture

```
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Caddy 2        │────▶│  FastAPI / Uvicorn    │────▶│  PostgreSQL 16   │
│   (Alpine)       │     │  (Python 3.11)       │     │  (Alpine)        │
│   Port 443       │     │  Port 8000           │     │  Port 5432       │
│   TLS + Headers  │     │  App + Static Files  │     │  Persistent Vol  │
└──────────────────┘     └──────────────────────┘     └──────────────────┘
       ▲                          ▲
       │ HTTPS                    │ reverse_proxy
   End Users               localhost:18002
```

The system is a **containerized monolith** deployed via Docker Compose with three services. There is no external load balancer; Caddy terminates TLS directly on port 443.

---

## 4. Container Inventory

| Container | Image | Role | Ports | Status |
|-----------|-------|------|-------|--------|
| webstack-caddy | caddy:2-alpine | Reverse proxy, TLS termination, security headers, gzip/zstd | 0.0.0.0:443 → 443 | Up (4+ weeks) |
| webstack-api-pg | webstack-api:latest (custom) | FastAPI application server | 127.0.0.1:18002 → 8000 | Up (23 hours) |
| webstack-api-pg-db | postgres:16-alpine | Database | 5432 (internal only) | Up (40 hours, healthy) |

All containers are set to `restart: unless-stopped`.

### Docker Volumes

| Volume | Purpose |
|--------|---------|
| eusupport_api_pg_data | PostgreSQL data persistence |
| eusupport_caddy_data | Caddy TLS state |
| eusupport_caddy_config | Caddy configuration state |

### Compose File

`docker-compose.inventory-prod.yml` — orchestrates all three services.

---

## 5. Networking

| Path | Detail |
|------|--------|
| External → Caddy | 0.0.0.0:443 (HTTPS) |
| HTTP → HTTPS | Caddy redirects all HTTP to HTTPS (permanent) |
| Caddy → API | Docker internal network: `api_pg:8000` |
| API → Database | Docker internal network: `api_pg_db:5432` |
| API host bind | 127.0.0.1:18002 (loopback only, not externally exposed) |

### TLS

- **Mode:** Manual certificates (files in `caddy-certs/tls.crt` and `caddy-certs/tls.key`)
- Supports switchable auto-cert mode via `CADDY_CERT_MODE` env var

### Security Headers (Caddy)

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: restricts scripts, styles, fonts, frames, and form actions to `'self'` (with inline exceptions for styles/scripts)

---

## 6. Application Layer

### Runtime

| Component | Version |
|-----------|---------|
| Python | 3.11.15 |
| FastAPI | 0.115.0 |
| Uvicorn | 0.30.6 |
| SQLAlchemy | 2.0.32 (raw SQL only, no ORM) |
| asyncpg | 0.29.0 |
| openpyxl | 3.1.5 |
| passlib + bcrypt | 1.7.4 / 3.2.2 |
| python-jose | 3.3.0 |
| aiosqlite | 0.22.1 (test/legacy) |

### Container Build

- Base image: `python:3.11-slim`
- Non-root user: `app:app`
- Working directory: `/app`
- Entrypoint: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=*`

### Application Structure

The application is a **monolithic FastAPI app** with three large backend modules:

| File | Size | Responsibility |
|------|------|----------------|
| `main.py` | 98 KB | Core app, inventory, checkout, admin, ledger, notifications, runbook routes |
| `case_management.py` | 194 KB | RMA case lifecycle, reminders, catalogs, email templates (APIRouter) |
| `workbook_modules.py` | 131 KB | Logistics workbook upload/update/download cycle (APIRouter) |
| `auth.py` | 26 KB | JWT authentication, MFA, rate limiting, role enforcement |
| `db_core.py` | 3 KB | Async SQLAlchemy engine, schema introspection |
| `teams.py` | 6 KB | Team management routes |
| `team_db.py` | 12 KB | Team database operations |
| `permissions.py` | 1 KB | Team-based permission checks |
| `permission_rules.py` | 1 KB | Pure-logic permission rules |

### Frontend

| File | Size | Technology |
|------|------|------------|
| `static/index.html` | 89 KB | Single-page HTML with 13 tab panels |
| `static/app.js` | 384 KB | Vanilla JavaScript (~9,200 lines), no framework |
| `static/process-flows.bundle.js` | Built artifact | React/xyflow sub-app (only built component) |

- **No build step** for the main frontend — files are edited directly
- **3 CSS themes**: dark, light, netsync (custom properties, no CSS framework)
- Served by FastAPI at `/ui/` and `/static/`

---

## 7. Database

### Engine

| Attribute | Value |
|-----------|-------|
| RDBMS | PostgreSQL 16.13 (Alpine) |
| Driver | asyncpg (async) |
| Query style | Raw SQL via `sqlalchemy.text()` with `:param` binding |
| ORM | None |
| Schema management | 15 idempotent migration files (run on import) |

### Tables (41 total)

**Core / Auth (5)**
`users`, `auth_users`, `auth_user_requests`, `teams`, `user_teams`

**Inventory / Parts (6)**
`stock`, `inventory`, `parts`, `parts_catalog`, `parts_store`, `inventory_add_requests`

**Transactions / Checkout (6)**
`ledger`, `ledger_old`, `transactions`, `checkout_cart`, `checkout_cart_items`, `checkout_cart_lines`

**Work Orders (1)**
`work_orders`

**Case Management — `cm_*` (9)**
`cm_cases`, `cm_case_notes`, `cm_case_number_seq`, `cm_case_reminders`, `cm_case_requirements`, `cm_case_workflow_rma`, `cm_workflows`, `cm_customer_catalog`, `cm_message_templates`, `cm_rma_manufacturers`

**Logistics / Workbook — `ops_*` (11)**
`ops_active_workbooks`, `ops_workbook_source_rows`, `ops_workbook_merged_updates`, `ops_workbook_owner_submissions`, `ops_workbook_completed_rows`, `ops_workbook_logistics_submissions`, `ops_workbook_logistics_submission_rows`, `ops_workbook_submission_audit`, `ops_workbook_download_history`, `ops_logistics_activity_log`, `ops_shipping_carriers`

**Other (3)**
`runbook_documents`, `idempotency`

### Migration Files (15)

Migrations are idempotent Python scripts that run on import. Each supports dual SQLite/Postgres paths. They use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` patterns. Errors are caught silently (fail-open).

| Migration | Scope |
|-----------|-------|
| migrate_postgres.py | Initial Postgres schema |
| migrate_fix.py | Schema fixes |
| migrate_transactions.py | Transaction tables |
| migrate_checkout.py | Checkout flow |
| migrate_checkout_schema.py | Checkout schema refinements |
| migrate_inventory_triggers.py | Inventory triggers |
| migrate_inventory_view_fix.py | Inventory view corrections |
| migrate_ledger_rebuild.py | Ledger table rebuild |
| migrate_ledger_extras.py | Additional ledger columns |
| migrate_team_tables.py | Team/user_teams tables |
| migrate_team_associations.py | Team association data |
| migrate_return_session.py | Return session support |
| migrate_workbook_modules.py | Logistics/ops tables |
| migrate_case_management.py | Case management tables |
| migrate_shipping_carriers.py | Shipping carrier catalog |

### Backups

Stored in `backups/` directory. Two dump files present from 2026-05-01. A pre-cutover dump (`inventory-precutover.dump`) from the SQLite-to-Postgres migration is also retained at the project root.

---

## 8. Authentication & Authorization

### Authentication

| Mechanism | Detail |
|-----------|--------|
| Method | JWT (HS256), 8-hour expiry |
| Password hashing | bcrypt via passlib |
| MFA | Email-based 6-digit codes (password change only) |
| Rate limiting | Per-IP and per-username sliding window |
| Token storage | Client-side `localStorage`, injected via `apiFetch()` |

### Role Hierarchy (highest → lowest)

| Role | Access Level |
|------|-------------|
| manager | Full admin — user management, inventory wipe, CSV import, all modules |
| supervisor | Notifications, ledger, review queues |
| admin | System admin (legacy naming, below supervisor operationally) |
| tech | Standard technician |
| user | Basic access |

### Team-Based Access Control (11 Teams)

Teams control which UI tabs/modules a user can access:

| Team | Modules Granted |
|------|----------------|
| parts_administrators | Issue, Check In, Inventory, Ledger |
| rma_administrators | Case Management, Reminders, Process Flows |
| internal_support_technicians | Case Management, Reminders, Process Flows |
| computer_technicians | Case Management, Reminders, Process Flows |
| intake_administrators | Case Management, Reminders |
| route_coordinators | Route Coordination |
| logistics_technicians | Logistics, Logistics Log |
| reporting_administrators | Data Management |
| order_administrators | (directory only — no modules) |
| quote_administrators | (directory only — no modules) |
| network_technicians | (directory only — no modules) |

### Special Permissions

- **Intake Administrators** → can create cases and work orders
- **Parts Administrators** → can issue/checkout parts

---

## 9. Functional Modules (13 UI Tabs)

| # | Tab | Backend | Purpose |
|---|-----|---------|---------|
| 1 | Issue | main.py | Check out parts → cart → commit |
| 2 | Check In | main.py | Receive/return parts |
| 3 | Inventory | main.py | Stock dashboard, search, CSV export |
| 4 | Ledger | main.py | Audit trail of all inventory changes |
| 5 | Notifications | main.py | Pending approval requests |
| 6 | Reminders | case_management.py | Due reminders for assigned cases |
| 7 | Case Management | case_management.py | Full RMA case lifecycle |
| 8 | Route Coordination | workbook_modules.py | Upload logistics workbook (.xlsx) |
| 9 | Logistics | workbook_modules.py | Technician sub-status updates |
| 10 | Logistics Log | workbook_modules.py | Activity history (append-only) |
| 11 | Data Management | workbook_modules.py | Download compiled workbook |
| 12 | Operations Runbook | main.py + React | Process flow diagrams |
| 13 | Admin | main.py | Users, inventory wipe, CSV import, catalogs |

---

## 10. Key Workflows

### Inventory (Issue / Check In)

Parts are checked out via a cart model (add to cart → commit). Check-in receives/returns parts. All changes are recorded in the ledger. Inventory add requests require supervisor/manager approval via the Notifications tab.

### Case Management (RMA)

Full lifecycle management for RMA cases: creation, requirement tracking, workflow steps, notes, reminders, email templates, and manufacturer/customer catalogs. Cases are assigned to teams (RMA, Internal Support, Computer, Intake).

### Logistics Workbook Cycle

```
Route Coordinator uploads .xlsx → Technicians see assigned rows (matched by Owner) →
Technicians update sub-statuses → Reporting Admin downloads compiled workbook
```

- One active workbook at a time; each upload increments `cycle_version`
- Rows matched by `Owner` column ↔ user `display_name` (case-insensitive)
- Only "Ready for Pickup" and "Ready for Delivery" rows are editable
- Sub-statuses: Pick up Successful, Pick Up Failed, Device Not On Pickup List, Delivery Successful, Delivery Unsuccessful
- Escalation, Notify RC, Undo, and Correction Request actions available
- Pickup attempts ≥ 2 triggers mandatory RC notification

---

## 11. Email / SMTP

Configured via environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_TLS`, `SMTP_SSL`. Used for MFA codes and case management email actions.

---

## 12. Testing

| Attribute | Detail |
|-----------|--------|
| Framework | Python `unittest` (not pytest) |
| Async support | `unittest.IsolatedAsyncioTestCase` |
| Test DB | Ephemeral SQLite (tempfile per test) |
| Test count | 10 test files |
| Run command | `python -m unittest discover dev/app/` |

Test files cover: logistics workbook cycle, RMA workflows, team associations, team catalog seeding, permission separation, intake gating, cart operations, ledger search, checkout commit, and JWT expiration.

---

## 13. File System Layout

```
/home/eusadmin/eusupport/
├── .env                                    # Environment config (secrets)
├── .gitignore                              # Protects .env, certs, DB files
├── docker-compose.inventory-prod.yml       # Container orchestration
├── Caddyfile                               # Reverse proxy config
├── index.html                              # Root smoke-test page
├── inventory-precutover.dump               # Pre-migration SQLite dump
├── caddy-certs/
│   ├── tls.crt                             # TLS certificate
│   └── tls.key                             # TLS private key
├── backups/
│   └── *.dump                              # PostgreSQL backup dumps
├── docs/
│   ├── KIRO_PROJECT_CONTEXT.md             # Project context document
│   └── AS_BUILT.md                         # This document
└── dev/
    ├── Dockerfile                          # Python 3.11-slim, non-root
    ├── requirements.txt                    # Pinned dependencies
    └── app/
        ├── main.py                         # Core FastAPI app (98 KB)
        ├── case_management.py              # RMA case module (194 KB)
        ├── workbook_modules.py             # Logistics module (131 KB)
        ├── auth.py                         # Auth, JWT, MFA (26 KB)
        ├── db_core.py                      # DB engine + introspection
        ├── permissions.py                  # Team permission checks
        ├── permission_rules.py             # Permission logic
        ├── teams.py                        # Team routes
        ├── team_db.py                      # Team DB operations
        ├── account_creation.py             # User provisioning
        ├── migrate_*.py                    # 15 migration files
        ├── test_*.py                       # 10 test files
        ├── static/
        │   ├── index.html                  # SPA (89 KB, 13 tabs)
        │   ├── app.js                      # Frontend JS (384 KB)
        │   ├── assets/                     # Logo, favicon, textures
        │   └── processFlows/               # JSON flow definitions
        ├── process-flows/                  # React/xyflow sub-app source
        └── tools/                          # Utilities + archived scripts
```

---

## 14. Known Considerations

- **Monolith scale**: The three backend modules (98–194 KB each) and frontend JS (384 KB) are very large single files. Changes require careful reading of existing patterns.
- **Dual user tables**: `users` (business) and `auth_users` (credentials) must stay in sync. Password hashes are synced between them.
- **Fail-open migrations**: Migration errors are caught silently. Check logs if schema changes don't take effect.
- **No frontend build step**: `app.js` and `index.html` are edited directly. Only `process-flows.bundle.js` is a built artifact.
- **Disk usage at 75%**: 12 GB free on a 48 GB volume — monitor for growth.
- **Legacy SQLite artifacts**: Archived to `tools/_archived_sqlite/`. The `aiosqlite` dependency remains for test infrastructure.
- **Schema-adaptive queries**: `db_core.table_columns()` discovers columns at runtime, so queries adapt to schema changes without code changes.
