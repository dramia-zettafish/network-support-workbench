import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

/**
 * POST /api/case-reassignment/[id]/return — return case to original owning team
 */
export async function POST(req, { params }) {
  const user = await requireAuth(req);
  const { id } = await params;

  const [request] = await query(
    `SELECT * FROM cm_case_reassignment_requests WHERE id = $1 AND status = 'approved'`, [id]
  );
  if (!request) {
    return NextResponse.json({ error: 'Approved request not found' }, { status: 404 });
  }

  await withTransaction(async (client) => {
    // Return owning team to original and unassign user
    await client.query(
      `UPDATE cm_cases SET owning_team_id = $1, assigned_to_user_id = NULL WHERE id = $2`,
      [request.original_owning_team_id, request.case_id]
    );
    // Mark request as completed
    await client.query(
      `UPDATE cm_case_reassignment_requests SET status = 'completed' WHERE id = $1`,
      [id]
    );
    // Clear the "View Case" link on the associated user message
    await client.query(
      `UPDATE user_messages SET link = NULL WHERE user_id = $1 AND link = $2`,
      [request.requested_by, `/cases/${request.case_id}`]
    );
  });

  return NextResponse.json({ ok: true });
}
