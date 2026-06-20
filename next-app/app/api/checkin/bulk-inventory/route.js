import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    const { items } = await request.json();
    if (!items?.length) return Response.json({ error: 'No items provided' }, { status: 422 });

    const [userRow] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    const userId = userRow?.id || null;

    // Validate counts against remaining quantities before processing
    for (const item of items) {
      const { id, count } = item;
      if (!id || !count) continue;
      const orderRow = await query(`SELECT quantity, COALESCE(qty_received, 0) AS qty_received FROM cm_bulk_orders WHERE id = $1`, [id]);
      if (!orderRow.length) return Response.json({ error: `Order ${id} not found` }, { status: 404 });
      const remaining = (parseInt(orderRow[0].quantity) || 0) - (parseInt(orderRow[0].qty_received) || 0);
      if (count > remaining) return Response.json({ error: `Cannot check in ${count} — only ${remaining} remaining for that order line` }, { status: 409 });
    }

    await withTransaction(async (client) => {
      for (const item of items) {
        const { id, part_number, part_name, program, count } = item;
        if (!part_number || !count) continue;

        // Update qty_received on the bulk order
        if (id) await client.query(`UPDATE cm_bulk_orders SET qty_received = COALESCE(qty_received, 0) + $1 WHERE id = $2`, [count, id]);

        // Record stock source for traceability
        if (id) {
          const [boInfo] = (await client.query(`SELECT bulk_order_number, cost, sales_order, vendor, vendor_order_number FROM cm_bulk_orders WHERE id = $1`, [id])).rows;
          if (boInfo) {
            await client.query(
              `INSERT INTO inventory_stock_sources (part_no, inventory_pool, bulk_order_id, bulk_order_number, cost, sales_order, vendor, vendor_order_number, qty_remaining) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [part_number.toUpperCase(), program || null, id, boInfo.bulk_order_number, boInfo.cost, boInfo.sales_order, boInfo.vendor, boInfo.vendor_order_number, count]
            );
          }
        }

        // Ensure part exists in parts_catalog
        const desc = part_name?.trim() || 'Uncatalogued';
        await client.query(`INSERT INTO parts_catalog(part_no, description, active) VALUES ($1, $2, 1) ON CONFLICT (part_no) DO UPDATE SET description = CASE WHEN parts_catalog.description = 'Uncatalogued' THEN $2 ELSE parts_catalog.description END`, [part_number.toUpperCase(), desc]);

        // Upsert inventory: insert or increment qty_on_hand matching part_no + inventory_pool
        const pool = program || 'Operations';
        const inv = await client.query(`SELECT qty_on_hand FROM inventory WHERE part_no = $1 AND inventory_pool = $2`, [part_number.toUpperCase(), pool]);

        await client.query(
          `INSERT INTO inventory(part_no, qty_on_hand, inventory_pool, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (part_no, inventory_pool) DO UPDATE SET qty_on_hand = inventory.qty_on_hand + $2, updated_at = CURRENT_TIMESTAMP`,
          [part_number.toUpperCase(), count, pool]
        );

        // Ledger entry
        const prevQty = inv.rows.length > 0 ? inv.rows[0].qty_on_hand : 0;
        await client.query(
          `INSERT INTO ledger(event_time, user_id, action, part_no, qty, prev_qty, new_qty) VALUES (CURRENT_TIMESTAMP, $1, 'CHECKIN', $2, $3, $4, $5)`,
          [userId, part_number.toUpperCase(), count, prevQty, prevQty + count]
        );
      }
    });

    // Auto-flip cases from "Receiving Parts" to "Issuing Parts" if all parts now in stock
    try {
      const partNumbers = [...new Set(items.map(i => i.part_number?.toUpperCase()).filter(Boolean))];
      if (partNumbers.length > 0) {
        // Find cases in Receiving Parts that have any of the checked-in part numbers
        const phParts = partNumbers.map((_, i) => `$${i + 1}`).join(',');
        const candidateCases = await query(
          `SELECT DISTINCT c.id, c.program, c.created_at FROM cm_cases c
           JOIN cm_case_defective_parts dp ON dp.case_id = c.id
           WHERE c.stage = 'Receiving Parts' AND upper(dp.part_number) IN (${phParts})
           ORDER BY c.created_at ASC`,
          partNumbers
        );

        // Track available inventory (part_no+pool -> qty)
        const availableStock = {};
        const getStock = async (partNo, pool) => {
          const key = `${partNo}||${pool || ''}`;
          if (availableStock[key] === undefined) {
            const [row] = await query(`SELECT qty_on_hand FROM inventory WHERE part_no = $1 AND COALESCE(inventory_pool, '') = COALESCE($2, '')`, [partNo, pool || null]);
            availableStock[key] = row ? parseInt(row.qty_on_hand) || 0 : 0;
          }
          return availableStock[key];
        };

        const casesToFlip = [];
        for (const c of candidateCases) {
          // Get all defective parts for this case
          const caseParts = await query(`SELECT upper(part_number) as part_number FROM cm_case_defective_parts WHERE case_id = $1 AND part_number IS NOT NULL`, [c.id]);
          if (caseParts.length === 0) continue;

          // Check if all parts have sufficient stock
          let canFill = true;
          const needed = {};
          for (const p of caseParts) {
            needed[p.part_number] = (needed[p.part_number] || 0) + 1;
          }
          for (const [pn, qty] of Object.entries(needed)) {
            const stock = await getStock(pn, c.program);
            if (stock < qty) { canFill = false; break; }
          }
          if (canFill) {
            // Reserve stock
            for (const [pn, qty] of Object.entries(needed)) {
              const key = `${pn}||${c.program || ''}`;
              availableStock[key] -= qty;
            }
            casesToFlip.push(c.id);
          }
        }

        if (casesToFlip.length > 0) {
          const phCases = casesToFlip.map((_, i) => `$${i + 1}`).join(',');
          await query(`UPDATE cm_cases SET stage = 'Part Distribution', last_activity_at = NOW() WHERE id IN (${phCases})`, casesToFlip);
        }
      }
    } catch (e) { console.error('[auto-stage-flip]', e.message); }

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    console.error('[api/checkin/bulk-inventory POST]', err.stack || err.message);
    return Response.json({ error: 'Failed to check in' }, { status: 500 });
  }
}
