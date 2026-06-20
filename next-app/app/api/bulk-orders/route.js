import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Idempotent migration
let migrated = false;
async function ensureSchema() {
  if (migrated) return;
  await query(`ALTER TABLE cm_bulk_orders ADD COLUMN IF NOT EXISTS bulk_order_number TEXT`).catch(() => {});
  migrated = true;
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureSchema();
    const rows = await query(`SELECT bo.*, u.display_name as submitted_by FROM cm_bulk_orders bo LEFT JOIN users u ON u.id = bo.submitted_by_user_id ORDER BY bo.created_at DESC`);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load bulk orders' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    await ensureSchema();
    const body = await request.json();
    const { lines, program } = body;
    if (!lines?.length) return Response.json({ error: 'At least one line is required' }, { status: 422 });

    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    const creatorId = creator?.id || null;

    // Generate next bulk order number
    const [maxRow] = await query(`SELECT bulk_order_number FROM cm_bulk_orders WHERE bulk_order_number IS NOT NULL ORDER BY bulk_order_number DESC LIMIT 1`);
    const lastNum = maxRow?.bulk_order_number ? parseInt(maxRow.bulk_order_number.replace('BO-', ''), 10) || 0 : 0;
    const bulkOrderNumber = `BO-${String(lastNum + 1).padStart(4, '0')}`;

    await withTransaction(async (client) => {
      for (const line of lines) {
        await client.query(
          `INSERT INTO cm_bulk_orders (id, part_name, part_number, quantity, cost, unit_price, quote, sales_order, vendor_order_number, vendor, program, status, submitted_by_user_id, bulk_order_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'submitted',$12,$13)`,
          [crypto.randomUUID(), line.part_name?.trim() || null, line.part_number?.trim() || null, line.quantity?.trim() || null, line.cost?.trim() || null, line.unit_price?.trim() || null, line.quote?.trim() || null, line.sales_order?.trim() || null, line.vendor_order_number?.trim() || null, line.vendor?.trim() || null, program?.trim() || null, creatorId, bulkOrderNumber]
        );
      }
    });

    return Response.json({ ok: true, created: lines.length, total_quantity: lines.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0), bulk_order_number: bulkOrderNumber }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    console.error('[api/bulk-orders POST]', err.stack || err.message);
    return Response.json({ error: 'Failed to submit bulk orders' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireAuth(request);
    if (user.role !== 'manager') return Response.json({ error: 'Manager role required' }, { status: 403 });
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 422 });
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM cm_bulk_orders WHERE id = $1`, [id]);
    });
    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
