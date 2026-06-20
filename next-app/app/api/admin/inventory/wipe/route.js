import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';

/** POST /api/admin/inventory/wipe — wipe inventory data */
export async function POST(req) {
  await requireRole(['manager'], req);
  const body = await req.json();
  const scope = (body.scope || 'inventory').toLowerCase();

  if (!['inventory', 'counts', 'all'].includes(scope)) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 422 });
  }

  await withTransaction(async (client) => {
    // Clear carts first
    try { await client.query('DELETE FROM checkout_cart_lines'); } catch {}
    try { await client.query('DELETE FROM checkout_cart'); } catch {}

    if (scope === 'counts') {
      await client.query(`UPDATE inventory SET qty_on_hand = 0, updated_at = CURRENT_TIMESTAMP`);
    } else if (scope === 'inventory') {
      await client.query('DELETE FROM inventory');
    } else if (scope === 'all') {
      await client.query('DELETE FROM inventory');
      try { await client.query('DELETE FROM parts_catalog'); } catch {}
    }
  });

  return NextResponse.json({ ok: true, scope });
}
