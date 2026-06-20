import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { withTransaction } from '@/lib/db-write.js';

const ALLOWED_ROLES = ['supervisor', 'manager'];

export async function PATCH(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Only supervisors and managers can edit inventory' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { part_no, original_pool, qty_on_hand, location, new_part_no, description, inventory_pool } = body;
    if (!part_no) return NextResponse.json({ error: 'part_no is required' }, { status: 422 });
    const rowPool = original_pool || inventory_pool || 'Operations';

    await withTransaction(async (client) => {
      // Get current values for ledger
      const current = await client.query(
        `SELECT qty_on_hand, location FROM inventory WHERE part_no = $1 AND inventory_pool = $2`, [part_no, rowPool]
      );
      const prevQty = current.rows.length > 0 ? parseInt(current.rows[0].qty_on_hand, 10) : 0;
      const prevLocation = current.rows.length > 0 ? (current.rows[0].location || '') : '';
      const catRow = await client.query(`SELECT description FROM inventory WHERE part_no = $1 AND inventory_pool = $2`, [part_no, rowPool]);
      const prevDesc = catRow.rows.length > 0 ? (catRow.rows[0].description || '') : '';

      const sets = [];
      const params = [];
      let idx = 1;
      const newQty = qty_on_hand !== undefined ? parseInt(qty_on_hand, 10) : prevQty;
      const newLocation = location !== undefined ? location : prevLocation;
      if (qty_on_hand !== undefined) { sets.push(`qty_on_hand = $${idx++}`); params.push(newQty); }
      if (location !== undefined) { sets.push(`location = $${idx++}`); params.push(newLocation); }
      if (inventory_pool !== undefined) { sets.push(`inventory_pool = $${idx++}`); params.push(inventory_pool); }
      if (sets.length > 0) {
        sets.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(part_no);
        params.push(rowPool);
        await client.query(`UPDATE inventory SET ${sets.join(', ')} WHERE part_no = $${idx} AND inventory_pool = $${idx + 1}`, params);
      }

      // Update description on this inventory row
      if (description !== undefined) {
        await client.query(`UPDATE inventory SET description = $1 WHERE part_no = $2 AND inventory_pool = $3`, [description, part_no, rowPool]);
      }

      // Rename part_no across both tables
      if (new_part_no && new_part_no !== part_no) {
        await client.query(`UPDATE parts_catalog SET part_no = $1 WHERE part_no = $2`, [new_part_no, part_no]);
        await client.query(`UPDATE inventory SET part_no = $1 WHERE part_no = $2 AND inventory_pool = $3`, [new_part_no, part_no, rowPool]);
      }

      const ledgerPartNo = new_part_no || part_no;

      // Record qty change in ledger
      if (newQty !== prevQty) {
        await client.query(
          `INSERT INTO ledger(event_time, user_id, action, part_no, qty, work_order_no, prev_qty, new_qty)
           VALUES (CURRENT_TIMESTAMP, $1, 'adjustment', $2, $3, NULL, $4, $5)`,
          [user.id, ledgerPartNo, Math.abs(newQty - prevQty), prevQty, newQty]
        );
      }

      // Record location change in ledger
      if (newLocation !== prevLocation) {
        await client.query(
          `INSERT INTO ledger(event_time, user_id, action, part_no, qty, location, prev_qty, new_qty)
           VALUES (CURRENT_TIMESTAMP, $1, 'location_change', $2, 0, $3, NULL, NULL)`,
          [user.id, ledgerPartNo, prevLocation + ' → ' + newLocation]
        );
      }

      // Record description change in ledger
      if (description !== undefined && description !== prevDesc) {
        await client.query(
          `INSERT INTO ledger(event_time, user_id, action, part_no, qty, location)
           VALUES (CURRENT_TIMESTAMP, $1, 'description_change', $2, 0, $3)`,
          [user.id, ledgerPartNo, prevDesc + ' → ' + description]
        );
      }

      // Record part_no rename in ledger
      if (new_part_no && new_part_no !== part_no) {
        await client.query(
          `INSERT INTO ledger(event_time, user_id, action, part_no, qty, location)
           VALUES (CURRENT_TIMESTAMP, $1, 'rename', $2, 0, $3)`,
          [user.id, new_part_no, part_no + ' → ' + new_part_no]
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return sanitizeWriteError(error);
  }
}

export async function DELETE(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  if (user.role !== 'manager') {
    return NextResponse.json({ error: 'Only managers can delete inventory items' }, { status: 403 });
  }

  try {
    const { part_no, inventory_pool } = await req.json();
    if (!part_no) return NextResponse.json({ error: 'part_no is required' }, { status: 422 });

    await withTransaction(async (client) => {
      const current = await client.query(`SELECT qty_on_hand FROM inventory WHERE part_no = $1 AND COALESCE(inventory_pool, '') = COALESCE($2, '')`, [part_no, inventory_pool || null]);
      const prevQty = current.rows.length > 0 ? parseInt(current.rows[0].qty_on_hand, 10) : 0;

      await client.query(`DELETE FROM inventory WHERE part_no = $1 AND COALESCE(inventory_pool, '') = COALESCE($2, '')`, [part_no, inventory_pool || null]);

      await client.query(
        `INSERT INTO ledger(event_time, user_id, action, part_no, qty, prev_qty, new_qty) VALUES (CURRENT_TIMESTAMP, $1, 'delete', $2, $3, $3, 0)`,
        [user.id, part_no, prevQty]
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return sanitizeWriteError(error);
  }
}
