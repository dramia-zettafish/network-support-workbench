import { requireAuth } from '@/lib/auth';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { query } from '@/lib/db.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const rows = await query(`SELECT id, note_type, body, created_at FROM cm_case_notes WHERE case_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [id]);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;

    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { note_type, text, replace } = body;

    if (!note_type?.trim()) return Response.json({ error: 'note_type is required' }, { status: 422 });
    if (!text?.trim()) return Response.json({ error: 'text is required' }, { status: 422 });

    // Verify case exists
    const [caseRow] = await query(`SELECT id FROM cm_cases WHERE id = $1`, [id]);
    if (!caseRow) return Response.json({ error: 'Case not found' }, { status: 404 });

    // Resolve user id
    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);

    await withTransaction(async (client) => {
      if (replace) {
        await client.query(`DELETE FROM cm_case_notes WHERE case_id = $1 AND note_type = $2`, [id, note_type.trim()]);
      }
      await client.query(
        `INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [crypto.randomUUID(), id, note_type.trim(), text.trim(), creator?.id || null]
      );
      await client.query(`UPDATE cm_cases SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.digest?.startsWith('DYNAMIC_SERVER_USAGE')) throw err;
    console.error('[api/cases/[id]/notes POST]', err.stack || err.message);
    return Response.json({ error: 'Failed to add note' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;

    const user = await requireAuth(request);
    if (!['supervisor', 'manager'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('note_id');
    if (!noteId) return Response.json({ error: 'note_id is required' }, { status: 422 });

    const [deleter] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE cm_case_notes SET deleted_at = CURRENT_TIMESTAMP, deleted_by_user_id = $1
         WHERE id = $2 AND case_id = $3 AND deleted_at IS NULL`,
        [deleter?.id || null, noteId, id]
      );
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
