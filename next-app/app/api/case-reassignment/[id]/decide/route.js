import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

/**
 * POST /api/case-reassignment/[id]/decide
 * Body: { decision: "approve"|"deny" }
 */
export async function POST(req, { params }) {
  const user = await requireAuth(req);
  if (!['supervisor', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { decision } = body;

  if (!['approve', 'deny'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be approve or deny' }, { status: 422 });
  }

  const [request] = await query(
    `SELECT * FROM cm_case_reassignment_requests WHERE id = $1 AND status = 'pending'`, [id]
  );
  if (!request) {
    return NextResponse.json({ error: 'Request not found or already decided' }, { status: 404 });
  }

  const status = decision === 'approve' ? 'approved' : 'denied';

  await withTransaction(async (client) => {
    // Update request status
    await client.query(
      `UPDATE cm_case_reassignment_requests SET status = $1, reviewed_by = $2, reviewed_by_name = $3, reviewed_at = NOW() WHERE id = $4`,
      [status, user.id, user.username, id]
    );

    if (decision === 'approve') {
      // Assign case to requester
      await client.query(
        `UPDATE cm_cases SET assigned_to_user_id = $1 WHERE id = $2`,
        [request.requested_by, request.case_id]
      );
    }

    // Create user message
    const message = decision === 'approve'
      ? `Your request to edit case ${request.case_number} has been approved.`
      : `Your request for reassignment of ${request.case_number} was denied by ${user.username}.`;
    const link = decision === 'approve' ? `/cases/${request.case_id}` : null;

    await client.query(
      `INSERT INTO user_messages (user_id, message, link) VALUES ($1, $2, $3)`,
      [request.requested_by, message, link]
    );
  });

  return NextResponse.json({ ok: true, status });
}
