import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getTeamId } from '@/lib/teams.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { case_ids, quote_number, po } = await request.json();
    if (!case_ids?.length || !quote_number?.trim()) return Response.json({ error: 'case_ids and quote_number are required' }, { status: 422 });

    // Get defective parts for each case
    const placeholders = case_ids.map((_, i) => `$${i + 1}`).join(',');
    const parts = await query(`SELECT case_id, part_name, part_number FROM cm_case_defective_parts WHERE case_id IN (${placeholders})`, case_ids);

    await withTransaction(async (client) => {
      for (const caseId of case_ids) {
        const [caseRow] = (await client.query(`SELECT program FROM cm_cases WHERE id = $1`, [caseId])).rows;
        const isSpringISD = caseRow?.program === 'Refresh - Spring ISD';

        if (!isSpringISD) {
          // Standard flow: create quote entries per defective part
          const caseParts = parts.filter(p => p.case_id === caseId);
          if (caseParts.length > 0) {
            for (const p of caseParts) {
              await client.query(
                `INSERT INTO cm_case_order_details (id, case_id, quote_number, part_name, part_number, po) VALUES ($1,$2,$3,$4,$5,$6)`,
                [crypto.randomUUID(), caseId, quote_number.trim(), p.part_name, p.part_number, po?.trim() || null]
              );
            }
          } else {
            await client.query(
              `INSERT INTO cm_case_order_details (id, case_id, quote_number, part_name, part_number, po) VALUES ($1,$2,$3,$4,$5,$6)`,
              [crypto.randomUUID(), caseId, quote_number.trim(), null, null, po?.trim() || null]
            );
          }
          await client.query(`UPDATE cm_cases SET stage = 'Quoted', last_activity_at = NOW() WHERE id = $1`, [caseId]);
        } else {
          // Refresh - Spring ISD: update service_fee entry with quote/PO, no new part lines
          const sfExists = await client.query(
            `SELECT id FROM cm_case_order_details WHERE case_id = $1 AND (entry_type = 'service_fee' OR detail_type = 'service_fee') LIMIT 1`, [caseId]
          );
          if (sfExists.rows.length > 0) {
            await client.query(
              `UPDATE cm_case_order_details SET quote_number = $1, po = $2 WHERE id = $3`,
              [quote_number.trim(), po?.trim() || null, sfExists.rows[0].id]
            );
          } else {
            await client.query(
              `INSERT INTO cm_case_order_details (id, case_id, entry_type, detail_type, quote_number, po, service_fee) VALUES ($1,$2,'service_fee','service_fee',$3,$4, (SELECT service_fee FROM cm_programs WHERE name = $5))`,
              [crypto.randomUUID(), caseId, quote_number.trim(), po?.trim() || null, caseRow.program]
            );
          }
          // Auto-advance to Ready for Delivery when PO is provided
          if (po?.trim()) {
            const routeCoordId = await getTeamId('route_coordinators');
            await client.query(`UPDATE cm_cases SET stage = 'Ready for Delivery', owning_team_id = $1, last_activity_at = NOW() WHERE id = $2`, [routeCoordId, caseId]);
          } else {
            await client.query(`UPDATE cm_cases SET stage = 'Quoted', last_activity_at = NOW() WHERE id = $1`, [caseId]);
          }
        }
      }
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    console.error('[api/cases/order-details POST]', err.stack || err.message);
    return Response.json({ error: 'Failed to save order details' }, { status: 500 });
  }
}
