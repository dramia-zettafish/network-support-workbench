import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { withTransaction } from '@/lib/db-write.js';
import { query } from '@/lib/db.js';

/** Normalize part number: uppercase + collapse spaces */
function normId(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * GET /api/issue/cart — get current cart summary for the user
 */
export async function GET(req) {
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  const rows = await query(
    `SELECT l.part_no, 1 AS qty
     FROM checkout_cart_lines l
     JOIN checkout_cart c ON c.id = l.cart_id
     WHERE c.user_id = $1
     ORDER BY l.part_no ASC`,
    [user.id]
  );
  return NextResponse.json({ data: rows });
}

/**
 * POST /api/issue/cart — add part to cart or create cart
 * Body: { part_no } or { action: "clear" }
 */
export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  try {
    const body = await req.json();
    const action = body.action || 'add';

    if (action === 'clear') {
      await withTransaction(async (client) => {
        await client.query(
          `DELETE FROM checkout_cart_lines WHERE cart_id IN (SELECT id FROM checkout_cart WHERE user_id = $1)`,
          [user.id]
        );
      });
      return NextResponse.json({ ok: true });
    }

    const partNo = normId(body.part_no);
    if (!partNo) {
      return NextResponse.json({ error: 'part_no is required' }, { status: 422 });
    }

    await withTransaction(async (client) => {
      // Get or create cart
      let res = await client.query(
        `SELECT id FROM checkout_cart WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );
      let cartId;
      if (res.rows.length > 0) {
        cartId = res.rows[0].id;
      } else {
        res = await client.query(
          `INSERT INTO checkout_cart(user_id) VALUES ($1) RETURNING id`,
          [user.id]
        );
        cartId = res.rows[0].id;
      }
      // Add line (ignore duplicate)
      await client.query(
        `INSERT INTO checkout_cart_lines(cart_id, part_no, qty) VALUES ($1, $2, 1) ON CONFLICT (cart_id, part_no) DO NOTHING`,
        [cartId, partNo]
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return sanitizeWriteError(error);
  }
}
