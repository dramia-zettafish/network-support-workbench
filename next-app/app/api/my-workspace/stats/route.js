import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const team = searchParams.get('team') || '';

    const [userRow] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    if (!userRow) return Response.json({ data: {} });

    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Cases created by user in timeframe
    let createdCondition = `c.created_by_user_id = $1 AND c.created_at >= $2`;
    const createdParams = [userRow.id, since];
    if (team && team !== 'intake_administrators') {
      createdCondition += ` AND c.owning_team_id = (SELECT id FROM teams WHERE key = $3)`;
      createdParams.push(team);
    }
    const [created] = await query(`SELECT COUNT(*)::int AS count FROM cm_cases c WHERE ${createdCondition}`, createdParams);

    // Notes added by user in timeframe
    let notesCondition = `n.created_by_user_id = $1 AND n.created_at >= $2`;
    const notesParams = [userRow.id, since];
    if (team) {
      notesCondition += ` AND n.case_id IN (SELECT id FROM cm_cases WHERE owning_team_id = (SELECT id FROM teams WHERE key = $3))`;
      notesParams.push(team);
    }
    const [notes] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE ${notesCondition}`, notesParams);

    // Stage advances (SystemEvent notes by user)
    const [stageChanges] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'SystemEvent'${team ? ` AND n.case_id IN (SELECT id FROM cm_cases WHERE owning_team_id = (SELECT id FROM teams WHERE key = $3))` : ''}`, team ? [userRow.id, since, team] : [userRow.id, since]);

    // Daily activity breakdown (notes per day)
    const dailyActivity = await query(
      `SELECT DATE(n.created_at) AS day, COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2${team ? ` AND n.case_id IN (SELECT id FROM cm_cases WHERE owning_team_id = (SELECT id FROM teams WHERE key = $3))` : ''} GROUP BY DATE(n.created_at) ORDER BY day`,
      team ? [userRow.id, since, team] : [userRow.id, since]
    );

    // Get user teams for conditional logic
    const userTeamRows = await query(`SELECT t.key FROM user_teams ut JOIN teams t ON t.id = ut.team_id WHERE ut.user_id = $1`, [userRow.id]);
    const userTeams = userTeamRows.map(r => r.key);

    // Daily cases created by workflow (for intake)
    const dailyCasesByWorkflow = team === 'intake_administrators' || (!team && userTeams.includes('intake_administrators'))
      ? await query(
          `SELECT DATE(c.created_at) AS day, c.workflow_key, COUNT(*)::int AS count FROM cm_cases c WHERE c.created_by_user_id = $1 AND c.created_at >= $2 GROUP BY DATE(c.created_at), c.workflow_key ORDER BY day`,
          [userRow.id, since]
        )
      : [];

    const dailyCasesByCustomer = team === 'intake_administrators' || (!team && userTeams.includes('intake_administrators'))
      ? await query(
          `SELECT DATE(c.created_at) AS day, c.customer_name, COUNT(*)::int AS count FROM cm_cases c WHERE c.created_by_user_id = $1 AND c.created_at >= $2 GROUP BY DATE(c.created_at), c.customer_name ORDER BY day`,
          [userRow.id, since]
        )
      : [];

    // Route coordinator stats — what THIS user has done
    let rcStats = null;
    if (team === 'route_coordinators' || (!team && userTeams.includes('route_coordinators'))) {
      const [pickups] = await query(
        `SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'Field Update' AND n.body LIKE 'Scheduled Pickup Date changed%'`,
        [userRow.id, since]
      );
      const [deliveries] = await query(
        `SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'Field Update' AND n.body LIKE 'Scheduled Delivery Date changed%'`,
        [userRow.id, since]
      );
      const dailyPickups = await query(
        `SELECT DATE(n.created_at) AS day, COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'Field Update' AND n.body LIKE 'Scheduled Pickup Date changed%' GROUP BY DATE(n.created_at) ORDER BY day`,
        [userRow.id, since]
      );
      const dailyDeliveries = await query(
        `SELECT DATE(n.created_at) AS day, COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'Field Update' AND n.body LIKE 'Scheduled Delivery Date changed%' GROUP BY DATE(n.created_at) ORDER BY day`,
        [userRow.id, since]
      );
      rcStats = { pickups_scheduled: pickups?.count || 0, deliveries_scheduled: deliveries?.count || 0, daily_pickups: dailyPickups, daily_deliveries: dailyDeliveries };
    }

    // Logistics technician stats — what THIS user has done
    let ltStats = null;
    if (team === 'logistics_technicians' || (!team && userTeams.includes('logistics_technicians'))) {
      const [successfulPickups] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'SystemEvent' AND n.body = 'Logistics update: Pick up Successful'`, [userRow.id, since]);
      const [pickupFailures] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'SystemEvent' AND n.body = 'Logistics update: Pick Up Failed'`, [userRow.id, since]);
      const [successfulDeliveries] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'SystemEvent' AND n.body = 'Logistics update: Delivery Successful'`, [userRow.id, since]);
      const [deliveryFailures] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'SystemEvent' AND n.body = 'Logistics update: Delivery Failure'`, [userRow.id, since]);
      const ltDaily = await query(
        `SELECT DATE(n.created_at) AS day, n.body AS event, COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'SystemEvent' AND n.body IN ('Logistics update: Pick up Successful','Logistics update: Pick Up Failed','Logistics update: Delivery Successful','Logistics update: Delivery Failure') GROUP BY DATE(n.created_at), n.body ORDER BY day`,
        [userRow.id, since]
      );
      ltStats = { successful_pickups: successfulPickups?.count || 0, pickup_failures: pickupFailures?.count || 0, successful_deliveries: successfulDeliveries?.count || 0, delivery_failures: deliveryFailures?.count || 0, daily: ltDaily };
    }

    // Computer technician stats — what THIS user has done
    let ctStats = null;
    if (team === 'computer_technicians' || (!team && userTeams.includes('computer_technicians'))) {
      const [diagnosed] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'Diagnostic'`, [userRow.id, since]);
      const [partRequests] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'Additional Part Request'`, [userRow.id, since]);
      const [defectiveParts] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_defective_parts dp WHERE dp.created_by_user_id = $1 AND dp.created_at >= $2 AND dp.condition = 'Defective'`, [userRow.id, since]);
      const [damagedParts] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_defective_parts dp WHERE dp.created_by_user_id = $1 AND dp.created_at >= $2 AND dp.condition = 'Damaged'`, [userRow.id, since]);
      const [repairs] = await query(`SELECT COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type = 'Repair'`, [userRow.id, since]);
      const ctDaily = await query(
        `SELECT DATE(n.created_at) AS day, n.note_type, COUNT(*)::int AS count FROM cm_case_notes n WHERE n.created_by_user_id = $1 AND n.created_at >= $2 AND n.note_type IN ('Diagnostic', 'Additional Part Request', 'Repair') GROUP BY DATE(n.created_at), n.note_type ORDER BY day`,
        [userRow.id, since]
      );
      ctStats = { diagnosed: diagnosed?.count || 0, part_requests: partRequests?.count || 0, defective_parts: defectiveParts?.count || 0, damaged_parts: damagedParts?.count || 0, repairs: repairs?.count || 0, daily: ctDaily };
    }

    // Parts administrator stats — what THIS user has done
    let paStats = null;
    if (team === 'parts_administrators' || (!team && userTeams.includes('parts_administrators'))) {
      const [issued] = await query(`SELECT COALESCE(SUM(qty), 0)::int AS count FROM ledger WHERE user_id = $1 AND event_time >= $2 AND action = 'issue'`, [userRow.id, since]);
      const [received] = await query(`SELECT COALESCE(SUM(qty), 0)::int AS count FROM ledger WHERE user_id = $1 AND event_time >= $2 AND lower(action) = 'checkin'`, [userRow.id, since]);
      const paDaily = await query(
        `SELECT DATE(event_time) AS day, lower(action) AS action, COALESCE(SUM(qty), 0)::int AS count FROM ledger WHERE user_id = $1 AND event_time >= $2 AND lower(action) IN ('issue', 'checkin') GROUP BY DATE(event_time), lower(action) ORDER BY day`,
        [userRow.id, since]
      );
      paStats = { parts_issued: issued?.count || 0, parts_received: received?.count || 0, daily: paDaily };
    }

    // Cases by stage (currently assigned)
    const byStage = await query(
      `SELECT c.stage, COUNT(*)::int AS count FROM cm_cases c WHERE c.assigned_to_user_id = $1 AND c.status = 'Active'${team ? ` AND c.owning_team_id = (SELECT id FROM teams WHERE key = $2)` : ''} GROUP BY c.stage ORDER BY count DESC`,
      team ? [userRow.id, team] : [userRow.id]
    );

    return Response.json({
      data: {
        cases_created: created?.count || 0,
        notes_added: notes?.count || 0,
        stage_changes: stageChanges?.count || 0,
        daily_activity: dailyActivity,
        daily_cases_by_workflow: dailyCasesByWorkflow,
        daily_cases_by_customer: dailyCasesByCustomer,
        rc_stats: rcStats,
        lt_stats: ltStats,
        ct_stats: ctStats,
        pa_stats: paStats,
        cases_by_stage: byStage,
      }
    });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
