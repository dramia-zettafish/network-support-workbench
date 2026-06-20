import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
  } catch { return Response.json({ error: 'Authentication required' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);

  if (searchParams.get('customers')) {
    const rows = await query(`SELECT customer_name AS name, COUNT(*)::int AS count FROM cm_cases WHERE customer_name IS NOT NULL AND customer_name != '' GROUP BY customer_name ORDER BY count DESC`);
    return Response.json({ customers: rows });
  }

  if (searchParams.get('customer_workflows')) {
    const customer = searchParams.get('customer_workflows');
    const rows = await query(`SELECT workflow_key, COUNT(*)::int AS count FROM cm_cases WHERE customer_name = $1 AND workflow_key IS NOT NULL GROUP BY workflow_key ORDER BY count DESC`, [customer]);
    return Response.json({ workflows: rows });
  }

  if (searchParams.get('customer_report')) {
    const customer = searchParams.get('customer_report');
    const wf = searchParams.get('workflow') || '';
    const prog = searchParams.get('program') || '';
    const conds = ['customer_name = $1'];
    const p = [customer];
    let idx = 2;
    if (wf) { conds.push(`workflow_key = $${idx++}`); p.push(wf); }
    if (prog) { conds.push(`program = $${idx++}`); p.push(prog); }
    const w = conds.join(' AND ');

    const [byStage, byFacility, inventory, partsCancelled, partsActive, bulkOrders] = await Promise.all([
      query(`SELECT stage, COUNT(*)::int AS count FROM cm_cases WHERE ${w} GROUP BY stage ORDER BY count DESC`, p),
      query(`SELECT facility, stage, COUNT(*)::int AS count FROM cm_cases WHERE ${w} AND facility IS NOT NULL AND facility != '' GROUP BY facility, stage ORDER BY facility, count DESC`, p),
      prog
        ? query(`SELECT i.part_no, i.description, i.qty_on_hand FROM inventory i WHERE i.inventory_pool = $1 ORDER BY i.description`, [prog])
        : [],
      query(`SELECT c.facility, r.manufacturer, r.model_name, dp.part_name, COUNT(*)::int AS count FROM cm_case_defective_parts dp JOIN cm_cases c ON c.id = dp.case_id LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id WHERE ${w} AND c.stage = 'Cancelled' GROUP BY c.facility, r.manufacturer, r.model_name, dp.part_name ORDER BY r.model_name, count DESC`, p),
      query(`SELECT c.facility, r.manufacturer, r.model_name, dp.part_name, COUNT(*)::int AS count FROM cm_case_defective_parts dp JOIN cm_cases c ON c.id = dp.case_id LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id WHERE ${w} AND c.stage != 'Cancelled' GROUP BY c.facility, r.manufacturer, r.model_name, dp.part_name ORDER BY r.model_name, count DESC`, p),
      prog
        ? query(`SELECT part_number, part_name, SUM(quantity::int) AS total_qty, unit_price FROM cm_bulk_orders WHERE program = $1 GROUP BY part_number, part_name, unit_price ORDER BY part_name`, [prog])
        : [],
    ]);

    return Response.json({ byStage, byFacility, inventory, partsCancelled, partsActive, bulkOrders });
  }

  if (searchParams.get('customer_programs')) {
    const customer = searchParams.get('customer_programs');
    const wf = searchParams.get('workflow') || '';
    const rows = await query(`SELECT program AS name, COUNT(*)::int AS count FROM cm_cases WHERE customer_name = $1 AND workflow_key = $2 AND program IS NOT NULL AND program != '' GROUP BY program ORDER BY count DESC`, [customer, wf]);
    return Response.json({ programs: rows });
  }

  const workflow = searchParams.get('workflow') || '';
  const program = searchParams.get('program') || '';

  const conditions = [];
  const params = [];
  let idx = 1;
  if (workflow) { conditions.push(`c.workflow_key = $${idx++}`); params.push(workflow); }
  if (program) { conditions.push(`c.program = $${idx++}`); params.push(program); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [stageRows, weeklyRows, teamRows, avgAge, diagRows, repairRows, checkinRows, checkoutRows, pickupRows, deliveryRows] = await Promise.all([
    query(`SELECT c.stage, COUNT(*)::int AS count FROM cm_cases c ${where} GROUP BY c.stage ORDER BY count DESC`, params),
    query(`SELECT to_char(date_trunc('week', c.created_at::timestamptz), 'YYYY-MM-DD') AS week, COUNT(*)::int AS count FROM cm_cases c ${where} ${where ? 'AND' : 'WHERE'} c.created_at IS NOT NULL GROUP BY week ORDER BY week DESC LIMIT 12`, params),
    query(`SELECT COALESCE(t.label, 'Unassigned') AS team, COUNT(*)::int AS count FROM cm_cases c LEFT JOIN teams t ON t.id = c.owning_team_id ${where} GROUP BY t.label ORDER BY count DESC`, params),
    query(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - c.created_at::timestamptz)) / 86400))::int AS avg_days FROM cm_cases c ${where} ${where ? 'AND' : 'WHERE'} c.stage NOT IN ('Closed', 'Cancelled')`, params),
    query(`SELECT to_char(n.created_at::timestamptz, 'YYYY-MM-DD') AS day, COALESCE(u.display_name, u.upn, 'Unknown') AS tech, COUNT(*)::int AS count FROM cm_case_notes n JOIN cm_cases c ON c.id = n.case_id LEFT JOIN users u ON u.id = n.created_by_user_id ${where} ${where ? 'AND' : 'WHERE'} n.note_type = 'Diagnostic' AND n.created_at::timestamptz >= NOW() - INTERVAL '30 days' GROUP BY day, tech ORDER BY day ASC, count DESC`, params),
    query(`SELECT to_char(n.created_at::timestamptz, 'YYYY-MM-DD') AS day, COALESCE(u.display_name, u.upn, 'Unknown') AS tech, COUNT(*)::int AS count FROM cm_case_notes n JOIN cm_cases c ON c.id = n.case_id LEFT JOIN users u ON u.id = n.created_by_user_id ${where} ${where ? 'AND' : 'WHERE'} n.note_type = 'Repair' AND n.created_at::timestamptz >= NOW() - INTERVAL '30 days' GROUP BY day, tech ORDER BY day ASC, count DESC`, params),
    query(`SELECT to_char(l.event_time::timestamptz, 'YYYY-MM-DD') AS day, COALESCE(u.display_name, u.upn, 'Unknown') AS tech, SUM(l.qty)::int AS count FROM ledger l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN inventory i ON i.part_no = l.part_no WHERE lower(l.action) = 'checkin' AND l.event_time::timestamptz >= NOW() - INTERVAL '30 days'${program ? ' AND i.inventory_pool = $1' : ''} GROUP BY day, tech ORDER BY day ASC, count DESC`, program ? [program] : []),
    query(`SELECT to_char(l.event_time::timestamptz, 'YYYY-MM-DD') AS day, COALESCE(u.display_name, u.upn, 'Unknown') AS tech, SUM(l.qty)::int AS count FROM ledger l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN inventory i ON i.part_no = l.part_no WHERE lower(l.action) IN ('checkout', 'issue') AND l.event_time::timestamptz >= NOW() - INTERVAL '30 days'${program ? ' AND i.inventory_pool = $1' : ''} GROUP BY day, tech ORDER BY day ASC, count DESC`, program ? [program] : []),
    query(`SELECT cl.actual_pickup_date AS day, COALESCE(cl.picked_up_by, 'Unassigned') AS tech, COUNT(*)::int AS count FROM cm_case_logistics cl JOIN cm_cases c ON c.id = cl.case_id ${where} ${where ? 'AND' : 'WHERE'} cl.actual_pickup_date IS NOT NULL AND cl.actual_pickup_date::timestamptz >= NOW() - INTERVAL '30 days' GROUP BY day, tech ORDER BY day ASC, count DESC`, params),
    query(`SELECT cl.scheduled_delivery_date AS day, COALESCE(cl.delivery_resource, 'Unassigned') AS tech, COUNT(*)::int AS count FROM cm_case_logistics cl JOIN cm_cases c ON c.id = cl.case_id ${where} ${where ? 'AND' : 'WHERE'} cl.scheduled_delivery_date IS NOT NULL AND cl.scheduled_delivery_date::timestamptz >= NOW() - INTERVAL '30 days' GROUP BY day, tech ORDER BY day ASC, count DESC`, params),
  ]);

  return Response.json({
    by_stage: stageRows,
    by_week: weeklyRows.reverse(),
    by_team: teamRows,
    diagnostics: diagRows,
    repairs: repairRows,
    checkins: checkinRows,
    checkouts: checkoutRows,
    pickups: pickupRows,
    deliveries: deliveryRows,
    avg_age_days: avgAge[0]?.avg_days || 0,
    total: stageRows.reduce((s, r) => s + r.count, 0),
    open: stageRows.filter(r => !['Closed', 'Cancelled'].includes(r.stage)).reduce((s, r) => s + r.count, 0),
  });
}
