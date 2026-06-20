import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    await query(`ALTER TABLE cm_programs ADD COLUMN IF NOT EXISTS service_fee TEXT`).catch(() => {});
    const rows = await query(`SELECT id, name, is_active, service_fee, created_at FROM cm_programs ORDER BY name ASC`);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load programs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { name } = await request.json();
    if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 422 });
    await withTransaction(async (client) => {
      await client.query(`INSERT INTO cm_programs (name) VALUES ($1)`, [name.trim()]);
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.message?.includes('unique') || err.code === '23505') return Response.json({ error: 'Program already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create program' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { id, name, is_active, service_fee } = await request.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 422 });
    await withTransaction(async (client) => {
      if (name !== undefined) await client.query(`UPDATE cm_programs SET name = $1 WHERE id = $2`, [name.trim(), id]);
      if (is_active !== undefined) await client.query(`UPDATE cm_programs SET is_active = $1 WHERE id = $2`, [is_active, id]);
      if (service_fee !== undefined) await client.query(`UPDATE cm_programs SET service_fee = $1 WHERE id = $2`, [service_fee || null, id]);
    });
    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to update program' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 422 });
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM cm_programs WHERE id = $1`, [id]);
    });
    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to delete program' }, { status: 500 });
  }
}
