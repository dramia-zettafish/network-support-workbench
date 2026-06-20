import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { query } from '@/lib/db.js';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['supervisor', 'manager', 'admin'];

/**
 * GET /api/ledger — audit trail of all inventory changes
 * Query params: action, part_no, work_order_no, since, until, limit, offset
 */
export async function GET(req) {
  const user = await requireAuth(req);
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const partNo = searchParams.get('part_no');
  const workOrderNo = searchParams.get('work_order_no');
  const userFilter = searchParams.get('user');
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
  const SORT_COLS = { event_time: 'l.event_time', user_upn: 'u.upn', action: 'l.action', part_no: 'l.part_no', qty: 'l.qty', prev_qty: 'l.prev_qty', new_qty: 'l.new_qty', work_order_no: 'l.work_order_no' };
  const sortCol = SORT_COLS[searchParams.get('sort_col')] || 'l.event_time';
  const sortDir = searchParams.get('sort_dir') === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['1=1'];
  const params = [];
  let idx = 1;

  if (action) { conditions.push(`l.action = $${idx++}`); params.push(action); }
  if (partNo) { conditions.push(`lower(l.part_no) LIKE lower($${idx++})`); params.push('%' + partNo.trim() + '%'); }
  if (workOrderNo) {
    conditions.push(`lower(l.work_order_no) LIKE lower($${idx++})`);
    params.push(workOrderNo.trim() + '%');
  }
  if (userFilter) { conditions.push(`lower(u.upn) LIKE lower($${idx++})`); params.push('%' + userFilter.trim() + '%'); }
  if (since) { conditions.push(`l.event_time >= $${idx++}`); params.push(since); }
  if (until) { conditions.push(`l.event_time <= $${idx++}`); params.push(until); }

  const countRows = await query(
    `SELECT COUNT(*)::int AS total FROM ledger l LEFT JOIN users u ON u.id = l.user_id WHERE ${conditions.join(' AND ')}`,
    params
  );
  const total = countRows?.[0]?.total || 0;

  params.push(limit, offset);

  const rows = await query(
    `SELECT l.event_time, u.upn AS user_upn, l.action, l.part_no, l.qty,
            l.work_order_no, l.vendor_claim_no, l.prev_qty, l.new_qty, l.location
     FROM ledger l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );

  return NextResponse.json({ data: rows, total, pages: Math.ceil(total / limit) });
}
