import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';

/** PATCH /api/admin/carriers/[id] — update carrier name */
export async function PATCH(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;
  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });

  const result = await withTransaction(async (client) => {
    const dup = await client.query(`SELECT id FROM ops_shipping_carriers WHERE lower(name) = lower($1) AND id != $2`, [name, id]);
    if (dup.rows.length > 0) return { duplicate: true };
    const res = await client.query(
      `UPDATE ops_shipping_carriers SET name = $1 WHERE id = $2 RETURNING id, name`,
      [name, id]
    );
    return res.rows[0] || null;
  });

  if (result?.duplicate) return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, carrier: result });
}

/** DELETE /api/admin/carriers/[id] */
export async function DELETE(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM ops_shipping_carriers WHERE id = $1`, [id]);
  });

  return NextResponse.json({ ok: true });
}
