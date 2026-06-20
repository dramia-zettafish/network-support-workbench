import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';

const MANAGER_ROLES = ['manager'];

/** GET /api/admin/users — list all users with teams */
export async function GET(req) {
  const user = await requireRole(MANAGER_ROLES, req);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await query(`
    SELECT u.id, u.upn AS username, u.display_name, u.email, u.role, u.timezone, u.created_at,
           COALESCE(
             (SELECT string_agg(t.label, ',' ORDER BY t.label)
              FROM user_teams ut JOIN teams t ON t.id = ut.team_id
              WHERE ut.user_id = u.id), ''
           ) AS teams
    FROM users u WHERE u.upn IS NOT NULL AND u.upn != '' ORDER BY lower(u.upn) ASC
  `);

  const data = rows.map((r) => ({
    ...r,
    teams: r.teams ? r.teams.split(',').filter(Boolean) : [],
  }));
  return NextResponse.json({ data });
}

/** POST /api/admin/users — create/upsert a user */
export async function POST(req) {
  await requireRole(MANAGER_ROLES, req);
  const body = await req.json();
  const username = (body.username || '').trim();
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 422 });
  const role = body.role || 'manager';
  const displayName = body.display_name || username;
  const email = (body.email || '').trim() || null;
  const teams = body.teams || [];

  const result = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO users (upn, display_name, email, role, is_active)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (upn) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         is_active = 1
       RETURNING id, upn AS username, display_name, email, role, created_at`,
      [username, displayName, email, role]
    );
    const userId = res.rows[0].id;

    // Sync teams
    await client.query('DELETE FROM user_teams WHERE user_id = $1', [userId]);
    for (const label of teams) {
      await client.query(
        `INSERT INTO user_teams (user_id, team_id)
         SELECT $1, id FROM teams WHERE lower(label) = lower($2)
         ON CONFLICT DO NOTHING`,
        [userId, label]
      );
    }
    return res.rows[0];
  });

  return NextResponse.json({ ok: true, user: { ...result, teams } });
}

/** PATCH /api/admin/users — update a user (username in body) */
export async function PATCH(req) {
  await requireRole(MANAGER_ROLES, req);
  const body = await req.json();
  const username = (body.username || '').trim();
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 422 });

  const sets = [];
  const params = [username];
  let idx = 2;
  if (body.role !== undefined) { sets.push(`role = $${idx}`); params.push(body.role); idx++; }
  if (body.display_name !== undefined) { sets.push(`display_name = $${idx}`); params.push(body.display_name); idx++; }
  if (body.email !== undefined) { sets.push(`email = $${idx}`); params.push(body.email); idx++; }
  if (body.timezone !== undefined) { sets.push(`timezone = $${idx}`); params.push(body.timezone); idx++; }

  const result = await withTransaction(async (client) => {
    if (sets.length > 0) {
      await client.query(
        `UPDATE users SET ${sets.join(', ')} WHERE lower(upn) = lower($1)`,
        params
      );
    }
    if (body.teams !== undefined) {
      const uid = await client.query('SELECT id FROM users WHERE lower(upn) = lower($1)', [username]);
      if (uid.rows.length > 0) {
        const userId = uid.rows[0].id;
        await client.query('DELETE FROM user_teams WHERE user_id = $1', [userId]);
        for (const label of body.teams) {
          await client.query(
            `INSERT INTO user_teams (user_id, team_id)
             SELECT $1, id FROM teams WHERE lower(label) = lower($2)
             ON CONFLICT DO NOTHING`,
            [userId, label]
          );
        }
      }
    }
    const row = await client.query(
      `SELECT id, upn AS username, display_name, email, role, created_at FROM users WHERE lower(upn) = lower($1)`,
      [username]
    );
    return row.rows[0] || null;
  });

  if (!result) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ ok: true, user: { ...result, teams: body.teams } });
}

/** DELETE /api/admin/users — delete a user (username in body) */
export async function DELETE(req) {
  await requireRole(MANAGER_ROLES, req);
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username') || '';
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 422 });

  await withTransaction(async (client) => {
    const uid = await client.query('SELECT id FROM users WHERE lower(upn) = lower($1)', [username]);
    if (uid.rows.length === 0) return;
    const userId = uid.rows[0].id;

    // Helper to attempt a delete without aborting the transaction
    async function tryDelete(sql, params) {
      try {
        await client.query('SAVEPOINT sp');
        await client.query(sql, params);
        await client.query('RELEASE SAVEPOINT sp');
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT sp');
      }
    }

    await tryDelete('DELETE FROM checkout_cart_lines WHERE cart_id IN (SELECT id FROM checkout_cart WHERE user_id = $1)', [userId]);
    await tryDelete('DELETE FROM checkout_cart WHERE user_id = $1', [userId]);
    await tryDelete('DELETE FROM user_teams WHERE user_id = $1', [userId]);
    await tryDelete('DELETE FROM session_log WHERE user_id = $1', [userId]);
    await tryDelete('DELETE FROM auth_users WHERE lower(username) = lower($1)', [username]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  return NextResponse.json({ ok: true });
}
