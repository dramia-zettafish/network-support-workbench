import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const crate = searchParams.get('crate') || '';

    let sql = `SELECT c.case_number, c.customer_name, c.facility, r.serial_number, r.asset_tag, cl.intake_crate
      FROM cm_cases c
      LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id
      LEFT JOIN cm_case_logistics cl ON cl.case_id = c.id
      WHERE c.status = 'Active'`;
    const params = [];

    if (crate) {
      const crates = crate.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      sql += ` AND UPPER(cl.intake_crate) = ANY($1)`;
      params.push(crates);
    } else {
      sql += ` AND c.stage = 'Pickup Scheduled'`;
    }
    sql += crate ? ` ORDER BY cl.intake_crate, c.case_number` : ` ORDER BY c.case_number`;

    const rows = await query(sql, params);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load service tags' }, { status: 500 });
  }
}
