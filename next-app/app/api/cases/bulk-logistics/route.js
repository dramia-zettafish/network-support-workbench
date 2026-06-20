import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getTeamId } from '@/lib/teams.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const body = await request.json();
    const { case_ids, scheduled_pickup_date, pickup_resource, scheduled_delivery_date, delivery_resource } = body;

    if (!Array.isArray(case_ids) || !case_ids.length) return Response.json({ error: 'case_ids required' }, { status: 422 });

    await withTransaction(async (client) => {
      // Resolve resource to user_id if it's an individual (not a team)
      let assignToUserId = null;
      if (pickup_resource && !pickup_resource.startsWith('[Team]')) {
        const res = await client.query(`SELECT id FROM users WHERE display_name = $1 OR upn = $1`, [pickup_resource]);
        if (res.rows[0]) assignToUserId = res.rows[0].id;
      }

      // Same for delivery resource
      let deliveryAssignId = null;
      if (delivery_resource && !delivery_resource.startsWith('[Team]')) {
        const res = await client.query(`SELECT id FROM users WHERE display_name = $1 OR upn = $1`, [delivery_resource]);
        if (res.rows[0]) deliveryAssignId = res.rows[0].id;
      }

      const [bulkCreator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);

      for (const caseId of case_ids) {
        await client.query(
          `INSERT INTO cm_case_logistics (case_id, scheduled_pickup_date, pickup_resource, scheduled_delivery_date, delivery_resource, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (case_id) DO UPDATE SET
             scheduled_pickup_date = COALESCE(NULLIF($2, ''), cm_case_logistics.scheduled_pickup_date),
             pickup_resource = COALESCE(NULLIF($3, ''), cm_case_logistics.pickup_resource),
             scheduled_delivery_date = COALESCE(NULLIF($4, ''), cm_case_logistics.scheduled_delivery_date),
             delivery_resource = COALESCE(NULLIF($5, ''), cm_case_logistics.delivery_resource),
             updated_at = CURRENT_TIMESTAMP`,
          [caseId, scheduled_pickup_date || null, pickup_resource || null, scheduled_delivery_date || null, delivery_resource || null]
        );
        const logisticsTeamId = await getTeamId('logistics_technicians');

        // Audit notes for scheduling
        if (scheduled_pickup_date) {
          await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), caseId, `Scheduled Pickup Date changed from "(blank)" to "${scheduled_pickup_date}" by user: ${user.username}`, bulkCreator?.id || null]);
          if (pickup_resource) await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), caseId, `Pickup Resource changed from "(blank)" to "${pickup_resource}" by user: ${user.username}`, bulkCreator?.id || null]);
        }
        if (scheduled_delivery_date) {
          await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), caseId, `Scheduled Delivery Date changed from "(blank)" to "${scheduled_delivery_date}" by user: ${user.username}`, bulkCreator?.id || null]);
          if (delivery_resource) await client.query(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), caseId, `Delivery Resource changed from "(blank)" to "${delivery_resource}" by user: ${user.username}`, bulkCreator?.id || null]);
        }

        if (scheduled_pickup_date) {
          await client.query(`UPDATE cm_cases SET stage = 'Pickup Scheduled', owning_team_id = $2, last_activity_at = CURRENT_TIMESTAMP WHERE id = $1 AND stage != 'Cancelled'`, [caseId, logisticsTeamId]);
          await client.query(`UPDATE cm_cases SET owning_team_id = $2, last_activity_at = CURRENT_TIMESTAMP WHERE id = $1 AND stage = 'Cancelled'`, [caseId, logisticsTeamId]);
        } else if (scheduled_delivery_date) {
          await client.query(`UPDATE cm_cases SET stage = 'Delivery Scheduled', owning_team_id = $2, last_activity_at = CURRENT_TIMESTAMP WHERE id = $1 AND stage != 'Cancelled'`, [caseId, logisticsTeamId]);
          await client.query(`UPDATE cm_cases SET owning_team_id = $2, last_activity_at = CURRENT_TIMESTAMP WHERE id = $1 AND stage = 'Cancelled'`, [caseId, logisticsTeamId]);
        }
        // Assign to resource user
        if (pickup_resource && assignToUserId) {
          await client.query(`UPDATE cm_cases SET assigned_to_user_id = $1, last_activity_at = CURRENT_TIMESTAMP WHERE id = $2`, [assignToUserId, caseId]);
        } else if (delivery_resource && deliveryAssignId) {
          await client.query(`UPDATE cm_cases SET assigned_to_user_id = $1, last_activity_at = CURRENT_TIMESTAMP WHERE id = $2`, [deliveryAssignId, caseId]);
        }
      }
    });

    return Response.json({ ok: true, updated: case_ids.length });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}
