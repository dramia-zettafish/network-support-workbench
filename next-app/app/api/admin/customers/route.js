import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

/** GET /api/admin/customers — list customer catalog with search/pagination */
export async function GET(req) {
  await requireRole(['manager'], req);
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const where = search ? `WHERE lower(name) LIKE lower($1)` : '';
  const params = search ? [`%${search}%`] : [];

  const countRes = await query(`SELECT COUNT(*) as total FROM cm_customer_catalog ${where}`, params);
  const total = parseInt(countRes[0]?.total || '0', 10);

  const dataParams = search ? [`%${search}%`, limit, offset] : [limit, offset];
  const rows = await query(
    `SELECT id, name, validation_status, created_at, updated_at FROM cm_customer_catalog ${where} ORDER BY lower(name) ASC LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}`,
    dataParams
  );

  return NextResponse.json({ items: rows, total, limit, offset });
}

/** POST /api/admin/customers — create a customer */
export async function POST(req) {
  await requireRole(['manager'], req);
  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });

  const result = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO cm_customer_catalog (name, validation_status, created_at, updated_at)
       VALUES ($1, 'approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, validation_status, created_at, updated_at`,
      [name]
    );
    return res.rows[0];
  });

  return NextResponse.json({ ok: true, customer: result });
}
