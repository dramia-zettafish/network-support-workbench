# EUSupport Network Workbench Handoff

## Current State

EUSupport is now the parent application for the Network Workbench. The standalone Network Workbench source has been absorbed into the EUSupport Next.js app instead of running as its own deployed frontend.

The hosted module lives at:

- `next-app/app/network/*` for pages
- `next-app/app/api/network/*` for API routes
- `next-app/network-workbench/*` for migrated workbench UI, repositories, helpers, and scoped styles
- `network-workbench-db/*` for the Network Workbench database schema and patches

The old standalone route shape was `/`, `/tickets`, `/ups`, and `/api/*`. The EUSupport-hosted route shape is `/network`, `/network/tickets`, `/network/ups`, and `/api/network/*`.

## How EUSupport Absorbs Network Workbench

Network Workbench is no longer a separate app shell. EUSupport owns the page layout, auth boundary, route gating, and deployment process. The workbench-specific screens are imported into EUSupport pages from `next-app/network-workbench/components`.

Network database access is intentionally separate from the EUSupport inventory/case database:

- EUSupport core database uses `DATABASE_URL`.
- Network Workbench database uses `NETWORK_DATABASE_URL`.
- `next-app/network-workbench/lib/db.js` fails closed if `NETWORK_DATABASE_URL` is missing, so network routes cannot accidentally fall back to the EUSupport database.

The browser-side Network Workbench API base is:

```text
NEXT_PUBLIC_NETWORK_API_BASE=/api/network
```

The route prefix is:

```text
NEXT_PUBLIC_NETWORK_ROUTE_PREFIX=/network
```

## Files To Keep

Keep the EUSupport app and the integrated network module:

- `EUSupport-main/next-app`
- `EUSupport-main/migrations`
- `EUSupport-main/network-workbench-db`
- `EUSupport-main/local/docker`
- `EUSupport-main/docker-compose.local.yml`
- `EUSupport-main/LOCAL_NETWORK_TESTING.md`
- `EUSupport-main/next-app/scripts/import-ups-history`
- `EUSupport-main/next-app/scripts/import-network-workbench-live-data.js`

The root-level zip files, local dependency folders, `.next` build output, checked-out standalone Network Workbench donor tree, and local `.env.local` files are cleanup artifacts and should not be committed.

## Potential Conflicts

### Git repository boundary

This folder was found inside a parent Git repository for `ZettaFish/zettafish-web`. Do not push the EUSupport/network merge into that remote by accident. The intended EUSupport remote should be confirmed before pushing to `main`.

### Auth and team access

`/network` and `/api/network/*` are protected by the EUSupport middleware. Network access currently maps to the `network_technicians` team, with manager/supervisor visibility bypass on page routes. Local test users are seeded by:

```sh
cd EUSupport-main/next-app
npm run seed:local-network-users
```

### Database naming

The Network Workbench schema still uses its original table and enum names, such as `tickets`, `ups_installations`, `status`, and `priority`. Keeping it behind `NETWORK_DATABASE_URL` avoids immediate conflicts. If Network Workbench is later moved into the same physical database as EUSupport, rename or schema-qualify the network objects first.

Recommended future-safe names:

- `network_tickets`
- `network_ups_installations`
- `network_device_responses`
- `network_rmas`
- `network_ticket_status`
- `network_priority`

An alternate safe approach is a dedicated PostgreSQL schema such as `network_workbench.tickets`.

### API route collisions

The standalone app used generic API paths like `/api/tickets` and `/api/ups-installations`. EUSupport must continue using `/api/network/*` so future EUSupport APIs do not collide with workbench resources.

### Local seed data

The local Docker stack restores the sanitized EUSupport dump from the parent folder:

```text
../inventory_dev_sanitized_20260513_194234.dump
```

That dump is local seed data, not source code. It should stay untracked. If the dump is removed from a workstation, local EUSupport DB startup will need a replacement sanitized dump or an updated initialization path.

### Legacy donor app

The standalone `network-support-workbench-main` tree is no longer needed after the integrated EUSupport copy is verified. Its database schema and patches already exist under `EUSupport-main/network-workbench-db`, and its UPS history import CSV is kept under `EUSupport-main/next-app/scripts/import-ups-history`.

## Validation Checklist

From `EUSupport-main/next-app`:

```sh
npm install
npm run validate:db-readonly
npm run validate:write-safety
npm run validate:auth-safety
npm run validate:production-readiness
npm run build
```

For local Docker testing, from `EUSupport-main`:

```sh
cp .env.local.example .env.local
docker compose --env-file .env.local -f docker-compose.local.yml up -d --build
docker compose --env-file .env.local -f docker-compose.local.yml exec nextjs_dev npm run seed:local-network-users
```

Then verify:

- `/network`
- `/network/tickets`
- `/network/ups`
- `/api/network/tickets`
- browser calls do not hit old standalone paths like `/api/tickets`

## Latest Local Validation

Run on June 19, 2026 after cleanup:

- `npm ci` passed after allowing npm registry access.
- `npm run build` passed.
- `npm run validate:production-readiness` passed with 13 checks.
- `npm run validate:db-readonly` failed with existing write-route findings. The app now has approved operational write surfaces, so this validator needs its allowlist reconciled before it can be used as a release gate again.
- `npm run validate:write-safety` failed with existing write-route and client write-call findings for admin, inventory, cases, logistics, messages, and other operational modules. Treat this as an allowlist/policy mismatch unless the target release is meant to be read-only.
- `npm run validate:auth-safety` failed on two `password_hash` references: `app/api/admin/users/[username]/password/route.js` and `app/api/auth/change-password/route.js`.
- npm audit reported 9 dependency findings: 3 moderate and 6 high.

## Handoff Notes

Production rollout should treat Network Workbench as an EUSupport module, not as a second web app. Keep the database split until table naming is made future-safe or moved into an explicit PostgreSQL schema. Confirm the real EUSupport Git remote before pushing to `main`; the current parent repository remote in this workspace points to `ZettaFish/zettafish-web`, which appears unrelated to this handoff.
