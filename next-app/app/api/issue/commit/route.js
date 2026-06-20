import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { withTransaction } from '@/lib/db-write.js';

function normId(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * POST /api/issue/commit — commit checkout (issue parts from inventory)
 * Body: { work_order_no?, target_asset_location?, parts?: [{part_no, qty}], return_required_map?: {} }
 */
export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  try {
    const body = await req.json().catch(() => ({}));
    const wo = normId(body.work_order_no) || null;
    const targetLocation = (body.target_asset_location || '').trim() || null;
    const returnMap = body.return_required_map || {};

    const result = await withTransaction(async (client) => {
      // Resolve parts: from body or from cart
      let parts = [];
      if (Array.isArray(body.parts) && body.parts.length > 0) {
        for (const item of body.parts) {
          const pn = normId(typeof item === 'string' ? item : item.part_no);
          const qty = parseInt(item.qty || 1, 10);
          if (pn && qty > 0) parts.push({ part_no: pn, qty });
        }
      } else {
        const cartRows = await client.query(
          `SELECT l.part_no, COALESCE(l.qty, 1) AS qty
           FROM checkout_cart_lines l
           JOIN checkout_cart c ON c.id = l.cart_id
           WHERE c.user_id = $1 ORDER BY l.part_no`,
          [user.id]
        );
        parts = cartRows.rows.map((r) => ({ part_no: normId(r.part_no), qty: parseInt(r.qty || 1, 10) }));
      }

      if (parts.length === 0) {
        throw Object.assign(new Error('No parts selected'), { code: 'CART_EMPTY', status: 400 });
      }

      // Check stock and decrement
      for (const { part_no, qty } of parts) {
        const inv = await client.query(
          `SELECT inventory_pool, qty_on_hand FROM inventory WHERE part_no = $1 ORDER BY qty_on_hand DESC`, [part_no]
        );
        const totalStock = inv.rows.reduce((sum, r) => sum + parseInt(r.qty_on_hand, 10), 0);
        if (totalStock < qty) {
          throw Object.assign(new Error(`${part_no} out of stock`), { code: 'OUT_OF_STOCK', status: 400 });
        }

        // Decrement from pools with most stock first
        let remaining = qty;
        for (const row of inv.rows) {
          if (remaining <= 0) break;
          const avail = parseInt(row.qty_on_hand, 10);
          const take = Math.min(avail, remaining);
          await client.query(
            `UPDATE inventory SET qty_on_hand = qty_on_hand - $1, updated_at = CURRENT_TIMESTAMP WHERE part_no = $2 AND inventory_pool = $3`,
            [take, part_no, row.inventory_pool]
          );
          remaining -= take;
        }

        const retFlag = returnMap[part_no] ? 1 : 0;
        await client.query(
          `INSERT INTO transactions(type, part_no, qty, work_order_no, user_id, return_required, target_asset_location)
           VALUES ('checkout', $1, $2, $3, $4, $5, $6)`,
          [part_no, qty, wo, user.id, retFlag, targetLocation]
        );

        await client.query(
          `INSERT INTO ledger(event_time, user_id, action, part_no, qty, work_order_no, prev_qty, new_qty)
           VALUES (CURRENT_TIMESTAMP, $1, 'checkout', $2, $3, $4, $5, $6)`,
          [user.id, part_no, qty, wo, totalStock, totalStock - qty]
        );
      }

      // Clear cart
      await client.query(
        `DELETE FROM checkout_cart_lines WHERE cart_id IN (SELECT id FROM checkout_cart WHERE user_id = $1)`,
        [user.id]
      );

      return { ok: true, work_order_no: wo };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error.code === 'CART_EMPTY' || error.code === 'OUT_OF_STOCK') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return sanitizeWriteError(error);
  }
}
