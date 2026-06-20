import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

export async function GET(req) {
  await requireRole(['manager'], req);
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const where = search ? `WHERE lower(name) LIKE lower($1)` : '';
  const params = search ? [`%${search}%`] : [];
  const rows = await query(`SELECT id, name, is_enabled, created_at, updated_at FROM cm_defective_parts_catalog ${where} ORDER BY lower(name) ASC`, params);
  return NextResponse.json({ data: rows });
}

export async function POST(req) {
  await requireRole(['manager'], req);
  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });
  const result = await withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM cm_defective_parts_catalog WHERE lower(name) = lower($1)`, [name]);
    if (existing.rows.length > 0) return { duplicate: true };
    const res = await client.query(`INSERT INTO cm_defective_parts_catalog (name, created_at, updated_at) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, name`, [name]);
    return res.rows[0];
  });
  if (result?.duplicate) return NextResponse.json({ error: 'Part already exists' }, { status: 409 });
  return NextResponse.json({ ok: true, part: result });
}
