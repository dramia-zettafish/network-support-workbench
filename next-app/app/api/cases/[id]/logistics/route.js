import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getStageTeamMap, getTeamId } from '@/lib/teams.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const [row] = await query(`SELECT scheduled_pickup_date, pickup_resource, actual_pickup_date, picked_up_by, scheduled_delivery_date, delivery_resource, actual_delivery_date, intake_crate FROM cm_case_logistics WHERE case_id = $1`, [id]);
    const failures = await query(`SELECT failure_type, reason, failed_at FROM cm_case_logistics_failures WHERE case_id = $1 ORDER BY created_at ASC`, [id]);
    return Response.json({ data: row || null, failures });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load logistics' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Handle stage advancement
    if (body.advance_stage) {
      const STAGE_TEAM_MAP = await getStageTeamMap();
      const FORCE_ASSIGN_STAGES = ['Pickup Scheduled', 'Delivery Scheduled'];

      const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
      const [oldCase] = await query(`SELECT stage, owning_team_id, assigned_to_user_id FROM cm_cases WHERE id = $1`, [id]);
      await withTransaction(async (client) => {
        const sets = ['stage = $2', 'last_activity_at = CURRENT_TIMESTAMP'];
        const vals = [id, body.advance_stage];

        // Auto-set owning team from stage map (explicit owning_team_key or owning_team_id overrides)
        let explicitTeam = body.owning_team_id;
        if (!explicitTeam && body.owning_team_key) {
          explicitTeam = await getTeamId(body.owning_team_key);
        }
        const mappedTeam = explicitTeam || STAGE_TEAM_MAP[body.advance_stage];
        if (mappedTeam) { sets.push(`owning_team_id = $${vals.length + 1}`); vals.push(mappedTeam); }

        // Force assignment stages require a user
        if (FORCE_ASSIGN_STAGES.includes(body.advance_stage) && !body.assign_username && !body.assign_to_self) {
          // Keep existing or require assignment — don't clear
        } else if (body.assign_to_self && creator?.id) {
          sets.push(`assigned_to_user_id = $${vals.length + 1}`); vals.push(creator.id);
        } else if (body.assign_username === '__unassign__') {
          sets.push(`assigned_to_user_id = NULL`);
        } else if (body.assign_username) {
          const [assignee] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [body.assign_username]);
          if (assignee) { sets.push(`assigned_to_user_id = $${vals.length + 1}`); vals.push(assignee.id); }
        } else if (mappedTeam && oldCase?.owning_team_id !== mappedTeam) {
          // Clear assignment when owning team changes
          sets.push(`assigned_to_user_id = NULL`);
        }

        await client.query(`UPDATE cm_cases SET ${sets.join(', ')} WHERE id = $1`, vals);
        if (body.activity_note) {
          const crypto = await import('crypto');
          await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'SystemEvent', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), id, body.activity_note, creator?.id || null]);
        }

        // Audit log for stage/team/assignment changes
        const crypto2 = await import('crypto');
        const changes = [];
        if (oldCase?.stage !== body.advance_stage) changes.push(`Stage changed from "${oldCase?.stage || '(blank)'}" to "${body.advance_stage}"`);
        if (mappedTeam && oldCase?.owning_team_id !== mappedTeam) {
          const oldTeamRes = await client.query(`SELECT label FROM teams WHERE id = $1`, [oldCase?.owning_team_id]);
          const newTeamRes = await client.query(`SELECT label FROM teams WHERE id = $1`, [mappedTeam]);
          changes.push(`Owning Team changed from "${oldTeamRes.rows[0]?.label || '(none)'}" to "${newTeamRes.rows[0]?.label || '(none)'}"`);
        }
        if (body.assign_username) changes.push(`Assigned To changed from "(previous)" to "${body.assign_username}"`);
        if (body.assign_to_self) changes.push(`Assigned To changed from "(previous)" to "${user.username}" (self)`);
        for (const change of changes) {
          await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto2.randomUUID(), id, `${change} by user: ${user.username}`, creator?.id || null]);
        }
      });
      return Response.json({ ok: true });
    }

    const { scheduled_pickup_date, pickup_resource, scheduled_delivery_date, delivery_resource } = body;
    const [logCreator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);

    await withTransaction(async (client) => {
      // Get old values for audit
      const oldLogRes = await client.query(`SELECT scheduled_pickup_date, pickup_resource, scheduled_delivery_date, delivery_resource FROM cm_case_logistics WHERE case_id = $1`, [id]);
      const oldLog = oldLogRes.rows[0] || {};

      await client.query(
        `INSERT INTO cm_case_logistics (case_id, scheduled_pickup_date, pickup_resource, scheduled_delivery_date, delivery_resource, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (case_id) DO UPDATE SET scheduled_pickup_date = $2, pickup_resource = $3, scheduled_delivery_date = $4, delivery_resource = $5, updated_at = CURRENT_TIMESTAMP`,
        [id, scheduled_pickup_date?.trim() || null, pickup_resource?.trim() || null, scheduled_delivery_date?.trim() || null, delivery_resource?.trim() || null]
      );

      // Audit notes for scheduling changes
      const crypto3 = await import('crypto');
      if (scheduled_pickup_date?.trim() && scheduled_pickup_date.trim() !== (oldLog.scheduled_pickup_date || '')) {
        await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto3.randomUUID(), id, `Scheduled Pickup Date changed from "${oldLog.scheduled_pickup_date || '(blank)'}" to "${scheduled_pickup_date.trim()}" by user: ${user.username}`, logCreator?.id || null]);
      }
      if (pickup_resource?.trim() && pickup_resource.trim() !== (oldLog.pickup_resource || '')) {
        await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto3.randomUUID(), id, `Pickup Resource changed from "${oldLog.pickup_resource || '(blank)'}" to "${pickup_resource.trim()}" by user: ${user.username}`, logCreator?.id || null]);
      }
      if (scheduled_delivery_date?.trim() && scheduled_delivery_date.trim() !== (oldLog.scheduled_delivery_date || '')) {
        await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto3.randomUUID(), id, `Scheduled Delivery Date changed from "${oldLog.scheduled_delivery_date || '(blank)'}" to "${scheduled_delivery_date.trim()}" by user: ${user.username}`, logCreator?.id || null]);
      }
      if (delivery_resource?.trim() && delivery_resource.trim() !== (oldLog.delivery_resource || '')) {
        await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto3.randomUUID(), id, `Delivery Resource changed from "${oldLog.delivery_resource || '(blank)'}" to "${delivery_resource.trim()}" by user: ${user.username}`, logCreator?.id || null]);
      }

      // Auto-advance to Delivery Scheduled when scheduled_delivery_date is set
      if (scheduled_delivery_date?.trim()) {
        const logisticsTeamId = await getTeamId('logistics_technicians');
        // Cancelled cases keep their stage but move to logistics team
        await client.query(`UPDATE cm_cases SET owning_team_id = ${logisticsTeamId}, last_activity_at = NOW() WHERE id = $1 AND stage = 'Cancelled'`, [id]);
        await client.query(`UPDATE cm_cases SET stage = 'Delivery Scheduled', owning_team_id = ${logisticsTeamId}, last_activity_at = NOW() WHERE id = $1 AND stage = 'Ready for Delivery'`, [id]);
      }
    });
    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to save logistics' }, { status: 500 });
  }
}
