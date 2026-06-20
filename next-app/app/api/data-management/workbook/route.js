/**
 * GET /api/data-management/workbook — returns workbook status, technician progress, download history.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { getActiveWorkbook, getSourceRows, getMergedUpdates, getPendingCompletedRows, getOwnerSubmissions, getLatestSubmissionsByUser, getDownloadHistory, buildPendingDownloadPlan } from '@/lib/logistics/workbook-db.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const workbook = await getActiveWorkbook();
  const downloadHistory = workbook ? await getDownloadHistory(workbook.cycle_version) : [];

  if (!workbook) {
    return NextResponse.json({
      workbook: null,
      updatedRowCount: 0,
      pendingRecordCount: 0,
      technicians: [],
      previousDownloads: downloadHistory.map((d) => ({
        id: d.id, filename: d.file_name, downloadedAt: d.downloaded_at,
        downloadedByDisplayName: d.downloaded_by_display_name, recordCount: d.record_count,
      })),
    });
  }

  const cycleVersion = workbook.cycle_version || 1;
  const sourceRows = await getSourceRows(cycleVersion);
  const pendingRows = await getPendingCompletedRows(cycleVersion);
  const mergedUpdates = await getMergedUpdates(cycleVersion);
  const downloadPlan = buildPendingDownloadPlan({ sourceRows, mergedUpdates, pendingRows });
  const downloadablePendingRows = downloadPlan.exportRows;
  const ownerSubmissions = await getOwnerSubmissions(cycleVersion);
  const latestByUser = await getLatestSubmissionsByUser(cycleVersion);

  // Get logistics technicians from teams
  const technicians = await query(
    `SELECT u.id AS user_id, u.upn AS username, COALESCE(NULLIF(u.display_name,''), u.upn) AS display_name
     FROM users u JOIN user_teams ut ON ut.user_id = u.id JOIN teams t ON t.id = ut.team_id
     WHERE lower(t.key) = 'logistics_technicians'
     ORDER BY lower(COALESCE(NULLIF(u.display_name,''), u.upn, ''))`
  );

  // Determine which owners are present in the active workbook
  const activeOwnerKeys = new Set(sourceRows.map((r) => (r.owner_value || '').trim().toLowerCase()).filter(Boolean));
  const pendingUserIds = new Set(downloadablePendingRows.map((r) => r.user_id));

  const technicianRows = technicians.map((t) => {
    const dn = (t.display_name || '').trim();
    const present = dn && activeOwnerKeys.has(dn.toLowerCase());
    const submission = ownerSubmissions.find((s) => s.user_id === t.user_id);
    const latest = latestByUser[t.user_id] || {};
    const hasPendingDownload = pendingUserIds.has(t.user_id);
    const latestRowCount = Number(latest.row_count || 0);
    const isFinished = Boolean(
      latest.downloaded_at ||
      latest.state === 'downloaded' ||
      (!hasPendingDownload && latest.created_at && latestRowCount === 0)
    );
    return {
      userId: t.user_id,
      username: t.username,
      displayName: dn || null,
      presentInActiveWorkbook: present,
      submitted: hasPendingDownload,
      submissionStatus: hasPendingDownload ? 'submitted' : (isFinished ? 'finished' : 'pending'),
      latestSubmissionState: latest.state || null,
      disabled: !present,
      lastSubmissionAt: submission?.submitted_at || latest.created_at || null,
      submissionDownloadedAt: latest.downloaded_at || null,
      lastSubmissionCount: submission ? (submission.accepted_rows || 0) : latestRowCount,
    };
  });

  return NextResponse.json({
    workbook: {
      filename: workbook.file_name,
      sheetName: workbook.sheet_name,
      cycleVersion,
      uploadedAt: workbook.uploaded_at,
      modifiedAt: workbook.modified_at,
    },
    updatedRowCount: downloadablePendingRows.length,
    pendingRecordCount: downloadablePendingRows.length,
    lastUpdatedAt: downloadablePendingRows.length ? downloadablePendingRows[downloadablePendingRows.length - 1].completed_at : null,
    sourceWorkbookName: workbook.file_name,
    technicians: technicianRows,
    previousDownloads: downloadHistory.map((d) => ({
      id: d.id, filename: d.file_name, downloadedAt: d.downloaded_at,
      downloadedByDisplayName: d.downloaded_by_display_name, recordCount: d.record_count,
    })),
  });
}
