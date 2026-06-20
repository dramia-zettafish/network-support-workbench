// Read-only parts query endpoint.
// Source table: parts_catalog

import { query } from '@/lib/db.js';
import { validateTableName } from '@/lib/db-read-queries.js';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PARTS_TABLE = 'parts_catalog';

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
    validateTableName(PARTS_TABLE);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let sql;
    const params = [];

    if (search) {
      sql = `SELECT part_no, description, active FROM parts_catalog WHERE COALESCE(active, 1) <> 0 AND (part_no ILIKE $1 OR description ILIKE $1)`;
      params.push(`%${search}%`);
    } else {
      sql = `SELECT part_no, description, active FROM parts_catalog WHERE COALESCE(active, 1) <> 0`;
    }

    const rows = await query(sql, params);
    return Response.json({ data: rows });
  } catch (err) {
    return Response.json({ error: 'Unable to retrieve parts data' }, { status: 500 });
  }
}
