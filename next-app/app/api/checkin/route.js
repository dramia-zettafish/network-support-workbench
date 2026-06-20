import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { withTransaction } from '@/lib/db-write.js';
import { query } from '@/lib/db.js';

function normId(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * GET /api/checkin?session_id=xxx — get session summary (grouped per part)
 */
export async function GET(req) {
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 422 });
  }

  const rows = await query(
    `SELECT t.part_no, pc.description, COALESCE(i.location,'') AS location, SUM(t.qty) AS total_qty
     FROM transactions t
     LEFT JOIN parts_catalog pc ON pc.part_no = t.part_no
     LEFT JOIN inventory i ON i.part_no = t.part_no
     WHERE t.type = 'checkin' AND t.session_id = $1 AND t.user_id = $2
     GROUP BY t.part_no, pc.description, i.location
     ORDER BY t.part_no ASC`,
    [sessionId, user.id]
  );
  return NextResponse.json({ data: rows });
}

/**
 * POST /api/checkin — check in a part (receive/return)
 * Body: { part_no, work_order_no, vendor_claim_no, session_id? }
 */
export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  try {
    const body = await req.json();
    const partNo = normId(body.part_no);
    const wo = normId(body.work_order_no);
    const vc = normId(body.vendor_claim_no);
    const sessionId = body.session_id || null;
    const pool = (body.inventory_pool || '').trim() || null;

    if (!partNo || !wo || !vc) {
      return NextResponse.json(
        { error: 'part_no, work_order_no, vendor_claim_no are required' },
        { status: 422 }
      );
    }

    await withTransaction(async (client) => {
      // Verify part exists in inventory (for supervisor/manager roles)
      if (['admin', 'supervisor', 'manager'].includes(user.role)) {
        const exists = await client.query(
          `SELECT 1 FROM inventory WHERE part_no = $1 LIMIT 1`, [partNo]
        );
        if (exists.rows.length === 0) {
          throw Object.assign(
            new Error('Part Number does not exist in inventory. Use Add to Inventory if correct.'),
            { code: 'PART_NOT_FOUND', status: 409 }
          );
        }
      }

      // Ensure catalog entry
      await client.query(
        `INSERT INTO parts_catalog(part_no, description, active) VALUES ($1, 'Uncatalogued', 1) ON CONFLICT (part_no) DO NOTHING`,
        [partNo]
      );

      // Determine target pool: use provided pool, or resolve from existing inventory row
      const poolRows = await client.query(`SELECT inventory_pool FROM inventory WHERE part_no = $1`, [partNo]);
      const targetPool = pool || (poolRows.rows.length === 1 ? poolRows.rows[0].inventory_pool : 'Operations');

      // Increment inventory (composite key: part_no + inventory_pool)
      const inv = await client.query(`SELECT qty_on_hand FROM inventory WHERE part_no = $1 AND inventory_pool = $2`, [partNo, targetPool]);
      let prev = 0;
      if (inv.rows.length === 0) {
        await client.query(`INSERT INTO inventory(part_no, qty_on_hand, inventory_pool) VALUES ($1, 0, $2)`, [partNo, targetPool]);
      } else {
        prev = parseInt(inv.rows[0].qty_on_hand, 10);
      }

      await client.query(
        `UPDATE inventory SET qty_on_hand = qty_on_hand + 1, updated_at = CURRENT_TIMESTAMP WHERE part_no = $1 AND inventory_pool = $2`,
        [partNo, targetPool]
      );

      // Transaction record
      await client.query(
        `INSERT INTO transactions(type, part_no, qty, work_order_no, vendor_claim_no, user_id, session_id)
         VALUES ('checkin', $1, 1, $2, $3, $4, $5)`,
        [partNo, wo, vc, user.id, sessionId]
      );

      // Ledger entry
      await client.query(
        `INSERT INTO ledger(event_time, user_id, action, part_no, qty, work_order_no, vendor_claim_no, prev_qty, new_qty)
         VALUES (CURRENT_TIMESTAMP, $1, 'checkin', $2, 1, $3, $4, $5, $6)`,
        [user.id, partNo, wo, vc, prev, prev + 1]
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error.code === 'PART_NOT_FOUND') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return sanitizeWriteError(error);
  }
}
