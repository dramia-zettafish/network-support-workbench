import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

/** GET /api/admin/manufacturers — list RMA manufacturers */
export async function GET(req) {
  await requireRole(['manager'], req);
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();

  const where = search ? `WHERE lower(name) LIKE lower($1)` : '';
  const params = search ? [`%${search}%`] : [];

  const rows = await query(
    `SELECT id, name, validation_status, workflow_key, created_at, updated_at FROM cm_rma_manufacturers ${where} ORDER BY lower(name) ASC`,
    params
  );
  return NextResponse.json({ data: rows });
}

/** POST /api/admin/manufacturers — create a manufacturer */
export async function POST(req) {
  await requireRole(['manager'], req);
  const body = await req.json();
  const name = (body.name || '').trim();
  const workflow_key = (body.workflow_key || '').trim() || null;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });

  const result = await withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM cm_rma_manufacturers WHERE lower(name) = lower($1)`, [name]);
    if (existing.rows.length > 0) return { duplicate: true };
    const res = await client.query(
      `INSERT INTO cm_rma_manufacturers (name, workflow_key, validation_status, created_at, updated_at)
       VALUES ($1, $2, 'approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, workflow_key, validation_status, created_at, updated_at`,
      [name, workflow_key]
    );
    return res.rows[0];
  });

  if (result?.duplicate) return NextResponse.json({ error: 'Manufacturer already exists' }, { status: 409 });
  return NextResponse.json({ ok: true, manufacturer: result });
}
