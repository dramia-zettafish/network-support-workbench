/**
 * GET /api/logistics/workbook — returns assigned rows for the current technician.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { getActiveWorkbook, getSourceRows, getMergedUpdates, getCompletedRowKeys, getLatestSubmission, getSubmissionRows } from '@/lib/logistics/workbook-db.js';

export const dynamic = 'force-dynamic';

const ALLOWED_SUB_STATUS = {
  'ready for pickup': ['', 'Pick up Successful', 'Pick Up Failed', 'Device Not On Pickup List'],
  'ready for delivery': ['', 'Delivery Successful', 'Delivery Failure'],
};

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  // Resolve display_name from users table
  const userRows = await query('SELECT id, display_name FROM users WHERE upn = $1 LIMIT 1', [user.username]);
  const userId = userRows[0]?.id || user.id;
  const displayName = (userRows[0]?.display_name || '').trim();

  const workbook = await getActiveWorkbook();
  if (!workbook) {
    const rcRows = await query(
      `SELECT NULLIF(u.email, '') AS email FROM users u
       JOIN user_teams ut ON ut.user_id = u.id
       JOIN teams t ON t.id = ut.team_id
       WHERE lower(t.key) = 'route_coordinators' AND NULLIF(u.email, '') IS NOT NULL`,
      []
    );
    return NextResponse.json({ workbook: null, rows: [], assignedRowCount: 0, actionableRowCount: 0, route_coordinator_emails: [...new Set(rcRows.map(r => r.email.trim()).filter(Boolean))] });
  }

  const cycleVersion = workbook.cycle_version || 1;
  const sourceRows = await getSourceRows(cycleVersion);
  const mergedUpdates = await getMergedUpdates(cycleVersion);
  const completedKeys = await getCompletedRowKeys(cycleVersion, userId);

  const mergedByKey = {};
  for (const m of mergedUpdates) mergedByKey[m.work_order_key] = JSON.parse(m.row_snapshot_json || '{}');

  // All rows assigned to this technician (before filtering completed)
  const allOwnerRows = sourceRows.filter((r) =>
    r.owner_value && displayName && (r.owner_value || '').trim().toLowerCase() === displayName.toLowerCase()
  );

  // Filter out completed rows for the active view
  const ownerRows = allOwnerRows.filter((r) => !completedKeys.has(r.work_order_key));

  const rows = ownerRows.map((r) => {
    const statusKey = (r.status_reason || '').toLowerCase();
    const allowed = ALLOWED_SUB_STATUS[statusKey] || [];
    const merged = mergedByKey[r.work_order_key] || {};
    const subStatusHeaderKey = 'sub-status';
    const currentSubStatus = merged[subStatusHeaderKey] || r.sub_status || '';

    // Case value: prefer "case" column from snapshot, fall back to work_order_value
    const snapshot = JSON.parse(r.source_snapshot_json || '{}');
    const caseValue = (snapshot['case'] || '').trim() || r.work_order_value;
    const pickupScheduledAttempts = parseInt(snapshot['pick up scheduled attempts (case) (case)'] || '0', 10) || 0;

    return {
      workOrderKey: r.work_order_key,
      workOrderValue: r.work_order_value,
      caseValue,
      customerValue: r.customer_value || '',
      customerAssetValue: r.customer_asset_value || '',
      locationValue: r.location_value || '',
      statusReason: r.status_reason || '',
      ownerValue: r.owner_value || '',
      currentSubStatus: currentSubStatus || null,
      editable: allowed.length > 0,
      allowedOptions: allowed,
      pickupScheduledAttempts,
    };
  });

  // Get latest submission info
  const latestSub = await getLatestSubmission(cycleVersion, userId);
  let latestSubmission = null;
  if (latestSub) {
    const subRows = await getSubmissionRows(latestSub.id);
    // Build source row lookup to resolve case values from snapshot
    const sourceByKey = {};
    for (const s of sourceRows) sourceByKey[s.work_order_key] = s;

    latestSubmission = {
      id: latestSub.id,
      state: latestSub.state,
      createdAt: latestSub.created_at,
      downloadedAt: latestSub.downloaded_at || null,
      rowCount: latestSub.row_count,
      rows: subRows.map((sr) => {
        // Resolve case from source snapshot if stored case_value equals work_order_value
        let caseVal = sr.case_value || '';
        if (!caseVal || caseVal === sr.work_order_value) {
          const src = sourceByKey[sr.work_order_key];
          if (src) {
            const snap = JSON.parse(src.source_snapshot_json || '{}');
            caseVal = (snap['case'] || '').trim() || sr.work_order_value;
          }
        }
        return {
          workOrderValue: sr.work_order_value,
          caseValue: caseVal,
          customerValue: sr.customer_value || '',
          customerAssetValue: sr.customer_asset_value || '',
          locationValue: sr.location_value || '',
          statusReason: sr.status_reason || '',
          subStatus: sr.sub_status,
          isEscalated: !!sr.is_escalated,
          correctionRequested: !!sr.correction_requested,
          correctionExplanation: sr.correction_explanation || null,
        };
      }),
    };
  }

  // Fetch route coordinator emails
  const rcRows = await query(
    `SELECT NULLIF(u.email, '') AS email FROM users u
     JOIN user_teams ut ON ut.user_id = u.id
     JOIN teams t ON t.id = ut.team_id
     WHERE lower(t.key) = 'route_coordinators' AND NULLIF(u.email, '') IS NOT NULL`,
    []
  );
  const route_coordinator_emails = [...new Set(rcRows.map(r => r.email.trim()).filter(Boolean))];

  return NextResponse.json({
    workbook: {
      filename: workbook.file_name,
      sheetName: workbook.sheet_name,
      cycleVersion,
      uploadedAt: workbook.uploaded_at,
    },
    ownerDisplayName: displayName,
    assignedRowCount: ownerRows.length,
    actionableRowCount: rows.filter((r) => r.editable).length,
    presentInActiveWorkbook: allOwnerRows.length > 0,
    hasSubmitted: !!latestSub,
    latestSubmission,
    route_coordinator_emails,
    rows,
  });
}
