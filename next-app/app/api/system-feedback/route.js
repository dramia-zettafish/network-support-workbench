import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/system-feedback — list feedback
 * Regular users see their own; managers see all.
 */
export async function GET(req) {
  const user = await requireAuth(req);
  const isManager = user.role === 'manager';

  const rows = isManager
    ? await query(`SELECT * FROM system_feedback ORDER BY created_at DESC LIMIT 200`)
    : await query(`SELECT * FROM system_feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [user.id]);

  return NextResponse.json({ data: rows });
}

/**
 * POST /api/system-feedback — submit feedback
 * Body: { category, message, attachments?: [{name, url}] }
 */
export async function POST(req) {
  const user = await requireAuth(req);
  const body = await req.json();
  const { category, message, attachments } = body;

  if (!category?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Category and message are required' }, { status: 422 });
  }

  const result = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO system_feedback (user_id, username, category, message, attachments)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [user.id, user.username, category.trim(), message.trim(), JSON.stringify(attachments || [])]
    );
    return res.rows[0];
  });

  return NextResponse.json({ ok: true, id: result.id, created_at: result.created_at }, { status: 201 });
}

/**
 * PATCH /api/system-feedback — reply to feedback (managers only)
 * Body: { id, reply }
 */
export async function PATCH(req) {
  const user = await requireAuth(req);
  if (user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { id, reply } = body;

  if (!id || !reply?.trim()) {
    return NextResponse.json({ error: 'id and reply are required' }, { status: 422 });
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE system_feedback SET reply = $1, replied_by = $2, replied_by_name = $3, replied_at = NOW() WHERE id = $4`,
      [reply.trim(), user.id, user.username, id]
    );
    // Send message to the feedback author
    const [fb] = await query(`SELECT user_id, category FROM system_feedback WHERE id = $1`, [id]);
    if (fb) {
      await client.query(
        `INSERT INTO user_messages (user_id, message, is_read, created_at) VALUES ($1, $2, FALSE, NOW())`,
        [fb.user_id, `A manager replied to your ${fb.category} feedback: "${reply.trim().slice(0, 100)}${reply.trim().length > 100 ? '...' : ''}"`]
      );
    }
  });

  return NextResponse.json({ ok: true });
}

/**
 * PUT /api/system-feedback — mark feedback as read (managers only)
 * Body: { id }
 */
export async function PUT(req) {
  const user = await requireAuth(req);
  if (user.role !== 'manager' && user.role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });

  await withTransaction(async (client) => {
    await client.query(`UPDATE system_feedback SET is_read = true WHERE id = $1`, [id]);
  });

  return NextResponse.json({ ok: true });
}
