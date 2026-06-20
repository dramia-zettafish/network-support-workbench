/**
 * GET /api/data-management/workbook/download — compile and download pending submissions.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { getActiveWorkbook, getSourceRows, getMergedUpdates, getPendingCompletedRows, buildAndStoreDownload, buildPendingDownloadPlan } from '@/lib/logistics/workbook-db.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const workbook = await getActiveWorkbook();
  if (!workbook) return NextResponse.json({ error: 'No active workbook' }, { status: 404 });

  const cycleVersion = workbook.cycle_version || 1;
  const pendingRows = await getPendingCompletedRows(cycleVersion);
  if (!pendingRows.length) return NextResponse.json({ error: 'No records have been added since the last download' }, { status: 422 });

  const userRows = await query('SELECT id FROM users WHERE upn = $1 LIMIT 1', [user.username]);
  const userId = userRows[0]?.id || user.id;

  const sourceRows = await getSourceRows(cycleVersion);
  const mergedUpdates = await getMergedUpdates(cycleVersion);
  const downloadPlan = buildPendingDownloadPlan({ sourceRows, mergedUpdates, pendingRows });
  if (!downloadPlan.exportRows.length) {
    return NextResponse.json({ error: 'No records have been added since the last download' }, { status: 422 });
  }

  const result = await buildAndStoreDownload({
    cycleVersion,
    userId,
    sourceRows,
    mergedUpdates,
    pendingRows,
    activeWorkbook: workbook,
  });

  return new Response(result.fileBytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    },
  });
}
