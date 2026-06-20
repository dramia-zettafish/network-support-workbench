import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await requireAuth(request);

    // Get user's ID
    const [userRow] = await query(`SELECT id, display_name FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    if (!userRow) return Response.json({ data: [] });

    // Get custom teams the user belongs to (non-expired)
    const teamMemberships = await query(
      `SELECT t.name FROM cm_custom_logistics_team_members m JOIN cm_custom_logistics_teams t ON t.id = m.team_id WHERE lower(m.user_upn) = lower($1) AND t.expires_at > CURRENT_TIMESTAMP`,
      [user.username]
    );
    const teamNames = teamMemberships.map(t => `[Team] ${t.name}`);

    // Build resource match conditions: user's display_name OR any team names
    const resourceMatches = [userRow.display_name, user.username, ...teamNames].filter(Boolean);

    // Query cases assigned to this user directly OR via pickup/delivery resource
    const cases = await query(
      `SELECT c.id, c.case_number, c.customer_name, c.facility, c.stage, c.status, c.last_activity_at,
              cl.scheduled_pickup_date, cl.pickup_resource, cl.scheduled_delivery_date, cl.delivery_resource,
              r.serial_number, r.model_name, r.device_type,
              (SELECT COUNT(*) FROM cm_case_logistics_failures f WHERE f.case_id = c.id AND f.failure_type = 'pickup')::int AS pickup_failure_count
       FROM cm_cases c
       LEFT JOIN cm_case_logistics cl ON cl.case_id = c.id
       LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id
       WHERE c.workflow_key = 'refresh'
         AND c.status = 'Active'
         AND (
           (c.stage IN ('Pickup Scheduled', 'Ready for Pickup')
            AND (c.assigned_to_user_id = $1 OR cl.pickup_resource = ANY($2))
            AND cl.scheduled_pickup_date <= CURRENT_DATE::TEXT)
           OR
           (c.stage IN ('Delivery Scheduled', 'Ready for Delivery', 'Cancelled')
            AND (c.assigned_to_user_id = $1 OR cl.delivery_resource = ANY($2))
            AND (cl.scheduled_delivery_date IS NULL OR cl.scheduled_delivery_date <= CURRENT_DATE::TEXT))
         )
       ORDER BY c.last_activity_at DESC`,
      [userRow.id, resourceMatches]
    );

    return Response.json({ data: cases, display_name: userRow.display_name });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load cases' }, { status: 500 });
  }
}
