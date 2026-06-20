import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
export const dynamic = 'force-dynamic';

/** GET /api/admin/templates — list all case message templates (merged defaults + overrides) */
export async function GET(req) {
  await requireRole(['manager'], req);
  const rows = await query(
    `SELECT template_key, label, description, recipient_template, cc_template, subject_template, body_template
     FROM cm_message_templates ORDER BY label ASC`
  );
  return NextResponse.json({ data: rows });
}
