// Read-only teams reference data endpoint.
// GET only — no POST, PUT, PATCH, DELETE handlers.

import { requireAuth } from '@/lib/auth';
import { getAllTeams } from '@/lib/db-reference-queries.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
  } catch (err) {
    if (err.unauthorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const teams = await getAllTeams();
    return Response.json({ data: teams });
  } catch (err) {
    return Response.json({ error: 'Unable to retrieve team reference data' }, { status: 500 });
  }
}
