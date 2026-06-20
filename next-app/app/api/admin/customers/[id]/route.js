import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';

/** PATCH /api/admin/customers/[id] — update customer name */
export async function PATCH(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;
  const body = await req.json();
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });

  const result = await withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE cm_customer_catalog SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, validation_status, updated_at`,
      [name, id]
    );
    return res.rows[0];
  });

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, customer: result });
}

/** DELETE /api/admin/customers/[id] */
export async function DELETE(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM cm_customer_catalog WHERE id = $1`, [id]);
  });

  return NextResponse.json({ ok: true });
}
