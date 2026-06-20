import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

let migrated = false;
async function ensureSchema() {
  if (migrated) return;
  await query(`ALTER TABLE cm_case_order_details ADD COLUMN IF NOT EXISTS bulk_order_number TEXT`).catch(() => {});
  await query(`ALTER TABLE cm_case_order_details ADD COLUMN IF NOT EXISTS detail_type TEXT DEFAULT 'bulk_part'`).catch(() => {});
  await query(`ALTER TABLE cm_case_order_details ADD COLUMN IF NOT EXISTS unit_cost TEXT`).catch(() => {});
  await query(`ALTER TABLE cm_case_order_details ADD COLUMN IF NOT EXISTS service_fee TEXT`).catch(() => {});
  migrated = true;
}

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    await ensureSchema();
    const { id } = await params;
    const rows = await query(`SELECT id, quote_number, part_name, part_number, po, vendor, vendor_order_number, bulk_order_number, detail_type, entry_type, unit_cost, unit_price, service_fee, created_at FROM cm_case_order_details WHERE case_id = $1 ORDER BY created_at DESC`, [id]);
    return Response.json({ data: rows });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load order details' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    await ensureSchema();
    const { id } = await params;
    const { detail_type, service_fee } = await request.json();
    if (detail_type === 'service_fee') {
      const existing = await query(`SELECT id FROM cm_case_order_details WHERE case_id = $1 AND detail_type = 'service_fee' LIMIT 1`, [id]);
      if (existing.length > 0) {
        await query(`UPDATE cm_case_order_details SET service_fee = $1 WHERE id = $2`, [service_fee || null, existing[0].id]);
      } else {
        await query(`INSERT INTO cm_case_order_details (id, case_id, detail_type, service_fee) VALUES ($1,$2,'service_fee',$3)`, [crypto.randomUUID(), id, service_fee || null]);
      }
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Invalid detail_type' }, { status: 422 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to save' }, { status: 500 });
  }
}
