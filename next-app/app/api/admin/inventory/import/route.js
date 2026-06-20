import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';

/** POST /api/admin/inventory/import — import inventory from CSV */
export async function POST(req) {
  await requireRole(['manager'], req);

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Upload a .csv file' }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return NextResponse.json({ ok: true, imported: 0 });

  // Parse CSV header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const pnIdx = headers.indexOf('part_no');
  const descIdx = headers.indexOf('description');
  const qtyIdx = headers.includes('available') ? headers.indexOf('available') : headers.indexOf('qty');
  const locIdx = headers.indexOf('location');

  if (pnIdx === -1) {
    return NextResponse.json({ error: 'CSV must have a part_no column' }, { status: 422 });
  }

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    return {
      part_no: (cols[pnIdx] || '').toUpperCase().replace(/\s+/g, ' ').trim(),
      description: descIdx >= 0 ? cols[descIdx] || '' : '',
      qty: qtyIdx >= 0 ? Math.max(0, parseInt(cols[qtyIdx] || '0', 10) || 0) : 0,
      location: locIdx >= 0 ? cols[locIdx] || '' : '',
    };
  }).filter((r) => r.part_no);

  await withTransaction(async (client) => {
    for (const r of rows) {
      // Upsert parts_catalog
      await client.query(
        `INSERT INTO parts_catalog (part_no, description) VALUES ($1, $2)
         ON CONFLICT (part_no) DO UPDATE SET description = EXCLUDED.description`,
        [r.part_no, r.description]
      );
      // Upsert inventory
      await client.query(
        `INSERT INTO inventory (part_no, qty_on_hand, location, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (part_no, inventory_pool) DO UPDATE SET
           qty_on_hand = EXCLUDED.qty_on_hand,
           location = EXCLUDED.location,
           updated_at = CURRENT_TIMESTAMP`,
        [r.part_no, r.qty, r.location]
      );
    }
  });

  return NextResponse.json({ ok: true, imported: rows.length });
}
