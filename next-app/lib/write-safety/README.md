# Write Safety Foundation

## Overview

This module provides reusable safety guardrail functions for future write operations (POST, PUT, PATCH, DELETE). **All write operations remain disabled by default** and require explicit opt-in via environment configuration.

> **⚠️ Important:** No real write endpoints, database mutations, or workflow implementations exist yet. This module is a foundation only — it prepares the codebase for controlled write route introduction later.

## Helper Functions

### `requireWriteEnabled()`

**Purpose:** First-line gate that checks whether write operations are allowed.

- Reads the `WRITES_ENABLED` server-side environment variable
- Defaults to `'false'` (disabled) if not set
- Returns a `403` JSON response if writes are disabled
- Returns `null` if writes are enabled (caller proceeds)

```javascript
const writeCheck = requireWriteEnabled();
if (writeCheck) return writeCheck; // Writes disabled, return 403
```

### `assertAllowedMethod(req, allowedMethods)`

**Purpose:** Validates the incoming HTTP method against an explicit whitelist.

- Accepts the request object and an array of allowed methods
- Returns a `405` JSON response with `Allow` header if method not permitted
- Returns `null` if the method is allowed

```javascript
const methodCheck = assertAllowedMethod(req, ['POST']);
if (methodCheck) return methodCheck; // Method not allowed, return 405
```

### `requireWritePermission(req)`

**Purpose:** Verifies authentication and write-capable role authorization.

- Imports and uses existing auth helpers from `@/lib/auth` (read-only import)
- Checks that the user has a write-capable role (`admin`, `manager`, `technician`)
- The `viewer` role is explicitly excluded from write operations
- Returns `{ user }` if permitted, or `{ error: NextResponse }` with 401/403

```javascript
const permCheck = await requireWritePermission(req);
if (permCheck.error) return permCheck.error; // Unauthorized or forbidden
const { user } = permCheck;
```

### `sanitizeWriteError(error)`

**Purpose:** Prevents internal details from leaking to clients in error responses.

- Strips: raw SQL errors, database connection strings, stack traces, table/column names
- Logs the full error server-side for debugging
- Always returns a generic `500` JSON response with no internal details

```javascript
try {
  // ... business logic ...
} catch (error) {
  return sanitizeWriteError(error);
}
```

### `createAuditContext(req)`

**Purpose:** Builds a structured audit context object for future logging.

- Resolves the current user (gracefully handles missing user)
- Records: user info, ISO timestamp, HTTP method as action, URL pathname as resource
- Does NOT persist/write anywhere — only creates the context object

```javascript
const audit = await createAuditContext(req);
// audit = { user: { id, username, role }, timestamp, action, resource, metadata }
```

## Composition Pattern

Future write routes should compose the helpers in this order:

```javascript
import {
  requireWriteEnabled,
  assertAllowedMethod,
  requireWritePermission,
  sanitizeWriteError,
  createAuditContext,
} from '@/lib/write-safety';

export async function POST(req) {
  // 1. Check if writes are enabled globally
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  // 2. Validate HTTP method
  const methodCheck = assertAllowedMethod(req, ['POST']);
  if (methodCheck) return methodCheck;

  // 3. Verify user has write permission
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  // 4. Create audit context for logging
  const audit = await createAuditContext(req);

  try {
    // 5. Business logic (future implementation)
    // ...

    return NextResponse.json({ success: true });
  } catch (error) {
    // 6. Sanitize errors before returning to client
    return sanitizeWriteError(error);
  }
}
```

## Environment Configuration

| Variable | Side | Default | Purpose |
|----------|------|---------|---------|
| `WRITES_ENABLED` | Server | `false` | Authoritative gate — blocks all write API requests when disabled |
| `NEXT_PUBLIC_WRITES_ENABLED` | Client | `false` | UI display flag — shows read-only notice when disabled |

Both flags default to `false`. Writes are completely disabled until explicitly enabled by setting both to `true`.

**`WRITES_ENABLED`** is the authoritative server-side enforcement mechanism. Even if the client flag is enabled, the server will reject write requests unless `WRITES_ENABLED=true`.

## Enabling Writes (Future)

When ready to enable write operations:

1. Set `WRITES_ENABLED=true` in the server environment
2. Set `NEXT_PUBLIC_WRITES_ENABLED=true` for client UI
3. Implement the actual write route handlers using the composition pattern above
4. Test thoroughly in a non-production environment first
5. Deploy with monitoring and the ability to quickly revert by setting flags back to `false`

## Technical Notes

- All functions are pure JavaScript (`.js`) — no TypeScript
- The module uses `import 'server-only'` to prevent client-side bundling
- Auth helpers are imported read-only — the `@/lib/auth` module is not modified
- No database mutations, no real write endpoints, no workflow logic
