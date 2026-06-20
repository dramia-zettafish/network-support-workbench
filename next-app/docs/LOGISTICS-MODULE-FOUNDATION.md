# Logistics Module Foundation

Branch: `feature/nextjs-logistics-workbook-foundation`

## What This Foundation Supports

- Upload a single active logistics workbook (.xlsx)
- Parse workbook rows into a normalized shape
- Display rows filtered by owner (technician view)
- Show workbook status and readiness (data management view)
- Owner-based row assignment via the Owner column

## Upload Behavior

- Endpoint: `POST /api/logistics/workbook/upload`
- Requires `WRITES_ENABLED=true` (write-safety guard)
- Accepts `.xlsx` files only; rejects other types with 400
- Stores only the latest workbook (replaces previous)
- Storage: `.local-data/logistics/` (gitignored, local filesystem)
- No workbook mutation occurs — file is read-only after upload

## Parsed Columns

| Field | Header Name Match | Fallback Column |
|-------|------------------|-----------------|
| work_order_number | Work Order Number | — |
| case_number | Case | G |
| customer | Customer (Case) | H |
| customer_asset | Customer Asset (Case) | I |
| location | Location (Case) | K |
| status_reason | Status Reason (Case) | L |
| sub_status | Sub-Status | M |
| owner | Owner | — |

Column matching strategy:
1. Match by header name (case-insensitive, trimmed)
2. If not found, use known column letter as fallback
3. Warnings are returned for any columns resolved via fallback

## Owner Matching

- Rows are matched to technicians by the `Owner` column value
- Technician view provides an owner selector dropdown
- URL param `?owner=Name` can pre-select an owner
- No auth integration for owner identity yet (temporary auth)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/logistics/workbook/upload | Upload active workbook |
| GET | /api/logistics/workbook/status | Active workbook metadata |
| GET | /api/logistics/rows | Normalized rows (filterable) |
| GET | /api/logistics/owners | Unique owners with counts |

### Row Filters (GET /api/logistics/rows)

- `owner` — filter by owner name
- `status_reason` — filter by status reason
- `sub_status` — filter by sub-status
- `search` — search across work order, case, customer, location

## Pages

- `/logistics` — Landing page with links to sub-views
- `/logistics/upload` — Upload workbook (requires writes enabled)
- `/logistics/technician` — Rows by owner, grouped by status reason
- `/logistics/data-management` — Workbook status, readiness checklist

## Current Limitations

- No workbook row mutation (read-only after upload)
- No technician submission updates (Pick Up / Delivery actions disabled)
- No download/clear chamber functionality
- No correction workflow
- No auth-based owner auto-detection (uses manual selector)
- Single workbook at a time (no history)
- Local filesystem storage only (no S3/database)

## Future Next Steps

1. **Technician submissions** — Enable Pick Up Successful/Failed, Delivery Successful actions that update row sub-status
2. **Workbook mutation / sub-status update** — Write updated sub-status back to workbook rows
3. **Data Management download chamber** — Allow downloading the updated workbook with submission results
4. **Clear chamber** — Reset active workbook after download
5. **Correction workflow** — Handle failed pickups/deliveries with re-routing
6. **Auth-based owner matching** — Auto-detect current user's display name for owner filter
7. **Workbook history** — Track upload history and submission audit trail
