# EUS Support v2.0.0 — Release Notes

**Release Date:** 2026-05-04

---

## Highlights

This release removes all SQLite dependencies, making PostgreSQL the sole supported database engine. It also introduces a parallel DEV deployment, multiple UI improvements, and several bug fixes.

---

## Database: Postgres-Only

- **Removed SQLite runtime support** — `DB_URL` is now required; no silent fallback to SQLite
- **New `migrate_core_schema.py`** — creates all 41 base tables from an empty Postgres database, replacing the old SQLite seed workflow
- **Stripped SQLite branches** from `migrate_case_management.py`, `migrate_workbook_modules.py`, `migrate_shipping_carriers.py`
- **Archived 15 legacy SQLite scripts** to `tools/_archived_sqlite/`
- **Removed `aiosqlite`** from dependencies
- **All 10 test files** converted from ephemeral SQLite to Postgres
- **Renamed** `_sqlite_now()` → `_utc_now_str()` in case management module

## DEV Deployment

- **Parallel DEV stack** via `docker-compose.dev.yml` — runs alongside production on port 18003
- **Separate database, volumes, and Docker project** — fully isolated from production
- **Environment-driven banner** — red "DEVELOPMENT ENVIRONMENT" banner appears only when `ENV_LABEL` is set
- **`deploy-dev.sh`** — one-command deploy/update script
- **`README-DEV.md`** — full documentation for DEV operations

## UI Improvements

### Issue Tab
- **Target Asset Location** split into two fields: Rack and Shelf
- Print session output shows `Target Asset Location: Rack X, Shelf X`
- Print session no longer auto-triggers the browser print dialog (both Issue and Check In)

### Logistics Tab
- **Column sort** — click Customer, Location, or Stage headers to sort (default: Customer → Location → Stage)
- **Column filters** — per-column filter dropdown buttons (⏷) on Customer, Location, Case, Stage, Customer Asset

### Logistics Log Tab
- **Column sort** — click Created, Username, Event Type, Case Number, Customer, Location, or Stage headers
- **Column filters** — per-column filter dropdown buttons on Username, Event Type, Case Number, Customer, Location
- Removed redundant Event Type and User dropdown filters from the filter bar (now handled by column filters)

### Access Control
- **Route Coordinators** now have access to the Logistics Log tab with full all-user visibility

## Bug Fixes

- **Check-in session summary** — fixed `GROUP BY` clause that failed on Postgres strict mode (`pc.description` and `i.location` were missing from `GROUP BY`)
- **Inventory edit** — added missing `session.commit()` in `PATCH /parts/{part_no}` endpoint; edits were silently rolled back
- **RMA workflow seed** — `owning_team_id` now looked up by team key instead of hardcoded ID
- **Version header** — added `v2.0.0` link to release notes in the UI header

## Repository

- Source code pushed to GitHub: `https://github.com/BMcMakeIt/EUSupport`
- Branches: `main` (production), `develop` (active development)
