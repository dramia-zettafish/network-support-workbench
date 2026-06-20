# RMA Case Management Module — Final Status

> Branch: `feature/nextjs-rma-final-closeout`
> Last updated: 2026-05-09

## Completed Capabilities

- Case list with search and reference data resolution
- Case detail view (read-only case fields, resolved user/team names)
- RMA form — editable when `WRITES_ENABLED=true`, read-only otherwise
- RMA field validation (required fields, max lengths, date format, boolean normalization)
- Per-field audit notes on save (`Field Update` note type in timeline)
- Notification preview (read-only, no email sent, shows "Preview Only — Not Sent")
- Manual notification send (gated by write-safety + SMTP config, requires confirmation)
- Workflow actions with server-side prerequisite checking
- Activity timeline auto-refresh after RMA save, notification send, and workflow action
- Write-safety guardrails (env-gated, validated by scripts)
- Loading, error, empty, and not-found states for all panels
- Mobile-responsive layout (768px breakpoint)

## Gated Write Behavior

All write operations require:
1. `WRITES_ENABLED=true` in the server environment
2. The `requireWriteEnabled()` guard from `lib/write-safety/`
3. User confirmation in the UI before executing

Writes are **disabled by default**. The environment variable must be explicitly set.

## Approved Write Routes (3 files)

| File | Guard | Purpose |
|------|-------|---------|
| `app/api/cases/[id]/rma/route.js` | `requireWriteEnabled()` | PATCH RMA fields |
| `app/api/cases/[id]/rma/actions/route.js` | `requireWriteEnabled()` | Record workflow actions |
| `app/api/cases/[id]/notifications/send/route.js` | `requireWriteEnabled()` | Send notification email |

Client files with approved write fetch calls (marked with `@approved-write-client`):
- `app/cases/[id]/case-detail-client.jsx`
- `app/cases/[id]/RmaForm.jsx`

## Manual Notification Behavior

- Notifications are **never sent automatically**
- Preview shows email content with "Preview Only — Not Sent" banner
- Sending requires: writes enabled → click "Send Manually" → confirm
- On success: timeline note records the send event
- On SMTP not configured: returns clear `SMTP_NOT_CONFIGURED` error (503)
- Supported types: `manufacturer_engaged`, `manufacturer_case_opened`, `rma_approved_eta`, `inbound_tracking_available`, `rma_denied`

## Workflow Action Behavior

- Actions **record manual workflow events only** — no email is sent
- No automatic stage transitions or status changes
- Each action has server-side prerequisite checks (e.g., manufacturer must be set)
- On success: inserts a `SystemEvent` note in the timeline
- Recommended notification type is returned in the response (UI can suggest next step)
- Supported actions: `manufacturer_engaged`, `manufacturer_case_opened`, `rma_approved_eta_established`, `inbound_tracking_available`, `rma_denied`, `rma_completed`

## Known Limitations (Intentionally Deferred)

1. **Auth is temporary** — current mock auth will be replaced by Cisco Duo/company auth
2. **Actor identity uses placeholder** — "Next.js Migration" until real authenticated user identity is available
3. **SMTP may be unconfigured** — returns clear `SMTP_NOT_CONFIGURED` error in local dev
4. **Workflow actions do not change stage/status** — stage mapping not yet established
5. **No real-time updates** — timeline refreshes only after user-initiated actions
6. **No file attachments** — not in scope for RMA module
7. **No bulk operations** — single-case operations only
8. **RmaFormDisabled.jsx is unused** — legacy component kept for reference, superseded by RmaForm with disabled state

## Safety Rules

- No automatic email sending
- No automatic stage transitions
- No hidden triggers based on field changes
- No automatic RMA status changes
- `WRITES_ENABLED` is never set to `true` in tracked files
- All write behavior behind the write-safety guard
- No `process.env` values exposed in API responses
- No TypeScript files
- No database schema changes

## Validation Scripts

```bash
npm run build                  # Next.js production build
npm run validate:db-readonly   # No unapproved SQL writes, no client DB imports
npm run validate:write-safety  # Write-safety guard enforcement, no unguarded writes
```

Both scripts exit 0 on success, exit 1 on violation.

## Manual QA Checklist

1. Open `/cases` — list loads, search works
2. Open `/cases/5622a648-ab5f-4983-a706-2f3f6f9cdf62` — detail loads with RMA, notes, requirements
3. Verify top badge shows "Read-Only" or "Write-Enabled" based on env
4. With `WRITES_ENABLED=true`: save a small RMA change → audit note appears in timeline
5. No-change save → "No changes to save" message
6. Invalid field → inline validation error shown
7. Preview `manufacturer_engaged` notification → shows "Preview Only — Not Sent"
8. Click "Send Manually" → confirm → success or clear SMTP error
9. Execute workflow action (e.g., `manufacturer_engaged` if manufacturer is set) → SystemEvent note in timeline
10. Attempt action with missing prerequisites → 400 error with clear message
11. Verify no automatic email, hidden trigger, or stage transition occurs
12. Check mobile layout at 768px — panels stack, controls wrap

## Production Readiness Notes

- **Ready to stop active RMA migration work.** The module is functionally complete for its intended scope.
- Before production deployment: replace mock auth with Cisco Duo, configure SMTP, set `WRITES_ENABLED=true` only in appropriate environments.
- The validation scripts should run in CI/CD to prevent regression.
- No database migrations are needed — the module uses existing schema.
