import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { case_ids, bulk_order_number, quote_number, vendor, vendor_order_number, po } = await request.json();
    if (!case_ids?.length || !bulk_order_number) return Response.json({ error: 'case_ids and bulk_order_number required' }, { status: 422 });

    await query(`ALTER TABLE cm_case_order_details ADD COLUMN IF NOT EXISTS bulk_order_number TEXT`).catch(() => {});
    await query(`ALTER TABLE cm_case_order_details ADD COLUMN IF NOT EXISTS detail_type TEXT DEFAULT 'bulk_part'`).catch(() => {});

    await withTransaction(async (client) => {
      for (const caseId of case_ids) {
        await client.query(
          `INSERT INTO cm_case_order_details (id, case_id, bulk_order_number, detail_type) VALUES ($1,$2,$3,'bulk_order')`,
          [crypto.randomUUID(), caseId, bulk_order_number]
        );
        await client.query(`UPDATE cm_cases SET stage = 'Receiving Parts', last_activity_at = NOW(), owning_team_id = (SELECT id FROM teams WHERE key = 'parts_administrators') WHERE id = $1`, [caseId]);
      }
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to link bulk order' }, { status: 500 });
  }
}
