# Runbook Renderer Handoff

## Summary

This work restores the Next.js runbook renderer toward parity with the legacy Python/static runbook UI.

The legacy implementation used React Flow and Dagre from (now removed, see tag `pre-python-removal-20260615`):

- `dev/app/process-flows/src/index.jsx`
- `dev/app/process-flows/src/process-flows.css`
- `dev/app/static/process-flows.bundle.js`
- `dev/app/static/processFlows/*.json`

The previous Next.js detail page used a custom absolute-position/SVG renderer. That caused differences in viewport behavior, minimap behavior, canvas sizing, branch layout, and edge routing. The new implementation ports the legacy React Flow model into Next.js and keeps the process JSON contract intact.

## Main Changes

- Added React Flow/Dagre dependencies to the Next app.
- Added route-level React Flow CSS import for runbook pages.
- Added legacy process-flow CSS into the Next runbook route.
- Replaced the custom Next.js SVG renderer with a React Flow/Dagre renderer.
- Preserved legacy node types: action, decision, note, junction.
- Preserved legacy decision branch behavior using hidden junction nodes.
- Preserved legacy edge behavior: smoothstep normal edges, straight dashed annotation edges.
- Restored minimap, zoom, pan, fit, and viewport behavior through React Flow.
- Restored step-list generation behavior from the legacy implementation.
- Restored screenshot lookup by step first, then node fallback.
- Removed the constrained detail-page container so the flow can use more viewport width.
- Tuned final canvas/sidebar/minimap spacing to better match the legacy UI.
- Updated runbook process API response handling and team visibility normalization.

## Focus Files

These are the files intended for team-lead review:

- `next-app/app/api/runbook/processes/route.js`
- `next-app/app/runbook/runbook-client.jsx`
- `next-app/app/runbook/[id]/detail-client.jsx`
- `next-app/app/runbook/[id]/page.jsx`
- `next-app/app/runbook/layout.jsx`
- `next-app/app/runbook/process-flows.css`
- `next-app/package.json`
- `next-app/package-lock.json`

## Dev-Only Files To Ignore

These were touched during local mock-auth/Docker verification and are not part of the product handoff:

- `docker-compose.dev.yml`
- `next-app/middleware.js`

## Verification

Local mock-auth verification was done through:

- `http://localhost:18004/runbook`
- `http://localhost:18004/runbook/receiving-parts`
- `http://localhost:18004/runbook/issuing-stock-parts`

Representative detail routes returned `200`.

`npm run build` compiled successfully, then failed only at the known production guard because `AUTH_PROVIDER=mock` is intentionally blocked in production builds.

## Return Point

A known-good local checkpoint exists:

- Commit: `975a2ec`
- Tag: `checkpoint/runbook-renderer-good-2026-05-14`

Use that tag if the final spacing/API/list tweaks need to be compared or reverted.
