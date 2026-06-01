# Network Vcode - Stack-Agnostic Workflow

This document describes the business logic and data flows of the Network Vcode application in a technology-agnostic manner. It defines the core entities, state transitions, and integration patterns that any implementation stack must support.

## Table of Contents

1. [Core Entities](#core-entities)
2. [State Machines](#state-machines)
3. [Workflows](#workflows)
4. [Integration Points](#integration-points)
5. [Data Requirements](#data-requirements)
6. [API Contracts](#api-contracts)

---

## Core Entities

### 1. Ticket

The primary work unit tracking a network device issue requiring resolution.

**Attributes:**
- `ticket_number` (integer, auto-incremented)
- `external_ticket_number` (string, ≤8 chars, required)
- `device_type` (enum: `switch`, `access_point`, `ups`)
- `school_name` (string, required)
- `tea_code` (integer, 0-999, required)
- `mdf_idf` (string, optional) - location identifier
- `date` (date, required) - creation date
- `note` (string, ≤1000 chars, optional)
- `priority` (enum: `low`, `medium`, `high`, optional)
- `status` (enum: `open`, `on_hold`, `closed`, required, default: `open`)

**Constraints:**
- External ticket number must be ≤8 characters
- TEA code must be 3 digits (0-999)
- Ticket number serves as foreign key for related entities

**Indexes:**
- ticket_number (primary key)
- external_ticket_number
- school_name
- status
- device_type

---

### 2. Device Response

Tracks resolution steps for switch and access point tickets. One response per ticket.

**Attributes:**
- `id` (integer, auto-incremented)
- `ticket_id` (integer, required, foreign key to Ticket, unique per ticket)
- `resolution_type` (enum: `permanent`, `temp_rma`, `no_replacement`, required, default: `permanent`)
- `status` (enum: `open`, `temp_placed`, `closed`, required, default: `open`)
- `resolution_locked_at` (timestamp, nullable) - when first response chosen
- `response_note` (string, ≤2000 chars, optional)
- `temp_response_note` (string, ≤2000 chars, optional)
- `rma_response_note` (string, ≤2000 chars, optional)
- `created_at` (timestamp, auto-set)
- `updated_at` (timestamp, auto-updated on modification)

**Defective Equipment (initial problem):**
- `defective_model` (string)
- `defective_sn` (string)
- `defective_mac` (string)
- `defective_asset_tag` (string)
- `defective_room` (string)

**Replacement Equipment (for permanent resolution):**
- `replacement_model` (string)
- `replacement_sn` (string)
- `replacement_mac` (string)
- `replacement_hostname` (string)
- `replacement_ip` (string)
- `replacement_asset_tag` (string)
- `replacement_room` (string)

**Temporary Equipment (for temp_rma resolution):**
- `temp_model` (string)
- `temp_sn` (string)
- `temp_mac` (string)
- `temp_hostname` (string)
- `temp_ip` (string)
- `temp_asset_tag` (string)
- `temp_room` (string)

**Constraints:**
- One response per ticket (unique ticket_id)
- Once resolution_locked_at is set, resolution_type cannot change

**Indexes:**
- id (primary key)
- ticket_id (unique, foreign key)
- status
- resolution_type

---

### 3. UPS Installation

Tracks UPS replacement workflow with multi-phase installation process. Auto-created when ticket with `device_type=ups` is created. Historical imports may also create standalone fulfilled UPS records without linked ticket rows.

**Attributes:**
- `ups_installation_id` (integer, auto-incremented)
- `ticket_number` (integer, nullable, foreign key to Ticket, unique when present)
- `external_ticket_number` (string, ≤8 chars, optional)
- `school_name` (string, required)
- `tea_code` (integer, 0-999, nullable for historical standalone rows)
- `created_date` (date, required)
- `status` (enum: `intake`, `scheduled`, `servicing`, `fulfilled`, required, default: `intake`)

**Phase 1 - Assessment (Read-only from frontend):**
- `model` (string)
- `serial_number` (string)
- `defective_battery_pack_serial` (string)
- `idf` (string)
- `asset_tag` (string)
- `room_number` (string)
- `mac_address` (string)
- `hostname` (string)

**Phase 2 - Service Information Entry:**
- `new_serial_number` (string)
- `new_webcard_serial` (string)
- `new_battery_pack_asset_tag` (string)
- `new_battery_pack_serial` (string)
- `snmp_ip` (string)
- `battery_pack_1_asset_tag` (string)
- `ups_po` (string) - UPS purchase order
- `bp_po` (string) - Battery pack purchase order
- `installed_date` (date, optional)
- `installed_by` (string, optional)
- `notes` (string, ≤1000 chars, optional)

**Phase 3 - Scheduling & Fulfillment:**
- `proposed_install_date` (date, optional) - technician-suggested Monday
- `approved_install_date` (date, optional)
- `install_contact` (string, optional)
- `install_contact_number` (string, optional)

**Constraints:**
- One UPS installation per linked ticket (unique ticket_number when present)
- TEA code must be 3 digits (0-999) when present
- External ticket number must be ≤8 characters

**Indexes:**
- ups_installation_id (primary key)
- ticket_number (unique, foreign key)
- status
- proposed_install_date
- school_name

---

### 4. RMA (Return Merchandise Authorization)

Placeholder for RMA workflow logic. Kept for schema parity.

**Attributes:**
- `rma_id` (integer, auto-incremented)
- `ticket_number` (integer, nullable, foreign key to Ticket)
- `customer` (string, required) - typically "HISD"
- `campus` (string, required)
- `dynamics_case_number` (string, required, ≤32 chars)
- `part_number_model` (string, required)
- `defective_serial_number` (string, required)
- `issue` (string, ≤1000 chars, required)

**Constraints:**
- Dynamics case number must be ≤32 characters

**Indexes:**
- rma_id (primary key)
- ticket_number (foreign key)
- dynamics_case_number

---

## State Machines

### Ticket Status Machine

```
┌──────────────────────────────────────┐
│           TICKET STATES              │
└──────────────────────────────────────┘

    (create)
      │
      v
   OPEN ──(on-hold)──┐
    │                │
    │                ├──(reopen)──┐
    │                │            │
    └────────────────┴────────────┘
    │
    └──(resolve/close)──> CLOSED

Trigger Points:
- OPEN: Created automatically on ticket creation
- ON_HOLD: User manually transitions ticket to on-hold status
- CLOSED: User explicitly closes ticket after resolution actions (response copied, etc.)
```

### Device Response Resolution Type Lock

```
┌──────────────────────────────────────┐
│      RESOLUTION TYPE WORKFLOW        │
└──────────────────────────────────────┘

OPEN (unlocked) ──(first response copied)──> LOCKED

Once locked:
- Resolution type cannot be changed
- Only notes can be modified
- Status can transition (TEMP_PLACED after temp response, CLOSED after final)
```

### Device Response Status Machine

```
┌──────────────────────────────────────┐
│     DEVICE RESPONSE STATES           │
└──────────────────────────────────────┘

   OPEN ──(temp_rma resolution)──> TEMP_PLACED ──(copy temp response)──> CLOSED
   │
   ├──(permanent resolution)──> CLOSED
   │
   └──(no_replacement resolution)──> CLOSED
```

### UPS Installation Status Machine

```
┌──────────────────────────────────────┐
│     UPS INSTALLATION STATES          │
└──────────────────────────────────────┘

              (create)
                │
                v
    ┌─────────> INTAKE <──────────┐
    │      (read-only view)       │
    │      (Phase 1 data only)    │
    │                             │
    │ (propose install dates)     │ (remove from workflow)
    │                             │
    ├──(move to In Progress)──> SCHEDULED
    │                             │
    │                             ├──(warehouse copy)──> SERVICING
    │                             │                        │
    │                             │                        ├──(fill Phase 3 devices)
    │                             │                        │
    └─────(reset to INTAKE)───────┼────(explicitly close)──> FULFILLED
```

---

## Workflows

### Workflow 1: Ticket Creation

**Trigger:** User creates new ticket

**Input:**
- external_ticket_number (string, ≤8 chars)
- device_type (switch | access_point | ups)
- school_name (string)
- tea_code (0-999)
- mdf_idf (string, optional)
- date (date)
- note (string, optional)
- priority (low | medium | high, optional)

**Process:**
1. Validate input (length, range, format constraints)
2. Create Ticket record with status = `open`
3. If device_type = `ups`:
   - Auto-create UPS Installation record
   - Link to newly created Ticket
   - Status = `intake`
4. If device_type = `switch` or `access_point`:
   - Auto-create Device Response record
   - Link to newly created Ticket
   - Status = `open`, resolution_type = `permanent` (default)

**Output:**
- Ticket record created
- Related entity created (UPS or Device Response)
- Confirmation with ticket_number and external_ticket_number

**Side Effects:**
- Dashboard open count incremented
- Ticket appears in open tickets list

---

### Workflow 2: Device Response - Permanent Replacement

**Trigger:** User selects permanent replacement in ticket modal

**Prerequisites:**
- Ticket device_type = `switch` or `access_point`
- Device Response exists for ticket
- Device Response status = `open` (not yet locked)

**Input:**
- Defective equipment details (model, SN, MAC, asset tag, room)
- Replacement equipment details (model, SN, MAC, hostname, IP, asset tag, room)
- Response note (optional, ≤2000 chars)

**Process:**
1. Validate input
2. Update Device Response:
   - Set resolution_type = `permanent`
   - Set resolution_locked_at = NOW()
   - Populate defective_* and replacement_* fields
   - Set response_note
3. Generate response email text (template: permanent replacement format)
4. Copy email text to clipboard
5. Keep Device Response status = `open` (do not auto-close)

**Output:**
- Device Response record updated with locked resolution type
- Email text in clipboard (technician-ready format)
- Modal remains open for ticket closure or navigation

**Side Effects:**
- Resolution type is now locked; no other resolution option available
- Ticket can be marked closed when ready
- Permanent replacement workflow ends here (no RMA follow-up)

---

### Workflow 3: Device Response - Temporary + RMA Replacement

**Trigger:** User selects temp_rma replacement in ticket modal

**Prerequisites:**
- Ticket device_type = `switch` or `access_point`
- Device Response exists for ticket
- Device Response status = `open` (not yet locked)

**Input:**
- Phase 1 (Temporary Equipment):
  - Defective equipment details (model, SN, MAC, asset tag, room)
  - Temporary equipment details (model, SN, MAC, hostname, IP, asset tag, room)
  - Response note (optional)

**Process:**
1. Validate input
2. Update Device Response:
   - Set resolution_type = `temp_rma`
   - Set resolution_locked_at = NOW()
   - Populate defective_* and temp_* fields
   - Set temp_response_note
3. Generate temporary replacement email text
4. Copy to clipboard
5. Transition status = `temp_placed`

**Output:**
- Device Response record updated, locked, status = `temp_placed`
- Temporary replacement email in clipboard
- Modal updates to show Phase 2 (RMA entry)

**Side Effects:**
- Temporary device is now "in service" tracking begins
- User prompted to proceed to RMA entry

---

### Workflow 4: Device Response - RMA Entry (Phase 2)

**Trigger:** User proceeds from temp_rma placement

**Prerequisites:**
- Device Response resolution_type = `temp_rma`
- Device Response status = `temp_placed`
- Technician has placed temporary device and needs to initiate RMA

**Input:**
- Campus (string)
- Defective model and serial number (pre-filled from Phase 1 defective equipment)
- Issue description (string, ≤1000 chars)
- Dynamics Case # (string, ≤32 chars, required)

**Process:**
1. Validate input
2. Create or update RMA record:
   - Set customer = "HISD" (fixed)
   - Set campus (from input)
   - Set dynamics_case_number (from input)
   - Set part_number_model (from defective equipment)
   - Set defective_serial_number (from defective equipment)
   - Set issue (from input)
   - Link to Ticket
3. Generate RMA email text (pre-filled fields + editable fields)
4. Copy to clipboard
5. Transition Device Response status = `closed`

**Output:**
- RMA record created/updated
- RMA email text in clipboard (Outlook-friendly format)
- Device Response now closed
- Ticket can be marked complete

**Side Effects:**
- RMA case tracking begins with Dynamics Case #
- Temporary device placement and RMA initiation now complete

---

### Workflow 5: Device Response - No Replacement

**Trigger:** User selects no replacement in ticket modal

**Prerequisites:**
- Ticket device_type = `switch` or `access_point`
- Device Response exists for ticket
- Device Response status = `open`

**Input:**
- Resolution note (optional, explaining why no replacement needed)

**Process:**
1. Validate input
2. Update Device Response:
   - Set resolution_type = `no_replacement`
   - Set resolution_locked_at = NOW()
   - Set response_note (or default message)
3. Transition status = `closed`
4. Generate no-replacement confirmation

**Output:**
- Device Response locked and closed
- Ticket ready for closure
- No email generation (no replacement action)

**Side Effects:**
- Ticket can now be marked closed without further action

---

### Workflow 6: UPS Installation - Phase 1 to Phase 2

**Trigger:** User clicks edit on pending UPS installation or opens detail modal

**Prerequisites:**
- UPS Installation status = `intake`
- Ticket device_type = `ups`

**Data Available (Read-only):**
- Model, Serial Number, Defective Battery Pack Serial, IDF
- Asset Tag, Room Number, MAC Address, Hostname

**Input (Phase 2 Fields):**
- New Serial Number (UPS replacement SN)
- New WebCard Serial
- New Battery Pack Asset Tag
- New Battery Pack Serial Number
- SNMP IP
- Battery Pack 1 Asset Tag
- UPS PO (Purchase Order)
- BP PO (Battery Pack Purchase Order)
- Installed Date (optional)
- Installed By (optional)
- Notes (optional, ≤1000 chars)

**Process:**
1. Validate input
2. Update UPS Installation:
   - Populate Phase 2 fields (new_serial_number, new_webcard_serial, etc.)
   - Store entered values
3. Status remains = `intake` until moved to scheduled

**Output:**
- Phase 2 data saved to UPS Installation record
- Modal allows user to proceed to Phase 3 or save

---

### Workflow 7: UPS Installation - Intake to Scheduled

**Trigger:** User selects pending installations and initiates "NOC Schedule" action

**Prerequisites:**
- UPS Installation(s) status = `intake`
- One or more installations selected
- Phase 2 data optionally entered

**Input:**
- Selected installation IDs
- Proposed install dates (user editable, defaults to Monday of next calendar week)

**Process:**
1. For each selected installation:
   - Validate proposed_install_date (must be future date, preferably Monday)
   - Update UPS Installation:
     - Set proposed_install_date
     - Transition status = `scheduled`
2. Generate NOC schedule table:
   - Format: Outlook-friendly (HTML table or formatted text)
   - Columns: External Ticket #, School Name, Proposed Date, UPS Model, etc.
3. Copy schedule to clipboard

**Output:**
- Multiple UPS Installation records transitioned to `scheduled`
- NOC schedule table in clipboard (ready for email to NOC team)

**Side Effects:**
- Installations now appear in "In Progress" table under "Scheduled" section
- Installations ready for warehouse email generation

---

### Workflow 8: UPS Installation - Scheduled to Servicing

**Trigger:** User generates warehouse email from selected in-progress installations

**Prerequisites:**
- UPS Installation(s) status = `scheduled`
- One or more installations selected
- Phase 2 data must be complete

**Input:**
- Selected installation IDs
- Editable fields in warehouse preview:
  - UPS PO (if not set)
  - BP PO (if not set)
  - Any other warehouse-needed fields

**Process:**
1. For each selected installation:
   - Validate all required Phase 2 fields are complete
   - Normalize blank PO fields to "N/A"
   - Generate warehouse email content:
     - Format: Outlook-friendly HTML table
     - Columns: External Ticket #, School Name, Equipment Details, POs, Contact Info, etc.
2. Copy warehouse table to clipboard
3. Transition all selected installations:
   - Status = `servicing`

**Output:**
- Warehouse email table in clipboard
- Multiple installations transitioned to `servicing`

**Side Effects:**
- Installations now appear in "In Progress" table under "Servicing" section
- Servicing installations now clickable (open Phase 3 fulfillment modal)

---

### Workflow 9: UPS Installation - Fulfillment to Completed

**Trigger:** User clicks a servicing installation and chooses "Move to Completed" from the fulfillment modal

**Prerequisites:**
- UPS Installation status = `servicing`
- Warehouse step complete

**Input:**
- Fulfillment fields:
  - Asset Tag #
  - UPS SN
  - SNMPWEBCARD SN
  - SNMP IP
  - Battery Pack SN
  - Battery Pack Asset Tag #

**Process:**
1. Validate input (string lengths)
2. Update UPS Installation:
   - Populate fulfillment fields
   - Transition status = `fulfilled`
3. Close modal and refresh UPS queues

**Output:**
- Fulfillment fields saved to UPS Installation record
- Installation appears in Completed

**Side Effects:**
- Installation leaves active In Progress queues

---

### Workflow 10: UPS Installation - Completed Lookup and Edit

**Trigger:** User searches/clicks a completed UPS row

**Prerequisites:**
- UPS Installation status = `fulfilled`

**Process:**
1. Display full completed UPS details
2. If user clicks Edit:
   - Allow editing asset/reference fields
   - Save through UPS installation update route
   - Keep status = `fulfilled`

**Output:**
- Completed UPS detail modal
- Updated asset/reference fields when saved

**Side Effects:**
- Completed table remains a historical lookup surface
- Completed rows do not re-enter active workflow

---

### Workflow 11: UPS Installation - Remove from Workflow

**Trigger:** User clicks "Remove" action on in-progress installation

**Prerequisites:**
- UPS Installation status = `scheduled` or `servicing`

**Process:**
1. Transition status = `intake`
2. Clear Phase 2 data (optional: preserve or clear user decision)
3. Return installation to pending table

**Output:**
- Installation back in `intake` status
- Installation reappears in pending table
- User can re-enter Phase 2 and reschedule

**Side Effects:**
- Workflow reset to Phase 1
- Proposed dates cleared

---

## Integration Points

### 1. Ticket → Device Response / UPS Installation

- **Trigger:** Ticket creation
- **Link:** Ticket foreign key in related entity
- **Cardinality:** 1 Ticket : 1 Device Response OR 1 Ticket : 1 UPS Installation (never both)
- **Auto-cascade:** Delete Ticket → Delete related entity

### 2. Device Response → RMA

- **Trigger:** Device Response enters temp_rma resolution type → Phase 2 RMA entry
- **Link:** RMA references Ticket (same Ticket as Device Response)
- **Data Flow:** Defective equipment from Device Response pre-fills RMA model/SN

### 3. UPS Installation → Ticket

- **Trigger:** UPS Ticket creation
- **Link:** Unique constraint when ticket_number is present (one UPS Installation per Ticket)
- **Data Flow:** Ticket external number and dates seed UPS Installation
- **Historical Exception:** Imported historical UPS rows may have `ticket_number = NULL` and must not create Ticket records

### 4. Dashboard Aggregations

- **Open Tickets Count:** `SELECT COUNT(*) FROM tickets WHERE status = 'open'`
- **On-Hold Detail:** `SELECT * FROM tickets WHERE status = 'on_hold'`
- **Open/On-Hold Preview:** First N tickets sorted by date; row click opens the ticket response modal in the Tickets workflow
- **UPS This Week:**
  - Pending: `SELECT COUNT(*) FROM ups_installations WHERE status = 'intake'`
  - Current week: `SELECT COUNT(*) FROM ups_installations WHERE status IN ('scheduled', 'servicing') AND WEEK(proposed_install_date) = CURRENT_WEEK`
- **Weekly Table:** All UPS with proposed_install_date in the current work week; row click navigates to the UPS workflow

---

## Data Requirements

### Required External Systems / Integrations

1. **Date/Time Calculation:**
   - Parse and validate date strings (format TBD, commonly YYYY-MM-DD)
   - Calculate "Monday of next calendar week" from current date
   - Week number calculation for dashboard aggregations

2. **Clipboard / Export:**
   - Generate plain text or HTML table formats
   - Copy-to-clipboard functionality (implementation depends on platform)

3. **Email Generation (Optional, for documentation):**
   - Template format: Plain text OR HTML
   - Placeholder substitution for device details, dates, contacts
   - Standard signatures and formatting

### Validation Rules

**Ticket Validation:**
- external_ticket_number: alphanumeric, ≤8 chars, required
- tea_code: 0-999, required
- school_name: non-empty string, required
- date: valid date format, required
- device_type: one of {switch, access_point, ups}, required
- mdf_idf: optional, max 100 chars
- note: optional, max 1000 chars
- priority: optional, one of {low, medium, high}

**Device Response Validation:**
- response_note: max 2000 chars
- equipment fields: max 100 chars each (model, SN, asset tag, etc.)
- room: max 50 chars
- hostname, IP: format validation (hostname pattern, IP address format)

**UPS Installation Validation:**
- proposed_install_date: future date, preferably Monday
- approved_install_date: must be >= proposed_install_date
- contact_number: phone format (if provided)
- POs: alphanumeric, max 100 chars
- tea_code: 0-999

**RMA Validation:**
- dynamics_case_number: alphanumeric, required, max 32 chars
- customer: required (typically "HISD")
- campus: required, non-empty
- issue: required, max 1000 chars
- part_number_model: required, max 100 chars
- defective_serial_number: required, max 100 chars

---

## API Contracts

### Create Ticket

```
POST /api/tickets

Request:
{
  "external_ticket_number": "TSK12345",
  "device_type": "ups",
  "school_name": "Lincoln High School",
  "tea_code": 123,
  "mdf_idf": "Room 201",
  "date": "2026-05-08",
  "note": "UPS battery replacement needed",
  "priority": "high"
}

Response (201 Created):
{
  "ticket_number": 42,
  "external_ticket_number": "TSK12345",
  "device_type": "ups",
  "school_name": "Lincoln High School",
  "tea_code": 123,
  "status": "open",
  "created_ups_installation_id": 15 (if device_type = "ups")
}
```

### Get Tickets (List with Filters)

```
GET /api/tickets?status=open&limit=20&offset=0

Response (200 OK):
{
  "total": 45,
  "tickets": [
    {
      "ticket_number": 42,
      "external_ticket_number": "TSK12345",
      "device_type": "ups",
      "school_name": "Lincoln High School",
      "tea_code": 123,
      "status": "open",
      "date": "2026-05-08",
      "priority": "high",
      ...
    }
  ]
}
```

### Update Device Response - Permanent Resolution

```
PATCH /api/device-responses/{ticket_id}

Request:
{
  "resolution_type": "permanent",
  "defective_model": "Cisco C9300",
  "defective_sn": "ABC123456",
  "defective_mac": "aa:bb:cc:dd:ee:ff",
  "defective_room": "Room 101",
  "replacement_model": "Cisco C9300",
  "replacement_sn": "DEF789012",
  "replacement_mac": "11:22:33:44:55:66",
  "replacement_ip": "192.168.1.5",
  "replacement_hostname": "switch-new-01",
  "replacement_asset_tag": "TAG-12345",
  "response_note": "Replaced defective unit with new one"
}

Response (200 OK):
{
  "id": 10,
  "ticket_id": 42,
  "resolution_type": "permanent",
  "status": "open",
  "resolution_locked_at": "2026-05-08T14:30:00Z",
  "response_text_for_clipboard": "Device Response Email...",
  ...
}
```

### Update UPS Installation - Phase 2

```
PATCH /api/ups-installations/{ups_installation_id}/phase2

Request:
{
  "new_serial_number": "XYZ999888",
  "new_webcard_serial": "WC-123456",
  "new_battery_pack_asset_tag": "BP-TAG-001",
  "new_battery_pack_serial": "BP-SN-001",
  "snmp_ip": "192.168.1.100",
  "battery_pack_1_asset_tag": "BP-PRIMARY",
  "ups_po": "PO-2026-001",
  "bp_po": "PO-2026-002",
  "installed_date": "2026-05-09",
  "installed_by": "John Tech",
  "notes": "Installation completed, awaiting warehouse email"
}

Response (200 OK):
{
  "ups_installation_id": 15,
  "ticket_number": 42,
  "status": "intake",
  "new_serial_number": "XYZ999888",
  ...
}
```

### Update UPS Installation - Phase 3 Devices

```
PATCH /api/ups-installations/{ups_installation_id}/phase3-devices

Request:
{
  "approved_install_date": "2026-05-12",
  "install_contact": "Jane Coordinator",
  "install_contact_number": "713-555-0100"
}

Response (200 OK):
{
  "ups_installation_id": 15,
  "status": "servicing",
  "approved_install_date": "2026-05-12",
  "install_contact": "Jane Coordinator",
  ...
}
```

### Transition UPS Installation Status

```
PATCH /api/ups-installations/{ups_installation_id}/status

Request:
{
  "status": "scheduled",
  "proposed_install_date": "2026-05-13" (if transitioning to scheduled)
}

Response (200 OK):
{
  "ups_installation_id": 15,
  "status": "scheduled",
  "proposed_install_date": "2026-05-13",
  ...
}
```

### Get UPS Installations by Status

```
GET /api/ups-installations?status=intake&limit=50

Response (200 OK):
{
  "total": 12,
  "ups_installations": [
    {
      "ups_installation_id": 15,
      "ticket_number": 42,
      "external_ticket_number": "TSK12345",
      "school_name": "Lincoln High School",
      "status": "intake",
      "model": "Eaton 9SX",
      "serial_number": "ABC123456",
      ...
    }
  ]
}
```

---

## Summary

This workflow document defines:

1. **Entities:** Tickets, Device Responses, UPS Installations, RMAs with full attribute lists
2. **State Machines:** Status transitions for each entity type with clear entry/exit points
3. **Workflows:** 10 primary workflows covering ticket creation, device resolution (permanent, temp+RMA, no-replacement), and UPS multi-phase installation
4. **Integration:** Clear links between entities and data flows
5. **API Contracts:** Expected request/response formats for key operations

Any implementation stack (FastAPI, Next.js, Express, Django, etc.) should support these contracts and maintain these state machines to ensure consistent business logic.
