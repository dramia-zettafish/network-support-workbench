import { query } from '@/lib/db.js';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
  } catch {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const rows = await query('SELECT id, mac_address, location, date_added, date_issued, customer_issued_to, case_issued_on FROM alto_inventory ORDER BY mac_address');
    return Response.json({ data: rows });
  } catch {
    return Response.json({ data: [] });
  }
}
