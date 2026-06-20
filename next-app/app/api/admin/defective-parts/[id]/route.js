import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';

export async function PATCH(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;
  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });
  const result = await withTransaction(async (client) => {
    const dup = await client.query(`SELECT id FROM cm_defective_parts_catalog WHERE lower(name) = lower($1) AND id != $2`, [name, id]);
    if (dup.rows.length > 0) return { duplicate: true };
    const res = await client.query(`UPDATE cm_defective_parts_catalog SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name`, [name, id]);
    return res.rows[0] || null;
  });
  if (result?.duplicate) return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, part: result });
}

export async function DELETE(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;
  await withTransaction(async (client) => { await client.query(`DELETE FROM cm_defective_parts_catalog WHERE id = $1`, [id]); });
  return NextResponse.json({ ok: true });
}
