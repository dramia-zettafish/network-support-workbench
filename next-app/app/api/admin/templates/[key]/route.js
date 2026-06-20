import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';
import { query } from '@/lib/db.js';

/** PATCH /api/admin/templates/[key] — update a template */
export async function PATCH(req, { params }) {
  await requireRole(['manager'], req);
  const { key } = await params;
  const body = await req.json();

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO cm_message_templates (template_key, label, description, recipient_template, cc_template, subject_template, body_template, updated_at)
       VALUES ($1, COALESCE($2, $1), $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (template_key) DO UPDATE SET
         recipient_template = COALESCE($4, cm_message_templates.recipient_template),
         cc_template = COALESCE($5, cm_message_templates.cc_template),
         subject_template = COALESCE($6, cm_message_templates.subject_template),
         body_template = COALESCE($7, cm_message_templates.body_template),
         updated_at = CURRENT_TIMESTAMP`,
      [key, body.label || key, body.description || '', body.recipient_template || '', body.cc_template || '', body.subject_template || '', body.body_template || '']
    );
  });

  const rows = await query(`SELECT * FROM cm_message_templates WHERE template_key = $1`, [key]);
  return NextResponse.json({ ok: true, template: rows[0] || null });
}

/** DELETE /api/admin/templates/[key] — reset template to default (delete override) */
export async function DELETE(req, { params }) {
  await requireRole(['manager'], req);
  const { key } = await params;

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM cm_message_templates WHERE template_key = $1`, [key]);
  });

  return NextResponse.json({ ok: true, reset: true });
}
