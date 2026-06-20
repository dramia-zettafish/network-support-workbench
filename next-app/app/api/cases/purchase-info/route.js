import { requireAuth } from '@/lib/auth';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getTeamId } from '@/lib/teams.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { case_ids, po, vendor, vendor_order_number, quote_number } = await request.json();
    if (!case_ids?.length || !po?.trim()) return Response.json({ error: 'case_ids and po are required' }, { status: 422 });

    await withTransaction(async (client) => {
      for (const caseId of case_ids) {
        if (quote_number) {
          await client.query(
            `UPDATE cm_case_order_details SET po = $1, vendor = $2, vendor_order_number = $3 WHERE case_id = $4 AND quote_number = $5`,
            [po.trim(), vendor || null, vendor_order_number || null, caseId, quote_number]
          );
        } else {
          await client.query(
            `UPDATE cm_case_order_details SET po = $1, vendor = $2, vendor_order_number = $3 WHERE case_id = $4`,
            [po.trim(), vendor || null, vendor_order_number || null, caseId]
          );
        }
        const partsAdminId = await getTeamId('parts_administrators');
        await client.query(`UPDATE cm_cases SET stage = 'Part Distribution', owning_team_id = $1, last_activity_at = NOW() WHERE id = $2`, [partsAdminId, caseId]);
      }
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    console.error('[api/cases/purchase-info POST]', err.stack || err.message);
    return Response.json({ error: 'Failed to save purchase info' }, { status: 500 });
  }
}
