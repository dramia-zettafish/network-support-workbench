import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const rows = await query(`SELECT * FROM cm_case_depot_repair WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]);
    return Response.json({ data: rows[0] || null });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to load depot repair' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { manufacturer_case_number, engagement_date, outbound_carrier, outbound_tracking, outcome, inbound_carrier, inbound_tracking } = body;

    await withTransaction(async (client) => {
      // Upsert - delete existing then insert
      await client.query(`DELETE FROM cm_case_depot_repair WHERE case_id = $1`, [id]);
      await client.query(
        `INSERT INTO cm_case_depot_repair (id, case_id, manufacturer_case_number, engagement_date, outbound_carrier, outbound_tracking, outcome, inbound_carrier, inbound_tracking, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [crypto.randomUUID(), id, manufacturer_case_number?.trim() || null, engagement_date?.trim() || null, outbound_carrier?.trim() || null, outbound_tracking?.trim() || null, outcome?.trim() || null, inbound_carrier?.trim() || null, inbound_tracking?.trim() || null]
      );
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to save depot repair' }, { status: 500 });
  }
}
