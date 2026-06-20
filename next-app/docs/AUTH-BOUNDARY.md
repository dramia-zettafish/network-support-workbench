# Auth Boundary — Interim Production Authentication

## Overview

This is an interim authentication and authorization boundary for the EUS Support Next.js app. It provides real credential-based auth suitable for controlled production testing while keeping the architecture ready for future Cisco Duo MFA integration.

## Architecture

### Provider-Based Auth

The auth system uses a pluggable provider pattern controlled by `AUTH_PROVIDER` env var:

| Provider | Value | Purpose | Production? |
|----------|-------|---------|-------------|
| Mock | `mock` | Dev/test — always returns mock user | **Rejected** in production |
| Legacy | `legacy` | Interim — bcrypt auth against `auth_users` table | ✅ Production-safe |
| Duo | `duo` | Future — Cisco Duo MFA (not yet implemented) | Future |

### Fail-Closed Behavior

- In production (`NODE_ENV=production`), `AUTH_PROVIDER=mock` is rejected — all requests fail as unauthenticated.
- Unknown provider values fail closed (no fallback to mock).

## Session / Cookie Behavior

- Sessions are stored in a signed HTTP-only cookie (`eus_session`).
- Signing uses HMAC-SHA256 with `SESSION_SECRET` env var.
- Cookie flags: `httpOnly`, `sameSite=lax`, `secure` (in production), `path=/`.
- Default session lifetime: 8 hours (configurable via `SESSION_MAX_AGE_SECONDS`).
- No data stored in localStorage or sessionStorage.
- No JWT — the cookie IS the session token (signed payload with uid, username, role, iat, exp).

## Login / Logout

- **Login page**: `/login`
- **Login API**: `POST /api/auth/login` — accepts `{ username, password }`, sets session cookie.
- **Logout API**: `POST /api/auth/logout` — clears session cookie.
- **Current user**: `GET /api/auth/me` — returns safe user fields (no password hash, no secrets).

## Protected Routes

### Pages (redirect to /login if unauthenticated)

- `/inventory`
- `/cases` and `/cases/[id]`
- `/logistics`, `/logistics/upload`, `/logistics/technician`, `/logistics/data-management`
- `/protected`

### APIs (return 401 if unauthenticated)

- `/api/cases/*`
- `/api/parts`
- `/api/stock`
- `/api/logistics/*`
- `/api/reference/*`
- `/api/db-health`

### Public (no auth required)

- `/login`
- `/api/health`
- `/api/auth/*`
- `/api/env-label`
- `/api/write-safety/status`

## Write Safety Integration

Write routes require BOTH:
1. Authenticated user (via session cookie)
2. Write-safety guard (`WRITES_ENABLED=true`)

The auth boundary does not weaken write safety.

## Role / Team Behavior

### Current Implementation

- Roles come from `auth_users.role` column (admin, supervisor, technician, viewer).
- Team memberships come from `user_teams` junction table → `teams.key`.
- Module access is derived from role (see `legacy-provider.js`).
- Authorization helpers (`requireRole`, `requireTeamAccess`) work with any provider.

### Deferred

- Granular per-route role enforcement (currently: authenticated-only guard).
- Role hierarchy enforcement.
- Team-based page restrictions.

## Production Environment Expectations

```env
NODE_ENV=production
AUTH_PROVIDER=legacy
SESSION_SECRET=<64+ char random hex string>
SESSION_MAX_AGE_SECONDS=28800
DATABASE_URL=postgresql://...
```

## Dev / Mock Restrictions

- `AUTH_PROVIDER=mock` only works when `NODE_ENV !== 'production'`.
- In mock mode, any credentials are accepted (no DB call).
- Mock mode is for local development and testing only.

## Known Limitations

1. No password reset / user management UI (use existing Python admin or direct DB).
2. No CSRF token (mitigated by SameSite=lax cookie + JSON body requirement).
3. No rate limiting on login endpoint (add at reverse proxy layer).
4. Session is not revocable server-side without changing SESSION_SECRET (acceptable for interim).
5. Role/team enforcement is authenticated-only for now (no per-route role gates in middleware).

## Duo Integration Plan / Seam

When Cisco Duo is ready:

1. Implement `providers/future-duo-provider.js`:
   - Validate Duo-issued tokens/sessions from request.
   - Map Duo groups → app roles and teams.
   - Provide SSO session management.

2. Set `AUTH_PROVIDER=duo` in production.

3. The login flow changes:
   - `/login` redirects to Duo SSO.
   - Duo callback sets session cookie.
   - `resolveUser()` validates Duo session.

4. No changes needed to:
   - Middleware (still checks session cookie).
   - Authorization helpers (still use user.role, user.teams).
   - Protected pages/APIs (still use requireAuth).

5. The legacy provider can remain available as a fallback during transition.

## Production Readiness Checklist

- [x] Real credential verification (bcrypt against DB)
- [x] Secure session cookies (httpOnly, signed, secure in prod)
- [x] Mock auth rejected in production
- [x] Protected pages redirect to login
- [x] Protected APIs return 401
- [x] No secrets exposed in responses
- [x] No password hashes in responses
- [x] Write safety preserved
- [x] Provider-based architecture for Duo swap
- [ ] Rate limiting (add at reverse proxy)
- [ ] CSRF protection (low risk with SameSite + JSON)
- [ ] Session revocation (acceptable limitation for interim)
