import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { sendEmail, getSmtpStatus } from '@/lib/email.js';

/**
 * GET /api/case-reassignment — list reassignment requests
 * Query params: status (pending|approved|denied|all)
 */
export async function GET(req) {
  const user = await requireAuth(req);
  const { searchParams } = new URL(req.url);
  const my = searchParams.get('my') === 'true';

  // Regular users can only see their own requests
  if (!my && !['supervisor', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = (searchParams.get('status') || 'pending').toLowerCase();

  let where = 'WHERE 1=1';
  const params = [];
  if (my) {
    params.push(user.id);
    where += ` AND r.requested_by = $${params.length}`;
  }
  if (status && status !== 'all') {
    params.push(status);
    where += ` AND r.status = $${params.length}`;
  }

  const rows = await query(
    `SELECT r.*, t.label AS owning_team_name
     FROM cm_case_reassignment_requests r
     LEFT JOIN teams t ON t.id = r.owning_team_id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return NextResponse.json({ data: rows });
}

/**
 * POST /api/case-reassignment — submit a reassignment request
 * Body: { case_id, case_number, owning_team_id, justification }
 */
export async function POST(req) {
  const user = await requireAuth(req);
  const body = await req.json();
  const { case_id, case_number, owning_team_id, justification } = body;

  if (!case_id || !justification?.trim()) {
    return NextResponse.json({ error: 'case_id and justification required' }, { status: 422 });
  }

  // Check for existing pending request by this user for this case
  const existing = await query(
    `SELECT id FROM cm_case_reassignment_requests WHERE case_id = $1 AND requested_by = $2 AND status = 'pending' LIMIT 1`,
    [case_id, user.id]
  );
  if (existing.length > 0) {
    return NextResponse.json({ ok: true, pending: true, message: 'You already have a pending request for this case.' });
  }

  const result = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO cm_case_reassignment_requests (case_id, case_number, owning_team_id, requested_by, requested_by_name, justification, original_owning_team_id)
       VALUES ($1, $2, $3, $4, $5, $6, $3)
       RETURNING id, status, created_at`,
      [case_id, case_number, owning_team_id, user.id, user.username, justification.trim()]
    );
    return res.rows[0];
  });

  // Email supervisors/managers
  try {
    const { configured } = getSmtpStatus();
    if (configured) {
      const recipients = await query(
        `SELECT email FROM users WHERE role IN ('supervisor', 'manager') AND email IS NOT NULL AND email != ''`
      );
      const emails = recipients.map(r => r.email).filter(Boolean);
      if (emails.length > 0) {
        await sendEmail({
          to: emails,
          cc: [],
          subject: `Case Reassignment Request: ${case_number}`,
          text: `A case reassignment request has been submitted.\n\nCase Number: ${case_number}\nRequested By: ${user.username}\nJustification: ${justification.trim()}\n\nPlease review in the Notifications module under Case Management.`,
        });
      }
    }
  } catch (e) {
    console.error('[case-reassignment] Email send failed:', e.message);
  }

  return NextResponse.json({ ok: true, request_id: result.id, status: result.status });
}
