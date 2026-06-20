import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const program = searchParams.get('program');
    if (!program) return Response.json({ data: [] });

    const rows = await query(`
      SELECT c.id, c.case_number, c.customer_name, c.stage, c.facility, c.program, c.created_at,
             od.bulk_order_number, od.quote_number, od.po, od.vendor, od.unit_price, od.service_fee, od.entry_type
      FROM cm_cases c
      LEFT JOIN cm_case_order_details od ON od.case_id = c.id
      WHERE c.program = $1
      ORDER BY c.created_at DESC
    `, [program]);

    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load' }, { status: 500 });
  }
}
