import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getTeamId } from '@/lib/teams.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const rows = await query(`SELECT dp.id, dp.part_name, dp.part_number, dp.condition, dp.failure_id, dp.created_at, dp.issued_at, u.display_name as created_by FROM cm_case_defective_parts dp LEFT JOIN users u ON u.id = dp.created_by_user_id WHERE dp.case_id = $1 ORDER BY dp.created_at DESC`, [id]);

    // Look up stock status based on case program
    const [caseRow] = await query(`SELECT program, stage FROM cm_cases WHERE id = $1`, [id]);
    const program = caseRow?.program || null;
    if (program) {
      for (const row of rows) {
        if (!row.part_number) { row.stock_status = 'Out of Stock'; continue; }
        const [inv] = await query(
          `SELECT i.qty_on_hand FROM inventory i WHERE lower(i.part_no) = lower($1) AND i.inventory_pool = $2`,
          [row.part_number, program]
        );
        row.stock_status = inv && inv.qty_on_hand > 0 ? 'In Stock' : 'Out of Stock';
      }

      // Auto-advance: Refresh - Spring ISD cases in Quote Request → Part Distribution when all parts in stock
      if (program === 'Refresh - Spring ISD' && caseRow.stage === 'Quote Request' && rows.length > 0 && rows.every(r => r.stock_status === 'In Stock')) {
        const partsAdminId = await getTeamId('parts_administrators');
        await query(`UPDATE cm_cases SET stage = $1, owning_team_id = $2, last_activity_at = CURRENT_TIMESTAMP WHERE id = $3`, ['Part Distribution', partsAdminId, id]);
      }
    }

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
    const { part_name, part_number, condition } = body;

    if (!part_name?.trim()) return Response.json({ error: 'part is required' }, { status: 422 });
    if (!condition?.trim()) return Response.json({ error: 'condition is required' }, { status: 422 });

    const [caseRow] = await query(`SELECT id FROM cm_cases WHERE id = $1`, [id]);
    if (!caseRow) return Response.json({ error: 'Case not found' }, { status: 404 });

    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO cm_case_defective_parts (id, case_id, part_name, part_number, condition, created_by_user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [crypto.randomUUID(), id, part_name.trim(), part_number?.trim() || null, condition.trim(), creator?.id || null]
      );
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to add part' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const { id } = await params;
    const { id: partId, part_name, part_number, condition, failure_id } = await request.json();
    if (!partId) return Response.json({ error: 'Part id required' }, { status: 422 });

    await withTransaction(async (client) => {
      // Get old values
      const oldRes = await client.query(`SELECT part_name, part_number, condition, failure_id FROM cm_case_defective_parts WHERE id = $1 AND case_id = $2`, [partId, id]);
      const old = oldRes.rows[0];

      const sets = [];
      const vals = [];
      let idx = 1;
      if (part_name !== undefined) { sets.push(`part_name = $${idx}`); vals.push(part_name.trim()); idx++; }
      if (part_number !== undefined) { sets.push(`part_number = $${idx}`); vals.push(part_number.trim() || null); idx++; }
      if (condition !== undefined) { sets.push(`condition = $${idx}`); vals.push(condition.trim()); idx++; }
      if (failure_id !== undefined) { sets.push(`failure_id = $${idx}`); vals.push(failure_id.trim() || null); idx++; }
      if (sets.length) {
        vals.push(partId); vals.push(id);
        await client.query(`UPDATE cm_case_defective_parts SET ${sets.join(', ')} WHERE id = $${idx} AND case_id = $${idx + 1}`, vals);
      }

      // Log field update note
      const changes = [];
      if (part_name !== undefined && part_name.trim() !== (old?.part_name || '')) changes.push(`Part changed from "${old?.part_name || '(blank)'}" to "${part_name.trim()}"`);
      if (part_number !== undefined && (part_number.trim() || '') !== (old?.part_number || '')) changes.push(`Part Number changed from "${old?.part_number || '(blank)'}" to "${part_number.trim() || '(blank)'}"`);
      if (condition !== undefined && condition.trim() !== (old?.condition || '')) changes.push(`Condition changed from "${old?.condition || '(blank)'}" to "${condition.trim()}"`);
      if (failure_id !== undefined && (failure_id.trim() || '') !== (old?.failure_id || '')) changes.push(`Failure ID changed from "${old?.failure_id || '(blank)'}" to "${failure_id.trim() || '(blank)'}"`);
      if (changes.length) {
        const editorRes = await client.query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
        const editorId = editorRes.rows[0]?.id || null;
        const noteBody = `Defective Part edited: ${changes.join('; ')} by user: ${user.username}`;
        await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), id, noteBody, editorId]);
      }
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to update part' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const { id } = await params;
    const { id: partId } = await request.json();
    if (!partId) return Response.json({ error: 'Part id required' }, { status: 422 });

    await withTransaction(async (client) => {
      const oldRes = await client.query(`SELECT part_name, part_number, condition FROM cm_case_defective_parts WHERE id = $1 AND case_id = $2`, [partId, id]);
      const old = oldRes.rows[0];
      if (!old) return;

      await client.query(`DELETE FROM cm_case_defective_parts WHERE id = $1 AND case_id = $2`, [partId, id]);

      const editorRes = await client.query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
      const editorId = editorRes.rows[0]?.id || null;
      const noteBody = `Defective Part deleted: "${old.part_name || ''}" (${old.part_number || '-'}, ${old.condition || '-'}) by user: ${user.username}`;
      await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), id, noteBody, editorId]);
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to delete part' }, { status: 500 });
  }
}
