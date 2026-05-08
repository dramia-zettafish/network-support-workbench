# Frontend Framework Migration Notes

These notes document the approach used to move the project from the original FastAPI-served vanilla frontend to a separate Next.js frontend. Keep this as a reusable playbook for future framework migrations.

## Final Shape

```text
repo/
  app/                 FastAPI backend
  frontend/            Next.js frontend
  caddy/Caddyfile      Browser entrypoint and API proxy
  docker-compose.yml   Local stack
```

The important decision was to keep the backend stable while introducing the new frontend beside it. The frontend can change frameworks again later as long as the API and proxy contract stay consistent.

## Migration Rules That Worked

- Keep FastAPI routes, schemas, models, and migrations unchanged unless the workflow itself requires backend changes.
- Keep the frontend in its own root-level folder.
- Route browser traffic through Caddy during normal testing.
- Have the frontend call backend routes through `/api/*`.
- Let Caddy strip `/api` and proxy requests to FastAPI.
- Port one workflow at a time instead of redesigning everything during the framework migration.
- Use branches as checkpoints before each larger UI or workflow pass.

## Recommended Migration Order

1. Create the new frontend app beside the existing backend.
2. Add the frontend service to `docker-compose.yml`.
3. Update Caddy so `/api/*` routes to FastAPI and everything else routes to the frontend.
4. Port the global CSS variable system and shared base styles.
5. Migrate the smallest critical workflow first to prove API communication.
6. Add the shared app shell and navigation only after the first workflow works.
7. Bring remaining workflows over one at a time.
8. Commit and push a checkpoint branch after each stable milestone.

## Branch Checkpoint Pattern

The branch pattern used here was:

- `v3`: legacy stable app.
- `nextjs-baseline`: completed framework migration snapshot.
- `networking-workspace`: active redesign branch after the baseline.
- Feature branches for each workflow slice.

For future migrations, create a baseline branch immediately after the new framework can build, run in Docker, and communicate with the backend through the proxy.

## API Proxy Contract

Frontend code should call:

```text
/api/tickets/
/api/rmas/
/api/ups-installations/
```

Caddy forwards those to FastAPI as:

```text
/tickets/
/rmas/
/ups-installations/
```

This keeps frontend code framework-neutral. If Next.js is replaced later, the new frontend should keep using `/api/*` unless the deployment architecture changes.

## Verification Checklist

Run these checks before treating a migration checkpoint as stable:

```powershell
docker compose exec -e NODE_ENV=production frontend npm run build
docker compose exec frontend npm audit --omit=dev
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:8080/
Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/tickets/?limit=1&offset=0"
```

For workflow-specific branches, also verify the relevant API path through Caddy. Example:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/ups-installations/?status=fulfilled&limit=1&offset=0"
```

## Lessons Learned

- The safest migration path is framework first, redesign second.
- Keeping Caddy as the single browser entrypoint made local testing match the intended deployment shape.
- Shared UI components should be introduced after at least one real workflow is working.
- Workflow migration is easier when split into small branches: foundation, creation/listing, modal editing, email/clipboard helpers, completion.
- README files should describe the current branch state, while this doc should preserve the migration method.

