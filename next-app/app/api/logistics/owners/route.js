/**
 * GET /api/logistics/owners
 *
 * Returns unique owners from the active workbook with row counts.
 */

import { NextResponse } from 'next/server';
import { parseActiveWorkbook } from '@/lib/logistics/workbook-parser.js';

export async function GET() {
  const parsed = parseActiveWorkbook();
  if (!parsed) {
    return NextResponse.json({ owners: [], message: 'No active workbook' });
  }

  const counts = {};
  for (const row of parsed.rows) {
    const owner = row.owner || '(unassigned)';
    counts[owner] = (counts[owner] || 0) + 1;
  }

  const owners = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ owners, totalRows: parsed.rowCount });
}
