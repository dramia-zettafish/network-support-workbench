# Logistics Submissions and Chamber

## Overview

The Logistics module manages route coordination workflows for EUS technicians. Technicians submit pickup/delivery outcomes via a web interface, and Data Management reviews, downloads, and clears submissions.

## Upload Behavior

- **Endpoint:** `POST /api/logistics/workbook/upload`
- Accepts `.xlsx` files via multipart form upload
- Stores the active workbook in `.local-data/logistics/active-workbook.xlsx`
- Metadata stored in `.local-data/logistics/active-workbook-meta.json`
- Only one active workbook at a time — uploading replaces the previous one
- Uploading a new workbook invalidates the existing chamber (different `workbookId`)
- Requires write-safety guard

## Technician Submission Behavior

- **Endpoint:** `POST /api/logistics/submissions`
- Technicians select an owner, view their assigned rows, and submit outcomes
- Each row requires a `sub_status` selection based on `status_reason`:
  - Ready For Pickup → Pick up Successful / Pick Up Failed (required)
  - Ready For Delivery → Delivery Successful (optional, blank allowed)
- Submitted rows are stored in the chamber and no longer appear in the active list
- Requires write-safety guard
- Validates: active workbook exists, owner matches, sub_status is allowed

## Chamber Storage

- **File:** `.local-data/logistics/chamber.json`
- **Structure:**
  ```json
  {
    "workbookId": "<uploadedAt timestamp>",
    "submissions": [
      {
        "work_order_number": "WO-1001",
        "owner": "Brandon",
        "sub_status": "Pick up Successful",
        "submittedAt": "2026-05-11T14:00:00.000Z"
      }
    ],
    "lastClearedAt": null,
    "lastDownloadedAt": null
  }
  ```
- Chamber is tied to the active workbook's `uploadedAt` — if a new workbook is uploaded, the chamber resets
- `lastClearedAt` determines whether undo or correction request is available
- `lastDownloadedAt` tracks when output was last downloaded

## Data Management: Download and Clear

- **Download:** `GET /api/logistics/download/current` — generates CSV of current submissions
- **Clear:** `POST /api/logistics/submissions/clear` — requires `{ "confirm": true }`
  - Removes all submissions from the chamber
  - Sets `lastClearedAt` timestamp
  - Does NOT delete the uploaded workbook
  - Ends direct undo capability for technicians

## Undo Before Clear/Download

- **Endpoint:** `POST /api/logistics/submissions/undo`
- **Available:** Only when `lastClearedAt` is null (chamber has not been cleared)
- **Request:**
  ```json
  {
    "owner": "Brandon",
    "work_order_numbers": ["WO-1001"]
  }
  ```
- **Validation:**
  - Active workbook must exist
  - Chamber must not be cleared
  - Each work order must exist in chamber for the specified owner
- **Effect:** Removes matching submissions from chamber; rows return to active list
- **Requires:** Write-safety guard

## Correction Request Preview (After Clear/Download)

- **Endpoint:** `POST /api/logistics/corrections/preview`
- **Available:** After chamber has been cleared (undo no longer possible)
- **Request:**
  ```json
  {
    "owner": "Brandon",
    "work_order_numbers": ["WO-1001"],
    "explanation": "Incorrect sub-status selected, should be Pick Up Failed"
  }
  ```
- **Response:** Generates a preformatted correction request message for the Route Coordinator
- **Does NOT:**
  - Persist the correction request
  - Send email
  - Modify workbook data
  - Modify chamber state
- **Preview-only** — technician copies the message and coordinates manually
- No write-safety guard needed (read-only text generation)

## UI Behavior

### Technician View (`/logistics/technician`)
- Shows active (unsubmitted) rows grouped by status reason
- Shows submitted rows with:
  - Sub-status and timestamp
  - **Undo button** if chamber is active (not cleared)
  - **Correction request form** if chamber has been cleared
- Correction request form: select affected rows, enter explanation, generate preview
- Preview includes copy-to-clipboard button
- Labeled: "Correction Request Preview – Not Sent"

### Data Management View (`/logistics/data-management`)
- Shows workbook status, submission counts, owner progress
- Shows chamber finalization state (active vs cleared)
- Clear confirmation warns that clearing ends direct undo capability
- Correction workflow section shows current state and available options
- Download and Clear actions

### Main Logistics Page (`/logistics`)
- Status summary: active workbook, chamber submissions, chamber state, correction workflow availability

## Known Limitations

- Correction requests are preview-only — no automatic email sending
- No persistent correction request history/tracking
- Single-user chamber (no concurrent access protection beyond file locking)
- Chamber storage is local filesystem — not suitable for multi-instance production without shared storage
- No audit trail for undo operations (beyond chamber state changes)

## What Is Intentionally Deferred

- Email sending for correction requests (SMTP integration exists but not wired here)
- Persistent correction request log/database table
- Multi-instance shared storage for chamber
- Role-based access control for specific logistics actions (currently auth-boundary only)
- Correction request approval workflow
- Batch undo (UI supports single-row undo; API supports batch)

## Production Storage Considerations

- Current implementation uses `.local-data/` filesystem storage
- For production multi-instance deployment, chamber storage should be migrated to:
  - Shared filesystem (NFS/EFS)
  - Database table (would require schema migration)
  - Redis/cache layer
- The workbook file itself could be stored in S3/object storage
- `.local-data/` is gitignored and not tracked

## Final QA Checklist

- [x] `npm run build` passes
- [x] `npm run validate:db-readonly` passes
- [x] `npm run validate:write-safety` passes
- [x] No TypeScript files
- [x] No database schema changes
- [x] No Python/FastAPI changes
- [x] No Docker changes
- [x] No email sending
- [x] No auth weakening
- [x] Write-safety guard on all state-changing endpoints
- [x] Client-side POST calls only from @approved-write-client pages
- [x] .env.local, .next, node_modules, .local-data not tracked
