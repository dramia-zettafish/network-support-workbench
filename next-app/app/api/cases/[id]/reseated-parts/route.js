import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const rows = await query(`SELECT rp.id, rp.part_name, rp.part_number, rp.created_at, u.display_name as created_by FROM cm_case_reseated_parts rp LEFT JOIN users u ON u.id = rp.created_by_user_id WHERE rp.case_id = $1 ORDER BY rp.created_at DESC`, [id]);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load parts' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { part_name, part_number } = body;
    if (!part_name?.trim()) return Response.json({ error: 'part is required' }, { status: 422 });
    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO cm_case_reseated_parts (id, case_id, part_name, part_number, created_by_user_id, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [crypto.randomUUID(), id, part_name.trim(), part_number?.trim() || null, creator?.id || null]
      );
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to add part' }, { status: 500 });
  }
}
