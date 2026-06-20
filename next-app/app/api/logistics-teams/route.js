import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    // Only return non-expired teams
    const teams = await query(
      `SELECT id, name, created_at, expires_at FROM cm_custom_logistics_teams WHERE expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC`
    );
    // Fetch members for each team
    const teamIds = teams.map(t => t.id);
    let members = [];
    if (teamIds.length) {
      members = await query(
        `SELECT team_id, user_upn, display_name FROM cm_custom_logistics_team_members WHERE team_id = ANY($1)`,
        [teamIds]
      );
    }
    const membersByTeam = {};
    members.forEach(m => { if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []; membersByTeam[m.team_id].push(m); });
    const data = teams.map(t => ({ ...t, members: membersByTeam[t.id] || [] }));
    return Response.json({ data });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load teams' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, member_upns } = body;

    if (!name?.trim()) return Response.json({ error: 'name is required' }, { status: 422 });
    if (!Array.isArray(member_upns) || !member_upns.length) return Response.json({ error: 'At least one member is required' }, { status: 422 });

    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    const teamId = crypto.randomUUID();

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO cm_custom_logistics_teams (id, name, created_by_user_id, created_at, expires_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
        [teamId, name.trim(), creator?.id || null]
      );
      for (const upn of member_upns) {
        const [u] = await query(`SELECT display_name FROM users WHERE lower(upn) = lower($1)`, [upn]);
        await client.query(
          `INSERT INTO cm_custom_logistics_team_members (team_id, user_upn, display_name) VALUES ($1, $2, $3)`,
          [teamId, upn, u?.display_name || upn]
        );
      }
    });

    return Response.json({ ok: true, id: teamId }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
