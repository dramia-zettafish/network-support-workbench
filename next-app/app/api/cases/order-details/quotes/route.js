import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const caseIds = (searchParams.get('case_ids') || '').split(',').filter(Boolean);
    if (!caseIds.length) return Response.json({ data: [] });
    const placeholders = caseIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await query(`SELECT DISTINCT quote_number FROM cm_case_order_details WHERE case_id IN (${placeholders}) AND quote_number IS NOT NULL ORDER BY quote_number`, caseIds);
    return Response.json({ data: rows.map(r => r.quote_number) });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load quotes' }, { status: 500 });
  }
}
