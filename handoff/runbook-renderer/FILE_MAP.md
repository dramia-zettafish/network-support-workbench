# Runbook Renderer File Map

## API

### `next-app/app/api/runbook/processes/route.js`

Purpose:
- Loads runbook process metadata from `public/static/processFlows/index.json`.
- Filters visible documents based on user/team visibility.
- Supports manager updates to runbook document team visibility.

Important changes:
- Normalizes team names consistently.
- Handles the legacy `Parts Administration` / `Parts Administrators` label mismatch.
- Returns a plain array response for process lists, matching the legacy static app behavior.
- Stores team visibility as JSON arrays instead of comma-joined text.

## List Page

### `next-app/app/runbook/runbook-client.jsx`

Purpose:
- Renders the runbook process list.
- Links each process to `/runbook/[id]`.

Important changes:
- Accepts either a plain array response or older `{ data: [...] }` response shape.

## Detail Page

### `next-app/app/runbook/[id]/page.jsx`

Purpose:
- Server page wrapper for a runbook process detail.

Important changes:
- Removed the narrow shared `.container` wrapper so the flowchart can use the available viewport.

### `next-app/app/runbook/[id]/detail-client.jsx`

Purpose:
- Client renderer for process detail, flowchart view, step-list view, details panel, minimap, zoom/pan/fit behavior, and screenshots.

Important changes:
- Ports the legacy React Flow/Dagre model into Next.js.
- Uses Dagre to lay out the graph.
- Preserves action, decision, note, and junction nodes.
- Rewrites decision split edges through hidden junction nodes for legacy branch routing.
- Uses React Flow for pan, zoom, minimap, fit bounds, edge routing, labels, and markers.
- Preserves legacy step-list traversal and conditional IF/ELSE rendering.
- Preserves screenshot lookup from `media.steps` first and `media.nodes` fallback.
- Fine-tunes final canvas/sidebar/minimap spacing for better viewport usage.

## Route Styles

### `next-app/app/runbook/layout.jsx`

Purpose:
- Imports React Flow base styles and runbook-specific process flow styles for the runbook route.

### `next-app/app/runbook/process-flows.css`

Purpose:
- Carries over the legacy process-flow styling.
- Defines node, edge, drawer, minimap, zoom panel, step-list, screenshot, and responsive layout styles.

Important changes:
- Light-mode minimap and zoom controls.
- Wider page usage.
- Slimmer side panel.
- Larger canvas viewport.
- Reduced unnecessary outer padding/gaps.

## Dependencies

### `next-app/package.json`

Purpose:
- Adds dependencies needed to restore legacy rendering behavior.

Added:
- `@xyflow/react`
- `dagre`

### `next-app/package-lock.json`

Purpose:
- Locks the dependency graph for the new React Flow/Dagre packages.
