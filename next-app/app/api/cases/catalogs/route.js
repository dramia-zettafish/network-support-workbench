// Read-only endpoint for case creation form dropdowns.
// Returns customer catalog, manufacturer catalog, and workflow list.

import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);

    const [customers, manufacturers, workflows, teamMembers, programs, facilitiesResult] = await Promise.all([
      query(`SELECT id, name FROM cm_customer_catalog WHERE validation_status = 'approved' ORDER BY name ASC`),
      query(`SELECT id, name, workflow_key FROM cm_rma_manufacturers WHERE validation_status = 'approved' ORDER BY name ASC`),
      query(`SELECT w.workflow_key, w.label, w.owning_team_id, w.assignment_team_id, t.label as owning_team_label, at.label as assignment_team_label FROM cm_workflows w LEFT JOIN teams t ON t.id = w.owning_team_id LEFT JOIN teams at ON at.id = w.assignment_team_id WHERE w.is_enabled = 1 ORDER BY w.label ASC`),
      query(`SELECT ut.team_id, u.upn, u.display_name, u.email FROM user_teams ut JOIN users u ON u.id = ut.user_id WHERE u.is_active = 1 ORDER BY u.display_name ASC`),
      query(`SELECT id, name FROM cm_programs WHERE is_active = true ORDER BY name ASC`),
      query(`SELECT DISTINCT facility FROM cm_cases WHERE facility IS NOT NULL AND facility != '' ORDER BY facility ASC`),
    ]);

    const facilities = facilitiesResult.map(r => r.facility);

    // Group members by team_id
    const membersByTeam = {};
    for (const row of teamMembers) {
      if (!membersByTeam[row.team_id]) membersByTeam[row.team_id] = [];
      membersByTeam[row.team_id].push({ upn: row.upn, display_name: row.display_name, email: row.email });
    }

    // Build team key → id lookup and key-based membersByTeamKey
    const teamsResult = await query(`SELECT id, key FROM teams WHERE is_enabled = 1`);
    const teamIdsByKey = Object.fromEntries(teamsResult.map(t => [t.key, t.id]));
    const membersByTeamKey = {};
    for (const t of teamsResult) {
      if (membersByTeam[t.id]) membersByTeamKey[t.key] = membersByTeam[t.id];
    }

    return Response.json({ data: { customers, manufacturers, workflows, membersByTeam, membersByTeamKey, teamIdsByKey, programs, facilities } });
  } catch (err) {
    if (err.unauthorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.digest?.startsWith('DYNAMIC_SERVER_USAGE')) throw err;
    return Response.json({ error: 'Unable to retrieve catalog data' }, { status: 500 });
  }
}
