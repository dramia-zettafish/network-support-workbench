import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
export const dynamic = 'force-dynamic';

/** GET /api/admin/teams — list all teams */
export async function GET(req) {
  await requireRole(['manager'], req);
  const rows = await query(
    `SELECT key, label, description, is_enabled FROM teams ORDER BY lower(label) ASC`
  );
  return NextResponse.json({ data: rows });
}
