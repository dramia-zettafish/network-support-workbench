/**
 * GET /api/logistics/download/current
 *
 * Generates and returns a downloadable CSV reflecting submitted Sub-Status updates.
 * Read-only (no state mutation). Records download timestamp.
 */

import { NextResponse } from 'next/server';
import { getWorkbookMeta } from '@/lib/logistics/workbook-storage.js';
import { parseActiveWorkbook } from '@/lib/logistics/workbook-parser.js';
import { loadChamber, markDownloaded } from '@/lib/logistics/chamber-storage.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const meta = getWorkbookMeta();
  if (!meta) {
    return NextResponse.json({ error: 'No active workbook' }, { status: 404 });
  }

  const chamber = loadChamber();
  if (!chamber || chamber.submissions.length === 0) {
    return NextResponse.json(
      { error: 'No submissions to download. Technicians must submit updates first.' },
      { status: 400 }
    );
  }

  const parsed = parseActiveWorkbook();
  if (!parsed) {
    return NextResponse.json({ error: 'Failed to parse active workbook' }, { status: 500 });
  }

  // Build submission lookup
  const subMap = {};
  for (const s of chamber.submissions) {
    subMap[s.work_order_number] = s;
  }

  // Generate CSV with all rows, applying submitted sub_status where available
  const headers = ['Work Order Number', 'Case', 'Customer', 'Customer Asset', 'Location', 'Status Reason', 'Sub-Status', 'Owner', 'Submitted At'];
  const csvRows = [headers.join(',')];

  for (const row of parsed.rows) {
    const sub = subMap[row.work_order_number];
    const subStatus = sub ? sub.sub_status : row.sub_status;
    const submittedAt = sub ? sub.submittedAt : '';

    csvRows.push([
      esc(row.work_order_number),
      esc(row.case_number),
      esc(row.customer),
      esc(row.customer_asset),
      esc(row.location),
      esc(row.status_reason),
      esc(subStatus),
      esc(row.owner),
      esc(submittedAt),
    ].join(','));
  }

  // Record download
  markDownloaded();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `logistics-submissions-${timestamp}.csv`;

  return new Response(csvRows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function esc(val) {
  const s = String(val || '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
