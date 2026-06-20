// Read-only stock/inventory query endpoint.
// Source tables: inventory LEFT JOIN parts_catalog

import { query } from '@/lib/db.js';
import { validateTableName } from '@/lib/db-read-queries.js';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const INVENTORY_TABLE = 'inventory';
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
    validateTableName(INVENTORY_TABLE);
    validateTableName(PARTS_TABLE);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let sql;
    const params = [];

    const pool = searchParams.get('pool') || '';

    const baseSql = `SELECT inventory.part_no, COALESCE(NULLIF(inventory.description, ''), parts_catalog.description) AS description, inventory.qty_on_hand, inventory.location, inventory.inventory_pool, parts_catalog.active FROM inventory LEFT JOIN parts_catalog ON inventory.part_no = parts_catalog.part_no WHERE COALESCE(parts_catalog.active, 1) <> 0`;

    if (search && pool) {
      sql = `${baseSql} AND (inventory.part_no ILIKE $1 OR parts_catalog.description ILIKE $1) AND inventory.inventory_pool = $2`;
      params.push(`%${search}%`, pool);
    } else if (search) {
      sql = `${baseSql} AND (inventory.part_no ILIKE $1 OR parts_catalog.description ILIKE $1)`;
      params.push(`%${search}%`);
    } else if (pool) {
      sql = `${baseSql} AND inventory.inventory_pool = $1`;
      params.push(pool);
    } else {
      sql = baseSql;
    }

    const rows = await query(sql, params);
    return Response.json({ data: rows });
  } catch (err) {
    return Response.json({ error: 'Unable to retrieve stock data' }, { status: 500 });
  }
}
