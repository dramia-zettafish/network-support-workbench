/**
 * GET /api/logistics/rows
 *
 * Returns normalized rows from the active workbook.
 * Supports optional query filters: owner, status_reason, sub_status, search
 */

import { NextResponse } from 'next/server';
import { parseActiveWorkbook } from '@/lib/logistics/workbook-parser.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const parsed = parseActiveWorkbook();
  if (!parsed) {
    return NextResponse.json({ rows: [], message: 'No active workbook' });
  }

  const url = new URL(req.url);
  const owner = url.searchParams.get('owner');
  const statusReason = url.searchParams.get('status_reason');
  const subStatus = url.searchParams.get('sub_status');
  const search = url.searchParams.get('search');

  let rows = parsed.rows;

  if (owner) {
    rows = rows.filter((r) => r.owner.toLowerCase() === owner.toLowerCase());
  }
  if (statusReason) {
    rows = rows.filter((r) => r.status_reason.toLowerCase() === statusReason.toLowerCase());
  }
  if (subStatus) {
    rows = rows.filter((r) => r.sub_status.toLowerCase() === subStatus.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((r) =>
      r.work_order_number.toLowerCase().includes(s) ||
      r.case_number.toLowerCase().includes(s) ||
      r.customer.toLowerCase().includes(s) ||
      r.location.toLowerCase().includes(s)
    );
  }

  return NextResponse.json({ rows, totalCount: parsed.rowCount, filteredCount: rows.length });
}
