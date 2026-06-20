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
    const rows = await query(
      'SELECT serial_number, asset_type, manufacturer, model_number, description, location, asset_status, assigned_to, assignment_date, notes FROM employee_assets ORDER BY serial_number'
    );
    return Response.json({ data: rows });
  } catch {
    return Response.json({ error: 'Unable to retrieve employee assets' }, { status: 500 });
  }
}
