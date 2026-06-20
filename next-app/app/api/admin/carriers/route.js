import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

/** GET /api/admin/carriers — list shipping carriers */
export async function GET(req) {
  await requireRole(['manager'], req);
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();

  const where = search ? `WHERE lower(name) LIKE lower($1)` : '';
  const params = search ? [`%${search}%`] : [];

  const rows = await query(`SELECT id, name FROM ops_shipping_carriers ${where} ORDER BY name ASC`, params);
  return NextResponse.json({ data: rows });
}

/** POST /api/admin/carriers — create a carrier */
export async function POST(req) {
  await requireRole(['manager'], req);
  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });

  const result = await withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM ops_shipping_carriers WHERE lower(name) = lower($1)`, [name]);
    if (existing.rows.length > 0) return { duplicate: true };
    const res = await client.query(
      `INSERT INTO ops_shipping_carriers (name) VALUES ($1) RETURNING id, name`,
      [name]
    );
    return res.rows[0];
  });

  if (result?.duplicate) return NextResponse.json({ error: 'Carrier already exists' }, { status: 409 });
  return NextResponse.json({ ok: true, carrier: result });
}
