import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  await requireAuth(req);
  const rows = await query(`SELECT id, name FROM cm_defective_parts_catalog WHERE is_enabled = 1 ORDER BY lower(name) ASC`);
  return NextResponse.json({ data: rows });
}
