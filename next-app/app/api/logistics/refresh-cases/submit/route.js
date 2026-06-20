import { requireAuth } from '@/lib/auth';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { query } from '@/lib/db.js';
import { getTeamId } from '@/lib/teams.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const STAGE_MAP = {
  'Pick up Successful': 'Diagnosing',
  'Pick Up Failed': 'Ready for Pickup',
  'Delivery Successful': 'Delivered',
  'Delivery Failure': 'Delivery Failed',
};

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || !updates.length) return Response.json({ error: 'No updates provided' }, { status: 422 });

    const [creator] = await query(`SELECT id, display_name FROM users WHERE lower(upn) = lower($1)`, [user.username]);

    await withTransaction(async (client) => {
      for (const { case_id, sub_status, failure_reason, escalate, escalation_reason, notify_rc, intake_crate } of updates) {
        const newStage = STAGE_MAP[sub_status];
        if (!newStage) continue;

        // Get case details for log
        const caseRes = await client.query(`SELECT case_number, customer_name, facility FROM cm_cases WHERE id = $1`, [case_id]);
        const caseRow = caseRes.rows[0];
        const refreshRes = await client.query(`SELECT serial_number FROM cm_case_workflow_refresh WHERE case_id = $1`, [case_id]);
        const refreshRow = refreshRes.rows[0];

        // Log to activity log
        await client.query(
          `INSERT INTO ops_logistics_activity_log (workbook_key, cycle_version, user_id, username, display_name, event_type, case_value, customer_value, location_value, customer_asset_value, stage_value, new_sub_status, escalation_state, notify_rc_state, reason_notes, source_workbook_name, created_at)
           VALUES ('test_bulk_wo_update', 0, $1, $2, $3, 'Sub-Status Update Submitted', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'EU Support Integration', CURRENT_TIMESTAMP)`,
          [creator?.id || 0, user.username, creator?.display_name || user.username, caseRow?.case_number || case_id, caseRow?.customer_name || '', caseRow?.facility || '', refreshRow?.serial_number || '', sub_status, sub_status, escalate || false, notify_rc || false, failure_reason || escalation_reason || null]
        );

        // Update case stage (preserve Cancelled stage)
        const currentStageRes = await client.query(`SELECT stage FROM cm_cases WHERE id = $1`, [case_id]);
        const currentStage = currentStageRes.rows[0]?.stage;

        if (currentStage === 'Cancelled') {
          await client.query(`UPDATE cm_cases SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1`, [case_id]);
        } else {
          await client.query(
            `UPDATE cm_cases SET stage = $1, last_activity_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [newStage, case_id]
          );
        }

        // Set actual dates on logistics record
        if (sub_status === 'Pick up Successful') {
          await client.query(
            `UPDATE cm_case_logistics
                SET actual_pickup_date = CURRENT_DATE::TEXT,
                    intake_crate = $2,
                    picked_up_by = $3,
                    updated_at = CURRENT_TIMESTAMP
              WHERE case_id = $1`,
            [case_id, intake_crate?.trim() || null, creator?.display_name || user.username]
          );
        } else if (sub_status === 'Delivery Successful') {
          await client.query(`UPDATE cm_case_logistics SET actual_delivery_date = CURRENT_DATE::TEXT, updated_at = CURRENT_TIMESTAMP WHERE case_id = $1`, [case_id]);
        }

        // Record failure with reason
        if ((sub_status === 'Pick Up Failed' || sub_status === 'Delivery Failure') && failure_reason) {
          const failureType = sub_status === 'Pick Up Failed' ? 'pickup' : 'delivery';
          await client.query(
            `INSERT INTO cm_case_logistics_failures (id, case_id, failure_type, reason, failed_at, created_at) VALUES ($1, $2, $3, $4, CURRENT_DATE::TEXT, CURRENT_TIMESTAMP)`,
            [crypto.randomUUID(), case_id, failureType, failure_reason]
          );
        }

        // Update owning team based on new stage
        if (currentStage === 'Cancelled' && sub_status === 'Delivery Successful') {
          await client.query(`UPDATE cm_cases SET owning_team_id = 0, assigned_to_user_id = NULL, status = 'Completed', closed_at = CURRENT_TIMESTAMP WHERE id = $1`, [case_id]);
        } else if (currentStage === 'Cancelled' && sub_status === 'Delivery Failure') {
          const routeCoordId = await getTeamId('route_coordinators');
          await client.query(`UPDATE cm_cases SET owning_team_id = $1, assigned_to_user_id = NULL WHERE id = $2`, [routeCoordId, case_id]);
          await client.query(`UPDATE cm_case_logistics SET scheduled_delivery_date = NULL, delivery_resource = NULL, updated_at = CURRENT_TIMESTAMP WHERE case_id = $1`, [case_id]);
        } else if (newStage === 'Diagnosing') {
          const computerTechId = await getTeamId('computer_technicians');
          await client.query(`UPDATE cm_cases SET owning_team_id = $1 WHERE id = $2`, [computerTechId, case_id]);
        } else if (newStage === 'Delivered') {
          const orderAdminId = await getTeamId('order_administrators');
          await client.query(`UPDATE cm_cases SET owning_team_id = $1 WHERE id = $2`, [orderAdminId, case_id]);
        } else if (newStage === 'Ready for Delivery') {
          const routeCoordId = await getTeamId('route_coordinators');
          await client.query(`UPDATE cm_cases SET owning_team_id = $1 WHERE id = $2`, [routeCoordId, case_id]);
        } else if (newStage === 'Ready for Pickup') {
          const routeCoordId = await getTeamId('route_coordinators');
          await client.query(`UPDATE cm_cases SET owning_team_id = $1, assigned_to_user_id = NULL WHERE id = $2`, [routeCoordId, case_id]);
        }

        // Add system note
        await client.query(
          `INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'SystemEvent', $3, $4, CURRENT_TIMESTAMP)`,
          [crypto.randomUUID(), case_id, `Logistics update: ${sub_status}`, creator?.id || null]
        );
      }
    });

    return Response.json({ ok: true, updated: updates.length });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    console.error('[logistics/submit] Error:', err.message, err.stack);
    return Response.json({ error: 'Submission failed' }, { status: 500 });
  }
}
