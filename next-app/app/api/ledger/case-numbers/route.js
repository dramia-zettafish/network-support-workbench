import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['supervisor', 'manager', 'admin'];

/**
 * GET /api/ledger/case-numbers?prefix=xxx — typeahead for work order numbers
 */
export async function GET(req) {
  const user = await requireAuth(req);
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const prefix = (searchParams.get('prefix') || '').trim();
  if (prefix.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  const rows = await query(
    `SELECT work_order_no FROM (
       SELECT work_order_no FROM work_orders
       UNION
       SELECT work_order_no FROM ledger
     ) sub
     WHERE work_order_no IS NOT NULL
       AND trim(work_order_no) <> ''
       AND lower(work_order_no) LIKE lower($1)
     ORDER BY lower(work_order_no) ASC
     LIMIT $2`,
    [prefix + '%', limit]
  );

  return NextResponse.json({ data: rows.map((r) => r.work_order_no) });
}
