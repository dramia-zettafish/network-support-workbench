import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';

/** PATCH /api/admin/manufacturers/[id] — update manufacturer name */
export async function PATCH(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;
  const body = await req.json();
  const name = (body.name || '').trim();
  const workflow_key = body.workflow_key !== undefined ? ((body.workflow_key || '').trim() || null) : undefined;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });

  const result = await withTransaction(async (client) => {
    const dup = await client.query(`SELECT id FROM cm_rma_manufacturers WHERE lower(name) = lower($1) AND id != $2`, [name, id]);
    if (dup.rows.length > 0) return { duplicate: true };
    const setClauses = ['name = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [name];
    let idx = 2;
    if (workflow_key !== undefined) { setClauses.push(`workflow_key = $${idx}`); params.push(workflow_key); idx++; }
    params.push(id);
    const res = await client.query(
      `UPDATE cm_rma_manufacturers SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, name, workflow_key, validation_status, updated_at`,
      params
    );
    return res.rows[0] || null;
  });

  if (result?.duplicate) return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, manufacturer: result });
}

/** DELETE /api/admin/manufacturers/[id] */
export async function DELETE(req, { params }) {
  await requireRole(['manager'], req);
  const { id } = await params;

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM cm_rma_manufacturers WHERE id = $1`, [id]);
  });

  return NextResponse.json({ ok: true });
}
