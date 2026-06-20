/**
 * GET /api/logistics/submissions/status
 *
 * Returns active workbook info, submission counts, owner completion state.
 * Read-only, authenticated via middleware.
 */

import { NextResponse } from 'next/server';
import { getWorkbookMeta } from '@/lib/logistics/workbook-storage.js';
import { parseActiveWorkbook } from '@/lib/logistics/workbook-parser.js';
import { loadChamber } from '@/lib/logistics/chamber-storage.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const meta = getWorkbookMeta();
  if (!meta) {
    return NextResponse.json({ active: false, message: 'No active workbook uploaded' });
  }

  const parsed = parseActiveWorkbook();
  const chamber = loadChamber();
  const submissions = chamber?.submissions || [];

  // Build owner completion map
  const ownerRows = {};
  if (parsed) {
    for (const row of parsed.rows) {
      const o = row.owner || '(unassigned)';
      if (!ownerRows[o]) ownerRows[o] = { total: 0, submitted: 0 };
      ownerRows[o].total++;
    }
  }
  for (const sub of submissions) {
    const o = sub.owner || '(unassigned)';
    if (ownerRows[o]) ownerRows[o].submitted++;
  }

  const owners = Object.entries(ownerRows).map(([name, counts]) => ({
    name,
    totalRows: counts.total,
    submittedRows: counts.submitted,
    remainingRows: counts.total - counts.submitted,
    complete: counts.submitted >= counts.total,
  }));

  const lastSubmission = submissions.length > 0
    ? submissions.reduce((latest, s) => s.submittedAt > latest ? s.submittedAt : latest, '')
    : null;

  return NextResponse.json({
    active: true,
    filename: meta.filename,
    uploadedAt: meta.uploadedAt,
    totalRows: parsed?.rowCount || 0,
    totalSubmissions: submissions.length,
    owners,
    lastSubmissionAt: lastSubmission,
    lastDownloadedAt: chamber?.lastDownloadedAt || null,
    lastClearedAt: chamber?.lastClearedAt || null,
  });
}
