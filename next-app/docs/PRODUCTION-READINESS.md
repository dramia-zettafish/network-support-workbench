# Production Readiness — EUS Support Next.js App

> Last reviewed: 2026-05-11 (branch: feature/nextjs-production-readiness-checkpoint)

## Module Status

| Module | Status | Notes |
|--------|--------|-------|
| RMA Case Management | ✅ Functionally complete | Read, detail, save, notifications |
| Logistics | ✅ Functionally complete | Upload, parse, technician submissions, chamber, correction, closeout |
| Auth (Interim) | ✅ Production-safe | Legacy bcrypt provider; Duo deferred |
| Write Safety | ✅ Enforced | Defaults disabled; gated per-route |
| Inventory (read-only) | ✅ Working | Read-only view of parts/stock |

## Required Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | Yes (set by Next.js) | `development` | Must be `production` in prod |
| `AUTH_PROVIDER` | Yes | `mock` | Set to `legacy` for production |
| `SESSION_SECRET` | Yes | — | Min 32 chars; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SESSION_MAX_AGE_SECONDS` | No | `28800` | 8 hours |
| `DATABASE_URL` or `DB_URL` | Yes | — | PostgreSQL connection string |
| `DB_ALLOWED_TABLES` | Yes | — | Comma-separated table whitelist |
| `WRITES_ENABLED` | No | `false` | Set `true` only when ready |
| `NEXT_PUBLIC_WRITES_ENABLED` | No | `false` | UI display flag |
| `SMTP_HOST` | No | — | Required for email sending |
| `SMTP_PORT` | No | `587` | — |
| `SMTP_SECURE` | No | `false` | — |
| `SMTP_USER` | No | — | — |
| `SMTP_PASS` | No | — | — |
| `SMTP_FROM` | No | — | — |
| `NEXT_PUBLIC_ENV_LABEL` | No | `development` | Shown in UI header |

## Startup / Build Commands

```bash
cd next-app
npm install
npm run build        # Production build
npm run start        # Start production server (port 3000)
npm run dev          # Development server with hot reload
```

## Validation Commands

```bash
npm run validate:db-readonly          # No write SQL in non-approved files
npm run validate:write-safety         # Write routes use guard; no leaks
npm run validate:auth-safety          # No mock in prod; no secrets exposed
npm run validate:production-readiness # Meta-check for production risks
```

All four must pass before deployment.

## Manual Smoke Test Checklist

1. ☐ `npm run build` passes without errors
2. ☐ Login works (`/login` → enter credentials → redirected to dashboard)
3. ☐ Logout works (session cleared, redirected to `/login`)
4. ☐ Protected pages redirect to `/login` when logged out
5. ☐ `/cases` loads after login
6. ☐ RMA case detail loads (`/cases/[id]`)
7. ☐ RMA save works only when `WRITES_ENABLED=true`
8. ☐ Notification preview works (no email sent)
9. ☐ Manual notification send returns success or clear `SMTP_NOT_CONFIGURED` error
10. ☐ `/logistics` loads after login
11. ☐ Workbook upload works when `WRITES_ENABLED=true`
12. ☐ Logistics rows/owners parse correctly from uploaded workbook
13. ☐ Technician submissions work (chamber receives entries)
14. ☐ Data Management — chamber download/clear works
15. ☐ Correction preview works
16. ☐ No hidden automatic email or stage transition occurs

## Auth Checklist

- [x] `AUTH_PROVIDER=mock` rejected in production (`NODE_ENV=production`)
- [x] `AUTH_PROVIDER=legacy` uses bcrypt verification against `auth_users` table
- [x] Unknown provider values fail closed (no fallback)
- [x] Session cookie: `httpOnly`, `secure` (in prod), `sameSite=lax`, signed HMAC-SHA256
- [x] `/api/auth/me` returns only safe fields (id, username, role, teams, modules)
- [x] No password hashes exposed in any API response
- [x] No `process.env` values exposed in any API response
- [x] Middleware protects all pages and APIs (see `middleware.js`)
- [x] Duo integration documented as future replacement (see `AUTH-BOUNDARY.md`)

## Write Safety Checklist

- [x] `WRITES_ENABLED` defaults to `false` — all writes blocked unless explicitly enabled
- [x] `requireWriteEnabled()` returns 403 when disabled
- [x] All 7 approved write routes import the write-safety guard
- [x] `validate:write-safety` script enforces guard usage
- [x] Client-side write fetch calls are validated (no unapproved POST/PUT/PATCH/DELETE)
- [x] No `WRITES_ENABLED=true` in any tracked file
- [x] Rollback: set `WRITES_ENABLED=false` to immediately disable all writes

### Approved Write Routes

1. `app/api/cases/[id]/rma/route.js`
2. `app/api/cases/[id]/notifications/send/route.js`
3. `app/api/cases/[id]/rma/actions/route.js`
4. `app/api/logistics/workbook/upload/route.js`
5. `app/api/logistics/submissions/route.js`
6. `app/api/logistics/submissions/clear/route.js`
7. `app/api/logistics/submissions/undo/route.js`

## SMTP / Notification Checklist

- [x] If `SMTP_HOST` is not configured, send endpoint returns HTTP 503 (not a crash)
- [x] No automatic emails are sent — all sends are manual/explicit
- [x] No automatic stage transitions occur
- [x] Notification preview is read-only (no side effects)

## Logistics Storage Checklist

- [x] Uploaded workbooks stored in `.local-data/logistics/` (gitignored)
- [x] Chamber data stored in `.local-data/logistics/chamber.json` (gitignored)
- [x] Storage path is hardcoded (`process.cwd() + '/.local-data/logistics/'`)
- [x] No uploaded files tracked in git
- [x] Local filesystem storage is documented as interim approach

## Known Limitations

1. **Local filesystem storage** — Logistics workbooks and chamber data use local disk. Not suitable for multi-instance deployments without shared storage.
2. **No rate limiting** — Login endpoint has no rate limiting (add at reverse proxy/F5 layer).
3. **No CSRF token** — Mitigated by `SameSite=lax` cookie + JSON body requirement.
4. **No server-side session revocation** — Changing `SESSION_SECRET` invalidates all sessions (acceptable for interim).
5. **No granular per-route role enforcement** — Middleware checks authentication only, not role-based access per route.
6. **No password reset UI** — Manage users via existing Python admin or direct DB.
7. **Logistics storage path not configurable** — Hardcoded to `.local-data/logistics/`.

## Deferred Work

| Item | Reason | Impact |
|------|--------|--------|
| Cisco Duo MFA integration | Waiting on Duo tenant provisioning | Auth provider swap only; architecture ready |
| Final role/team authorization hardening | Needs business rules finalized | Currently authenticated-only guard |
| Production storage strategy | Local filesystem is interim | Affects multi-instance deployment |
| Final deployment/F5/TLS details | Outside this app branch | Reverse proxy handles TLS termination |
| Rate limiting | Reverse proxy responsibility | Not in app layer |
| User management UI | Low priority for controlled rollout | Use existing admin tools |

## Rollback / Disable Guidance

| Action | How |
|--------|-----|
| Disable all writes | Set `WRITES_ENABLED=false` (immediate, no restart needed if using env reload) |
| Disable email sending | Remove or unset `SMTP_HOST` — send endpoint returns 503 |
| Revert to Python/FastAPI | Keep Python app untouched; switch F5/proxy routing back |
| Invalidate all sessions | Change `SESSION_SECRET` value |
| Block all access | Set `AUTH_PROVIDER` to an unknown value (fails closed) |

## Related Documentation

- `docs/AUTH-BOUNDARY.md` — Auth architecture, session behavior, Duo plan
- `docs/RMA-MODULE-STATUS.md` — RMA case management details
- `docs/LOGISTICS-MODULE-STATUS.md` — Logistics module details
- `docs/LOGISTICS-SUBMISSIONS-AND-CHAMBER.md` — Technician submission flow
- `docs/LOGISTICS-MODULE-FOUNDATION.md` — Logistics foundation design
- `lib/write-safety/README.md` — Write safety pattern and composition
