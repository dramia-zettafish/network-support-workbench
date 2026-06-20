import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/message-center — send message to users/team/all
 * Body: { message, target: 'all' | 'team' | 'user', team_key?, user_id? }
 */
export async function POST(req) {
  const user = await requireRole(['supervisor', 'manager'], req);
  const { message, target, team_key, user_id, attachments } = await req.json();

  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 422 });
  if (!['all', 'team', 'user'].includes(target)) return NextResponse.json({ error: 'Invalid target' }, { status: 422 });

  let userIds = [];
  if (target === 'all') {
    const rows = await query(`SELECT id FROM users`);
    userIds = rows.map(r => r.id);
  } else if (target === 'team') {
    if (!team_key) return NextResponse.json({ error: 'team_key is required' }, { status: 422 });
    const rows = await query(
      `SELECT ut.user_id FROM user_teams ut JOIN teams t ON t.id = ut.team_id WHERE t.key = $1`, [team_key]
    );
    userIds = rows.map(r => r.user_id);
  } else if (target === 'user') {
    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 422 });
    userIds = [user_id];
  }

  if (!userIds.length) return NextResponse.json({ error: 'No recipients found' }, { status: 422 });

  const attachJson = JSON.stringify(attachments || []);
  await withTransaction(async (client) => {
    const values = userIds.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ');
    const params = userIds.flatMap(uid => [uid, message.trim(), user.id, user.username, attachJson]);
    await client.query(`INSERT INTO user_messages (user_id, message, sent_by_user_id, sent_by_name, attachments) VALUES ${values}`, params);
  });

  return NextResponse.json({ ok: true, recipients: userIds.length });
}

/**
 * GET /api/message-center — get users, teams, and sent message history
 * Query: ?history=1&offset=0&limit=20
 */
export async function GET(req) {
  const user = await requireRole(['supervisor', 'manager'], req);
  const { searchParams } = new URL(req.url);

  if (searchParams.get('history')) {
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = parseInt(searchParams.get('offset')) || 0;
    const rows = await query(
      `SELECT message, sent_by_name, created_at, COUNT(*) as recipient_count
       FROM user_messages WHERE sent_by_user_id IS NOT NULL
       GROUP BY message, sent_by_name, created_at
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]
    );
    const [{ count }] = await query(`SELECT COUNT(DISTINCT (message, created_at)) as count FROM user_messages WHERE sent_by_user_id IS NOT NULL`);
    return NextResponse.json({ data: rows, total: parseInt(count) });
  }

  const users = await query(`SELECT id, display_name FROM users ORDER BY display_name`);
  const teams = await query(`SELECT key, label FROM teams ORDER BY label`);
  return NextResponse.json({ users, teams });
}
