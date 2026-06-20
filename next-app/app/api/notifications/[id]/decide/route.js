import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { withTransaction } from '@/lib/db-write.js';

const SUPERVISOR_ROLES = ['supervisor', 'manager'];

/**
 * POST /api/notifications/[id]/decide — approve or deny an inventory add request
 * Body: { decision: "approve"|"deny", review_note? }
 */
export async function POST(req, { params }) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  if (!SUPERVISOR_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestId = parseInt(params.id, 10);
  if (!requestId) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const decision = (body.decision || '').toLowerCase();
    if (!['approve', 'deny'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be "approve" or "deny"' }, { status: 422 });
    }
    const reviewNote = (body.review_note || '').trim() || null;
    const status = decision === 'approve' ? 'approved' : 'denied';

    const result = await withTransaction(async (client) => {
      const row = await client.query(
        `SELECT part_no, status, description, qty_on_hand, location, inventory_pool, requested_by FROM inventory_add_requests WHERE id = $1`, [requestId]
      );
      if (row.rows.length === 0) {
        throw Object.assign(new Error('Request not found'), { status: 404 });
      }
      if (row.rows[0].status !== 'pending') {
        throw Object.assign(new Error('Request already processed'), { status: 409 });
      }

      const partNo = row.rows[0].part_no;
      const desc = row.rows[0].description || 'Uncatalogued';
      const qty = row.rows[0].qty_on_hand || 0;
      const loc = row.rows[0].location || '';
      const pool = row.rows[0].inventory_pool || 'Operations';
      const requestedBy = row.rows[0].requested_by;

      if (decision === 'approve') {
        // Add to catalog and inventory
        await client.query(
          `INSERT INTO parts_catalog(part_no, description, active) VALUES ($1, $2, 1) ON CONFLICT (part_no) DO NOTHING`,
          [partNo, desc]
        );
        await client.query(
          `INSERT INTO inventory(part_no, qty_on_hand, location, inventory_pool, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (part_no, inventory_pool) DO NOTHING`,
          [partNo, qty, loc, pool]
        );
      }

      await client.query(
        `UPDATE inventory_add_requests SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2, review_note = $3 WHERE id = $4`,
        [status, user.id, reviewNote, requestId]
      );

      // Record in ledger
      await client.query(
        `INSERT INTO ledger(event_time, user_id, action, part_no, qty, prev_qty, new_qty)
         VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, 0, $4)`,
        [user.id, decision === 'approve' ? 'add_part_approved' : 'add_part_denied', partNo, qty]
      );

      // Notify requester
      if (requestedBy) {
        const msg = decision === 'approve'
          ? `Your request to add part ${partNo} has been approved.`
          : `Your request to add part ${partNo} has been denied.${reviewNote ? ` Reason: ${reviewNote}` : ''}`;
        await client.query(
          `INSERT INTO user_messages (user_id, message, is_read, created_at) VALUES ($1, $2, FALSE, NOW())`,
          [requestedBy, msg]
        );
      }

      return { ok: true, request_id: requestId, status, part_no: partNo };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error.status === 404 || error.status === 409) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return sanitizeWriteError(error);
  }
}
