# Missed Integration Checklist — Deferred Modules

Modules removed from `feature/nextjs-missed-integration-cleanup-expanded` because they were not yet production-safe, auth-protected, and write-safety compliant.

## Deferred: Admin Module

**Removed directories:**
- `app/admin/` (admin-client.jsx, page.jsx)
- `app/api/admin/` (all sub-routes)

**Routes that were present:**
- `/api/admin/case-message-templates` — CRUD for case message templates
- `/api/admin/customers` — CRUD for customers
- `/api/admin/inventory` — bulk inventory management
- `/api/admin/rma-manufacturers` — CRUD for RMA manufacturers
- `/api/admin/shipping-carriers` — CRUD for shipping carriers
- `/api/admin/teams` — read-only team list (was safe)
- `/api/admin/users` — user CRUD, role sync, password reset
- `/api/admin/users/[username]/password` — password hash update

**Why deferred:**
- 18+ client-side write fetch calls without write-safety status checks
- 30+ SQL write violations across multiple CRUD routes
- Password route referenced `password_hash` (auth-safety violation)
- Too many routes to individually audit and approve in this pass

**Requirements for future integration:**
1. Each write route must call `requireWriteEnabled()` before any mutation
2. Each write route must call `requireRole()` or `requireWritePermission()` for auth
3. Each write route must use parameterized SQL only (already done)
4. Each write route must use `sanitizeWriteError()` for error responses
5. Client component must include `@approved-write-client` marker
6. Client component must check `/api/write-safety/status` before allowing writes
7. Each route must be added to APPROVED_WRITE_FILES and APPROVED_GATED_WRITE_FILES
8. No `password_hash` exposure in API responses (use `// validate-auth-safety` marker if server-only usage is a false positive)

## Integrated in This Branch

The following write-capable modules were kept and properly approved:

| Route | Guard | Auth | Approved |
|-------|-------|------|----------|
| `app/api/checkin/route.js` | requireWriteEnabled + requireWritePermission | ✓ | ✓ |
| `app/api/issue/cart/route.js` | requireWriteEnabled + requireWritePermission | ✓ | ✓ |
| `app/api/issue/commit/route.js` | requireWriteEnabled + requireWritePermission | ✓ | ✓ |
| `app/api/notifications/route.js` | requireWriteEnabled + requireWritePermission | ✓ | ✓ |
| `app/api/notifications/[id]/decide/route.js` | requireWriteEnabled + requireWritePermission | ✓ | ✓ |
| `app/api/runbook/processes/route.js` (PATCH) | requireWriteEnabled + requireRole('manager') | ✓ | ✓ |

Read-only modules (no write-safety concerns):
- `app/api/ledger/` — GET-only audit trail
- `app/api/ledger/case-numbers/` — GET-only typeahead
- `app/api/logistics/log/` — GET-only activity log
- `app/api/runbook/processes/` (GET) — read-only process list
- `app/api/notifications/` (GET) — read-only request list
