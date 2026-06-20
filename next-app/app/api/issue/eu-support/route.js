import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getTeamId } from '@/lib/teams.js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    // Get cases in Part Distribution stage with their defective parts (not yet issued)
    const rows = await query(`
      SELECT c.id as case_id, c.case_number, c.customer_name, c.facility, c.program,
             dp.id as part_id, dp.part_name, dp.part_number, dp.condition,
             i.part_no as inv_part_no, i.location as part_location, i.qty_on_hand,
             n.body as asset_location_body
      FROM cm_cases c
      JOIN cm_case_defective_parts dp ON dp.case_id = c.id
      LEFT JOIN inventory i ON upper(i.part_no) = upper(dp.part_number) AND COALESCE(i.inventory_pool, '') = COALESCE(c.program, '')
      LEFT JOIN cm_case_notes n ON n.case_id = c.id AND n.note_type = 'AssetLocation'
      WHERE c.stage = 'Part Distribution'
        AND dp.issued_at IS NULL
      ORDER BY c.case_number, dp.created_at
    `);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const body = await request.json();
    const { part_id, case_id, inv_part_no, return_required } = body;

    if (!part_id || !case_id || !inv_part_no) return Response.json({ error: 'Missing required fields' }, { status: 422 });

    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);

    await withTransaction(async (client) => {
      // Deduct from inventory
      const res = await client.query(`UPDATE inventory SET qty_on_hand = qty_on_hand - 1, updated_at = CURRENT_TIMESTAMP WHERE part_no = $1 AND qty_on_hand > 0 RETURNING qty_on_hand`, [inv_part_no]);
      if (!res.rows.length) throw new Error('Part out of stock');

      // Mark defective part as issued
      await client.query(`UPDATE cm_case_defective_parts SET issued_at = CURRENT_TIMESTAMP WHERE id = $1`, [part_id]);

      // Record in ledger
      const caseRow = await client.query(`SELECT case_number FROM cm_cases WHERE id = $1`, [case_id]);
      await client.query(
        `INSERT INTO ledger (event_time, user_id, action, part_no, qty, prev_qty, new_qty, work_order_no) VALUES (CURRENT_TIMESTAMP, $1, 'issue', $2, 1, $3, $4, $5)`,
        [creator?.id || null, inv_part_no, res.rows[0].qty_on_hand + 1, res.rows[0].qty_on_hand, caseRow.rows[0]?.case_number || null]
      );

      // Create bulk_part order detail entry — consume from stock sources FIFO
      const partInfo = await client.query(`SELECT part_name, part_number FROM cm_case_defective_parts WHERE id = $1`, [part_id]);
      const caseInfo = await client.query(`SELECT program FROM cm_cases WHERE id = $1`, [case_id]);
      const pi = partInfo.rows[0] || {};
      const caseProgram = caseInfo.rows[0]?.program || null;
      let bulkOrderNumber = null, unitCost = null, unitPrice = null, po = null, vendor = null, vendorOrderNumber = null;

      // Look up stock source FIFO (oldest first)
      const sourceRes = await client.query(
        `SELECT id, bulk_order_number, cost, sales_order, vendor, vendor_order_number FROM inventory_stock_sources WHERE part_no = $1 AND COALESCE(inventory_pool, '') = COALESCE($2, '') AND qty_remaining > 0 ORDER BY received_at ASC LIMIT 1`,
        [inv_part_no.toUpperCase(), caseProgram]
      );
      if (sourceRes.rows.length > 0) {
        const src = sourceRes.rows[0];
        bulkOrderNumber = src.bulk_order_number;
        unitCost = src.cost;
        po = src.sales_order;
        vendor = src.vendor;
        vendorOrderNumber = src.vendor_order_number;
        if (bulkOrderNumber) {
          const boPriceRes = await client.query(`SELECT unit_price FROM cm_bulk_orders WHERE bulk_order_number = $1 AND part_number = $2 LIMIT 1`, [bulkOrderNumber, inv_part_no.toUpperCase()]);
          if (boPriceRes.rows.length > 0) unitPrice = boPriceRes.rows[0].unit_price;
        }
        // Decrement the source
        await client.query(`UPDATE inventory_stock_sources SET qty_remaining = qty_remaining - 1 WHERE id = $1`, [src.id]);
      }

      await client.query(
        `INSERT INTO cm_case_order_details (id, case_id, part_name, part_number, bulk_order_number, po, vendor, vendor_order_number, unit_cost, unit_price, detail_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'bulk_part')`,
        [crypto.randomUUID(), case_id, pi.part_name || null, pi.part_number || null, bulkOrderNumber, po, vendor, vendorOrderNumber, unitCost, unitPrice]
      );

      // Check if all parts for this case are now issued
      const remaining = await client.query(`SELECT COUNT(*) as cnt FROM cm_case_defective_parts WHERE case_id = $1 AND issued_at IS NULL`, [case_id]);
      if (parseInt(remaining.rows[0].cnt) === 0) {
        // Advance case to Repairing with Computer Technicians
        const computerTechId = await getTeamId('computer_technicians');
        await client.query(`UPDATE cm_cases SET stage = 'Repairing', owning_team_id = $1, last_activity_at = CURRENT_TIMESTAMP WHERE id = $2`, [computerTechId, case_id]);
      }
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: err.message || 'Issue failed' }, { status: 500 });
  }
}
