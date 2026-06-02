# EUSupport Alignment Notes

## Current Standalone Purpose

Network Vcode remains a standalone local/Tailscale-hosted Next.js and PostgreSQL app for network operations. It keeps the existing operations dashboard, ticket workflow, device-response workflow, and UPS installation workflow.

## Why It Stays Standalone

This pass prepares the app for a future EUSupport `/network` module without taking on the full EUSupport auth, database, deployment, or business-workflow surface today. Local Docker Compose and Caddy remain the intended runtime.

The future merge reason is specific: use EUSupport Duo NG/session authentication for field and network work, share the server-side deployment boundary, and keep Network Vcode's network operations workflows under one roof.

## What Was Aligned

- Replaced the primary left-sidebar frame with an EUSupport-style top navigation shell.
- Added workspace framing for `Network Technician`.
- Set primary modules to `Dashboard`, `Tickets`, and `UPS`. NOC/device response work remains inside the ticket workflow instead of a separate primary module.
- Added Tailwind foundation files and EUSupport-compatible design tokens while preserving existing Network Vcode CSS variables.
- Added a standalone-safe auth seam at `GET /api/auth/me`.
- Made the frontend API base configurable through `NEXT_PUBLIC_NETWORK_API_BASE`, defaulting to `/api`.
- Added route-level pages for the standalone module paths.

## What Was Intentionally Not Copied

- EUSupport Cases workflows.
- Logistics workflows.
- Inventory workflows.
- Import Tools as primary navigation.
- Real Duo NG auth enforcement.
- EUSupport auth APIs, cookies, or database-backed sessions.

## Auth Boundary

Standalone now:

```text
GET /api/auth/me -> local/mock Network Team current user
```

The current user shape lives in `frontend/lib/auth/currentUser.js` and returns:

```text
username: Network Team
role: technician
teams: network_technicians
authProvider: local
```

Future merge:

```text
EUSupport Duo NG/session current user replaces the local/mock resolver.
```

`frontend/lib/auth/providers/future-duo-provider.js` is a placeholder seam only. It is not imported by standalone mode.

## Current Standalone Routes

```text
/              -> Network Vcode dashboard / operations overview
/tickets       -> Network tickets/work orders
/ups           -> UPS workflow
```

`/noc-responses` was removed after review because it only duplicated the ticket response workflow. `/field` was not added because no real field workflow was scaffolded in this pass.

## Future EUSupport Routes

```text
/network               -> Network Vcode dashboard / operations overview
/network/tickets       -> Network tickets/work orders
/network/ups           -> UPS workflow
/network/field         -> field workflow behind Duo NG, if needed
```

`NEXT_PUBLIC_NETWORK_ROUTE_PREFIX` can be used later to help the shell generate prefixed module links only. It does not replace the future structural move to EUSupport's `app/network` route tree.

## API Routes

Current API routes remain under `/api/*`:

```text
/api/auth/me
/api/tickets
/api/tickets/{ticket_number}
/api/tickets/{ticket_number}/response
/api/ticket-responses/{ticket_number}
/api/ups-installations
/api/ups-installations/{ups_installation_id}
/api/ups-installations/{ups_installation_id}/phase2
/api/ups-installations/{ups_installation_id}/phase3-schedule
/api/ups-installations/{ups_installation_id}/phase3-warehouse
/api/ups-installations/{ups_installation_id}/phase3-devices
/api/ups/schedule
/api/ups/schedule/custom
/api/ups/{ups_installation_id}/rollback
```

Recommended future EUSupport API namespace:

```text
/api/network/tickets
/api/network/ups-installations
/api/network/ticket-responses
/api/network/dashboard-summary
```

This pass did not move API routes to `/api/network/*` because the standalone callers already work against `/api`, and the safer near-term change is configurable API base handling.

## Database Naming Risks

No tables or enum types were renamed in this pass.

Future same-database merge risks include generic names such as:

```text
tickets
status
priority
device_type
```

Future-safe options:

```text
network_tickets
network_ups_installations
network_device_responses
network_rmas
network_ticket_status
network_priority
network_device_type
```

Or keep Network Vcode in a dedicated database schema:

```text
network_vcode.tickets
network_vcode.ups_installations
```

## Smoke Test Results

Completed on June 1, 2026:

```text
npm run build -> passed
npm run lint -> not configured; package.json has no lint script
docker compose up --build -d -> passed
GET http://127.0.0.1:8080/ -> 200
GET http://127.0.0.1:8080/tickets -> 200
GET http://127.0.0.1:8080/ups -> 200
GET http://127.0.0.1:8080/api/auth/me -> 200
GET http://127.0.0.1:8080/api/tickets?limit=1&offset=0 -> 200
GET http://127.0.0.1:8080/api/ups-installations?limit=1&offset=0 -> 200
```

The existing Docker anonymous `node_modules` volume had to be recreated once after adding Tailwind dependencies. After that refresh, the standard `docker compose up --build -d` path and Caddy smoke tests passed.

## Follow-Ups

- Decide whether future EUSupport merge should use route-prefix deployment or move files under `app/network`.
- Add `/field` only if a real field workflow is defined.
- Add actual middleware gates only when EUSupport Duo NG/session auth is being introduced.
