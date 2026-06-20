import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return Response.json({ data: [] });

    const sql = `SELECT c.case_number, c.customer_name, c.facility, r.serial_number, r.asset_tag, cl.intake_crate
      FROM cm_cases c
      LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id
      LEFT JOIN cm_case_logistics cl ON cl.case_id = c.id
      WHERE c.status = 'Active'
        AND (UPPER(c.case_number) LIKE $1 OR UPPER(r.serial_number) LIKE $1 OR UPPER(cl.intake_crate) LIKE $1)
      ORDER BY c.case_number
      LIMIT 20`;

    const rows = await query(sql, [`%${q.toUpperCase()}%`]);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
