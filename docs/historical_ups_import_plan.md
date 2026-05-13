# Historical UPS Import Plan

Use this document as the source of truth for importing the cleaned historical UPS install spreadsheet into Network Vcode.

## Purpose

Import historical UPS installation records into `ups_installations` only.

These records are historical asset/install history, not active workflow tickets. Do **not** create matching records in the `tickets` table for this import.

## Current App Context

The app now runs as a standalone Next.js runtime:

```text
Next.js pages
Next.js API routes
Node pg database access
PostgreSQL
Caddy local entrypoint
```

FastAPI and Alembic are archived and should not be used for this import.

## Input File

Use the cleaned import bucket CSV:

```text
ups_clean_import_ready_promoted.csv
```

This CSV has already been filtered so that the main import bucket excludes rows that still need review, except for the manually promoted rows. The CSV includes `_original_excel_row` for traceability.

## Import Scope

Import rows into:

```text
ups_installations
```

Do **not** insert into:

```text
tickets
device_responses
rmas
```

## Required Schema Compatibility Changes

The current schema assumes every UPS install was created from a ticket. Historical import records should be allowed to exist without a ticket.

Update `db/network_vcode_schema.sql` before importing.

### Change 1 — Allow standalone UPS rows

Current shape:

```sql
ticket_number INTEGER NOT NULL REFERENCES tickets(ticket_number) ON DELETE CASCADE
```

Change to:

```sql
ticket_number INTEGER REFERENCES tickets(ticket_number) ON DELETE SET NULL
```

Reason: historical UPS install rows should not require a matching ticket.

### Change 2 — Allow missing TEA codes

Current shape:

```sql
tea_code INTEGER NOT NULL
```

Change to:

```sql
tea_code INTEGER
```

Keep the existing 0-999 check constraint. PostgreSQL check constraints allow `NULL`, so missing TEA values will pass.

### Change 3 — Keep external ticket number optional

Keep this column nullable:

```sql
external_ticket_number VARCHAR(8)
```

Clean imported Footprints values before insert:

- trim whitespace
- convert Excel-style numbers like `660854.0` to `660854`
- if blank, insert `NULL`
- if longer than 8 chars after cleanup, set `NULL` and log a warning rather than failing the import

## Do Not Change

Do not change the active ticket workflow behavior.

New UPS tickets created from the app should still create linked UPS records from tickets. This import only adds support for historical standalone UPS records.

Do not add auth, RBAC, Prisma, Drizzle, or ORM tooling for this task.

## CSV-to-Database Mapping

| CSV Column | `ups_installations` Column | Notes |
|---|---|---|
| `Footprints` or first unlabeled ticket column | `external_ticket_number` | Clean as text, max 8 chars, nullable |
| `Defective UPS` | `serial_number` | Nullable |
| `Defective BP` | `defective_battery_pack_serial` | Nullable |
| `TEA#` | `tea_code` | Integer 0-999 or NULL |
| `School Name` | `school_name` | Required if present; skip/log if blank |
| `RM#` | `room_number` | Nullable |
| `IDF` | `idf` | Nullable |
| `Install Scheduled` | `created_date`, `proposed_install_date`, `installed_date` | Use same normalized date string for all three |
| `Asset Tag#` | `new_asset_tag` | Replacement UPS asset tag; strip trailing `.0` from spreadsheet numeric values |
| `Replacement UPS SN#` | `new_serial_number` | Nullable |
| `PO#` | `ups_po` | Nullable |
| `SNMPWEBCARD SERIAL` | `new_webcard_serial` | Nullable |
| `SNMP MAC` | `new_mac_address` | Replacement UPS MAC; normalize if safe, otherwise preserve trimmed value |
| `IP Address` | `snmp_ip` | Nullable |
| `SNMP NAME` | `hostname` | Nullable |
| `New BP SN` | `new_battery_pack_serial` | Nullable |
| `BP Asset Tag#` | `new_battery_pack_asset_tag` | Nullable; strip trailing `.0` from spreadsheet numeric values |
| `BP PO#` | `bp_po` | Nullable |
| `_original_excel_row` | `notes` | Include traceability note |

Ignore any CSV columns not listed above.

## Required Insert Defaults

For every imported row:

```text
ticket_number = NULL
status = fulfilled
notes = Historical UPS import. Original Excel row: <_original_excel_row>
```

Use `Install Scheduled` as:

```text
created_date
proposed_install_date
installed_date
```

If `Install Scheduled` is missing or invalid, skip the row and log it. The clean bucket should mostly already avoid this.

## Data Cleanup Rules

Normalize values before insert:

- trim all text fields
- convert empty strings, `N/A`, `NA`, `n/a`, `none`, and `null` to `NULL`
- clean TEA code to integer when possible
- clean external ticket number as text, not numeric
- do not invent values for missing data
- do not create fake ticket numbers
- do not create matching ticket rows

## Import Script Recommendation

Create a one-time script:

```text
scripts/import-ups-history.js
```

Use:

```text
Node.js
pg
csv parser
```

Preferred package:

```bash
npm install csv-parse
```

Do not add an ORM.

## Script Modes

Support two modes:

```bash
node scripts/import-ups-history.js --dry-run
node scripts/import-ups-history.js --commit
```

### Dry Run Should Report

- total rows read
- rows ready to import
- rows skipped
- rows with missing school
- rows with invalid install date
- duplicate external ticket numbers
- duplicate replacement UPS serials
- 5-row preview of normalized output

Dry run must not write to the database.

### Commit Should

- use a database transaction
- insert only valid normalized rows
- log skipped rows
- print final inserted count
- print duplicate warnings without crashing unless the duplicate violates a real database constraint

## Suggested SQL Insert Shape

```sql
INSERT INTO ups_installations (
  ticket_number,
  external_ticket_number,
  school_name,
  tea_code,
  created_date,
  status,
  serial_number,
  defective_battery_pack_serial,
  idf,
  asset_tag,
  new_serial_number,
  new_webcard_serial,
  mac_address,
  hostname,
  new_battery_pack_asset_tag,
  new_battery_pack_serial,
  model,
  room_number,
  installed_date,
  notes,
  snmp_ip,
  ups_po,
  bp_po,
  proposed_install_date
) VALUES (
  NULL,
  $1,
  $2,
  $3,
  $4,
  'fulfilled',
  $5,
  $6,
  $7,
  $8,
  $9,
  $10,
  $11,
  $12,
  $13,
  $14,
  NULL,
  $15,
  $16,
  $17,
  $18,
  $19,
  $20,
  $21
);
```

Adjust parameter order to match the implemented script.

## Validation After Import

After commit, verify through the app:

1. Open `http://localhost:8080`.
2. Go to Networking → UPS.
3. Open Completed UPS table.
4. Verify imported rows appear as `fulfilled`.
5. Test search by:
   - school name
   - UPS serial
   - asset tag
   - MAC address
   - SNMP IP
6. Click several imported rows and confirm the completed summary modal displays historical details.

Also verify active queues are not polluted:

```text
Pending should not receive historical import rows.
In Progress should not receive historical import rows.
Completed should receive historical import rows.
```

## Fresh Database Test

Because the project is still local/dev and data preservation is not required, validate from a clean volume after schema changes:

```powershell
docker compose down -v
docker compose up --build
```

Then run:

```bash
node scripts/import-ups-history.js --dry-run
node scripts/import-ups-history.js --commit
```

## Success Criteria

The task is complete when:

- `db/network_vcode_schema.sql` allows standalone historical UPS rows
- the import script runs in dry-run mode without DB writes
- the commit mode imports the clean CSV into `ups_installations`
- imported records have `ticket_number = NULL`
- imported records have `status = fulfilled`
- imported records show in Completed UPS
- imported records do not show in Pending or In Progress
- no ticket rows are created for historical records
