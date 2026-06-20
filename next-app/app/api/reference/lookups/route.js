// Consolidated read-only reference data endpoint.
import { requireAuth } from '@/lib/auth';
import { getAllUsers, getAllTeams } from '@/lib/db-reference-queries.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);

    const results = await Promise.allSettled([getAllUsers(), getAllTeams()]);
    const data = {
      users: results[0].status === 'fulfilled' ? results[0].value : null,
      teams: results[1].status === 'fulfilled' ? results[1].value : null,
    };

    if (data.users === null && data.teams === null) {
      console.error('[api/reference/lookups] Both queries failed:', results[0].reason?.message, results[1].reason?.message);
      return Response.json({ error: 'Unable to retrieve reference data' }, { status: 500 });
    }

    return Response.json({ data, meta: { users: results[0].status === 'fulfilled' ? 'ok' : 'unavailable', teams: results[1].status === 'fulfilled' ? 'ok' : 'unavailable' } });
  } catch (err) {
    if (err.unauthorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.digest?.startsWith('DYNAMIC_SERVER_USAGE')) throw err;
    console.error('[api/reference/lookups] ERROR:', err.stack || err.message);
    return Response.json({ error: err.message || 'Unable to retrieve reference data' }, { status: 500 });
  }
}
