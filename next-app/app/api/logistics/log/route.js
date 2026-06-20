import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
export const dynamic = 'force-dynamic';

const SUPERVISOR_ROLES = ['supervisor', 'manager'];
const LOGISTICS_TEAM = 'logistics_technicians';
const RC_TEAM = 'route_coordinators';

/**
 * GET /api/logistics/log — activity log of logistics technician submissions
 * Query params: limit (1-100), offset, timeframe_days
 * Access: logistics_technicians (own entries), route_coordinators/supervisor/manager (all)
 */
export async function GET(req) {
  const user = await requireAuth(req);

  const isSupervisor = SUPERVISOR_ROLES.includes(user.role);
  const isRC = (user.teams || []).includes(RC_TEAM);
  const isLogTech = (user.teams || []).includes(LOGISTICS_TEAM);
  const includeAllUsers = isSupervisor || isRC;

  if (!isSupervisor && !isRC && !isLogTech) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
  const timeframeDays = searchParams.get('timeframe_days');

  const conditions = [`workbook_key = 'test_bulk_wo_update'`];
  const params = [];
  let idx = 1;

  if (!includeAllUsers) {
    conditions.push(`user_id = $${idx++}`);
    params.push(user.id);
  }

  if (timeframeDays) {
    const days = parseInt(timeframeDays, 10);
    if (days > 0) {
      conditions.push(`created_at >= NOW() - INTERVAL '${days} days'`);
    }
  }

  const eventType = searchParams.get('event_type');
  if (eventType) {
    conditions.push(`event_type = $${idx++}`);
    params.push(eventType);
  }

  const filterUserId = searchParams.get('user_id');
  if (filterUserId && includeAllUsers) {
    conditions.push(`user_id = $${idx++}`);
    params.push(parseInt(filterUserId, 10));
  }

  const caseSearch = searchParams.get('case_search');
  if (caseSearch) {
    conditions.push(`case_value ILIKE $${idx++}`);
    params.push(`%${caseSearch}%`);
  }

  params.push(limit, offset);

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM ops_logistics_activity_log WHERE ${conditions.join(' AND ')}`,
    params.slice(0, -2)
  );
  const total = parseInt(countRows[0]?.total || '0', 10);

  const rows = await query(
    `SELECT id, cycle_version, created_at, user_id, username, display_name, event_type,
            case_value, customer_value, location_value, customer_asset_value, stage_value,
            new_sub_status, escalation_state, notify_rc_state, reason_notes, source_workbook_name
     FROM ops_logistics_activity_log
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  // Distinct filter options (based on timeframe + access only, not current filters)
  const baseConditions = [`workbook_key = 'test_bulk_wo_update'`];
  const baseParams = [];
  if (!includeAllUsers) { baseParams.push(user.id); baseConditions.push(`user_id = $${baseParams.length}`); }
  if (timeframeDays) { const d = parseInt(timeframeDays, 10); if (d > 0) baseConditions.push(`created_at >= NOW() - INTERVAL '${d} days'`); }
  const baseWhere = baseConditions.join(' AND ');

  const [eventTypes, userOptions] = await Promise.all([
    query(`SELECT DISTINCT event_type FROM ops_logistics_activity_log WHERE ${baseWhere} ORDER BY event_type`, baseParams),
    includeAllUsers
      ? query(`SELECT DISTINCT user_id, display_name, username FROM ops_logistics_activity_log WHERE ${baseWhere} ORDER BY display_name`, baseParams)
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    total, limit, offset, data: rows,
    filterOptions: {
      eventTypes: eventTypes.map(r => r.event_type),
      users: userOptions.map(r => ({ id: r.user_id, name: r.display_name || r.username })),
    },
  });
}
