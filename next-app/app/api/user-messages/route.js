import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

/**
 * GET /api/user-messages — get messages for current user
 */
export async function GET(req) {
  const user = await requireAuth(req);
  const rows = await query(
    `SELECT * FROM user_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [user.id]
  );
  return NextResponse.json({ data: rows });
}

/**
 * PATCH /api/user-messages — mark messages as read
 * Body: { ids: [1,2,3] }
 */
export async function PATCH(req) {
  const user = await requireAuth(req);
  const { ids } = await req.json();
  if (!ids?.length) return NextResponse.json({ ok: true });

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE user_messages SET is_read = TRUE WHERE user_id = $1 AND id = ANY($2)`,
      [user.id, ids]
    );
  });
  return NextResponse.json({ ok: true });
}
