// Read-only users reference data endpoint.
// GET only — no POST, PUT, PATCH, DELETE handlers.

import { requireAuth } from '@/lib/auth';
import { getAllUsers } from '@/lib/db-reference-queries.js';

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
    const users = await getAllUsers();
    return Response.json({ data: users });
  } catch (err) {
    return Response.json({ error: 'Unable to retrieve user reference data' }, { status: 500 });
  }
}
