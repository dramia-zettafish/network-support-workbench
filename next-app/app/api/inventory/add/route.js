import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { withTransaction } from '@/lib/db-write.js';

const ALLOWED_ROLES = ['supervisor', 'manager'];

export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Only supervisors and managers can add parts' }, { status: 403 });
  }

  try {
    const { part_no, description, qty_on_hand, location, inventory_pool } = await req.json();
    if (!part_no || !part_no.trim()) return NextResponse.json({ error: 'Part No is required' }, { status: 422 });

    const pn = part_no.trim().toUpperCase();
    const desc = (description || '').trim();
    const qty = parseInt(qty_on_hand || 0, 10);
    const loc = (location || '').trim();
    const pool = (inventory_pool || '').trim() || 'Operations';

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO parts_catalog(part_no, description, active) VALUES ($1, $2, 1) ON CONFLICT (part_no) DO NOTHING`,
        [pn, desc]
      );
      await client.query(
        `INSERT INTO inventory(part_no, qty_on_hand, location, inventory_pool, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (part_no, inventory_pool) DO NOTHING`,
        [pn, qty, loc, pool]
      );
      await client.query(
        `INSERT INTO ledger(event_time, user_id, action, part_no, qty, prev_qty, new_qty)
         VALUES (CURRENT_TIMESTAMP, $1, 'add_part', $2, $3, 0, $3)`,
        [user.id, pn, qty]
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return sanitizeWriteError(error);
  }
}
