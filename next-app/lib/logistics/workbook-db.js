/**
 * Workbook DB Operations — DB-backed logistics workbook storage and queries.
 * Mirrors the production Python API (workbook_modules.py) data model.
 */

import 'server-only';
import * as XLSX from 'xlsx';
import { query } from '@/lib/db.js';
import { mutate, withTransaction } from '@/lib/db-write.js';

const WORKBOOK_KEY = 'test_bulk_wo_update';
const OMITTED_DOWNLOAD_SUB_STATUS_KEYS = new Set([
  'device not on pickup list',
  'delivery failure',
]);
const FAILURE_SUB_STATUS_KEYS = new Set([
  'pick up failed',
  'delivery failure',
  'delivery unsuccessful',
]);

const REQUIRED_HEADERS = {
  work_order: ['Work Order Number', 'Case'],
  customer: ['Customer (Case) (Case)'],
  customer_asset: ['Customer Asset (Case) (Case)'],
  location: ['Location (Case) (Case)'],
  status_reason: ['Status Reason (Case) (Case)'],
  sub_status: ['Sub-Status'],
  owner: ['Owner (Case) (Case)'],
};

const REQUIRED_FIELDS = Object.keys(REQUIRED_HEADERS);

function normalizeHeader(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeWorkOrderKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isOmittedDownloadSubStatus(value) {
  return OMITTED_DOWNLOAD_SUB_STATUS_KEYS.has(normalizeHeader(value));
}

function isFailureSubStatus(value) {
  return FAILURE_SUB_STATUS_KEYS.has(normalizeHeader(value));
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function sourceRowsByKey(sourceRows) {
  const rows = {};
  for (const row of sourceRows || []) {
    if (row?.work_order_key) rows[row.work_order_key] = row;
  }
  return rows;
}

export function buildPendingDownloadPlan({ sourceRows, mergedUpdates, pendingRows }) {
  const pendingKeys = new Set((pendingRows || []).map((row) => row.work_order_key).filter(Boolean));
  const sourceByKey = sourceRowsByKey(sourceRows);
  const mergedSnapshotsByKey = {};
  const omittedKeys = new Set();

  for (const merged of mergedUpdates || []) {
    const key = merged.work_order_key;
    if (!pendingKeys.has(key)) continue;

    const snapshot = parseJsonObject(merged.row_snapshot_json);
    if (isOmittedDownloadSubStatus(snapshot['sub-status'])) {
      omittedKeys.add(key);
      continue;
    }

    mergedSnapshotsByKey[key] = snapshot;
  }

  const processedRows = [];
  const exportRows = [];
  for (const row of pendingRows || []) {
    const key = row.work_order_key;
    if (!key) continue;

    processedRows.push(row);
    if (omittedKeys.has(key)) continue;
    if (!sourceByKey[key]) continue;
    exportRows.push(row);
  }

  return { exportRows, processedRows, mergedSnapshotsByKey, sourceByKey };
}

/**
 * Detect the target worksheet and header row in an xlsx buffer.
 */
export function detectSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  for (let si = 0; si < wb.SheetNames.length; si++) {
    const sheetName = wb.SheetNames[si];
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    for (let rowIdx = 0; rowIdx < Math.min(raw.length, 250); rowIdx++) {
      const headerRow = raw[rowIdx];
      if (!headerRow) continue;
      const normalized = headerRow.map((h) => normalizeHeader(h));

      const fieldMap = {};
      for (const field of REQUIRED_FIELDS) {
        const aliases = REQUIRED_HEADERS[field];
        for (const alias of aliases) {
          const idx = normalized.indexOf(normalizeHeader(alias));
          if (idx !== -1) {
            fieldMap[field] = { colIdx: idx, headerText: String(headerRow[idx]).trim() };
            break;
          }
        }
      }

      if (Object.keys(fieldMap).length === REQUIRED_FIELDS.length) {
        return { sheetIndex: si, sheetName, headerRowIndex: rowIdx, fieldMap, raw, headerRow };
      }
    }
  }

  return null;
}

/**
 * Parse rows from a detected sheet.
 */
export function parseRows(detected) {
  const { raw, headerRowIndex, fieldMap, headerRow } = detected;
  const rows = {};
  const duplicates = [];

  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => c === '' || c == null)) continue;

    const workOrderValue = String(r[fieldMap.work_order.colIdx] || '').trim();
    const workOrderKey = normalizeWorkOrderKey(workOrderValue);
    if (!workOrderKey) continue;

    if (rows[workOrderKey]) {
      duplicates.push(workOrderValue);
      continue;
    }

    // Build full snapshot of all columns
    const snapshot = {};
    for (let col = 0; col < headerRow.length; col++) {
      const norm = normalizeHeader(headerRow[col]);
      if (norm) snapshot[norm] = r[col] != null ? r[col] : null;
    }

    rows[workOrderKey] = {
      workOrderKey,
      workOrderValue,
      ownerValue: String(r[fieldMap.owner.colIdx] || '').trim(),
      ownerKey: String(r[fieldMap.owner.colIdx] || '').trim().toLowerCase(),
      sourceRowIndex: i + 1,
      customerValue: String(r[fieldMap.customer.colIdx] || '').trim(),
      customerAssetValue: String(r[fieldMap.customer_asset.colIdx] || '').trim(),
      locationValue: String(r[fieldMap.location.colIdx] || '').trim(),
      statusReason: String(r[fieldMap.status_reason.colIdx] || '').trim(),
      subStatus: String(r[fieldMap.sub_status.colIdx] || '').trim(),
      snapshot,
    };
  }

  return { rows, duplicates };
}

/**
 * Store the active workbook and source rows in the database.
 */
export async function storeWorkbook({ filename, contentType, sheetName, sheetIndex, headerRowIndex, cycleVersion, workbookBytes, userId }) {
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    // Upsert active workbook
    await client.query(
      `INSERT INTO ops_active_workbooks (workbook_key, file_name, content_type, sheet_name, sheet_index, header_row_index, cycle_version, workbook_bytes, uploaded_by_user_id, uploaded_at, modified_by_user_id, modified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9,$10)
       ON CONFLICT (workbook_key) DO UPDATE SET
         file_name=EXCLUDED.file_name, content_type=EXCLUDED.content_type, sheet_name=EXCLUDED.sheet_name,
         sheet_index=EXCLUDED.sheet_index, header_row_index=EXCLUDED.header_row_index, cycle_version=EXCLUDED.cycle_version,
         workbook_bytes=EXCLUDED.workbook_bytes, uploaded_by_user_id=EXCLUDED.uploaded_by_user_id, uploaded_at=EXCLUDED.uploaded_at,
         modified_by_user_id=EXCLUDED.modified_by_user_id, modified_at=EXCLUDED.modified_at`,
      [WORKBOOK_KEY, filename, contentType, sheetName, sheetIndex, headerRowIndex, cycleVersion, workbookBytes, userId, now]
    );

    // Clear prior cycle data
    for (const table of ['ops_workbook_source_rows', 'ops_workbook_merged_updates', 'ops_workbook_owner_submissions', 'ops_workbook_completed_rows']) {
      await client.query(`DELETE FROM ${table} WHERE workbook_key = $1`, [WORKBOOK_KEY]);
    }
  });
}

/**
 * Store parsed source rows.
 */
export async function storeSourceRows(cycleVersion, parsedRows) {
  const entries = Object.values(parsedRows);
  if (!entries.length) return;

  for (const row of entries) {
    await mutate(
      `INSERT INTO ops_workbook_source_rows (workbook_key, cycle_version, work_order_key, work_order_value, owner_value, owner_key, source_row_index, source_snapshot_json, customer_value, customer_asset_value, location_value, status_reason, sub_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (workbook_key, cycle_version, work_order_key) DO UPDATE SET
         work_order_value=EXCLUDED.work_order_value, owner_value=EXCLUDED.owner_value, owner_key=EXCLUDED.owner_key,
         source_row_index=EXCLUDED.source_row_index, source_snapshot_json=EXCLUDED.source_snapshot_json,
         customer_value=EXCLUDED.customer_value, customer_asset_value=EXCLUDED.customer_asset_value,
         location_value=EXCLUDED.location_value, status_reason=EXCLUDED.status_reason, sub_status=EXCLUDED.sub_status`,
      [WORKBOOK_KEY, cycleVersion, row.workOrderKey, row.workOrderValue, row.ownerValue, row.ownerKey, row.sourceRowIndex, JSON.stringify(row.snapshot || {}), row.customerValue, row.customerAssetValue, row.locationValue, row.statusReason, row.subStatus]
    );
  }
}

/**
 * Get the active workbook metadata (without bytes).
 */
export async function getActiveWorkbook() {
  const rows = await query(
    `SELECT w.workbook_key, w.file_name, w.content_type, w.sheet_name, w.sheet_index, w.header_row_index, w.cycle_version, w.uploaded_by_user_id, w.uploaded_at, w.modified_by_user_id, w.modified_at,
            COALESCE(NULLIF(u.display_name,''), u.upn) AS uploaded_by_display_name
     FROM ops_active_workbooks w
     LEFT JOIN users u ON u.id = w.uploaded_by_user_id
     WHERE w.workbook_key = $1 LIMIT 1`,
    [WORKBOOK_KEY]
  );
  return rows[0] || null;
}

/**
 * Get source rows for the current cycle.
 */
export async function getSourceRows(cycleVersion) {
  return query(
    `SELECT work_order_key, work_order_value, owner_value, owner_key, source_row_index, source_snapshot_json, customer_value, customer_asset_value, location_value, status_reason, sub_status
     FROM ops_workbook_source_rows WHERE workbook_key = $1 AND cycle_version = $2
     ORDER BY source_row_index ASC`,
    [WORKBOOK_KEY, cycleVersion]
  );
}

/**
 * Get merged updates for the current cycle.
 */
export async function getMergedUpdates(cycleVersion) {
  return query(
    `SELECT work_order_key, work_order_value, owner_value, owner_key, row_snapshot_json, uploaded_by_user_id, uploaded_by_display_name, uploaded_at
     FROM ops_workbook_merged_updates WHERE workbook_key = $1 AND cycle_version = $2`,
    [WORKBOOK_KEY, cycleVersion]
  );
}

/**
 * Get completed row keys for a user (excluding rework).
 */
export async function getCompletedRowKeys(cycleVersion, userId) {
  const rows = await query(
    `SELECT work_order_key FROM ops_workbook_completed_rows
     WHERE workbook_key = $1 AND cycle_version = $2 AND user_id = $3 AND status <> 'rework_in_progress'`,
    [WORKBOOK_KEY, cycleVersion, userId]
  );
  return new Set(rows.map((r) => r.work_order_key));
}

/**
 * Get owner submissions for the current cycle.
 */
export async function getOwnerSubmissions(cycleVersion) {
  return query(
    `SELECT user_id, username, display_name, owner_key, accepted_rows, submitted_at
     FROM ops_workbook_owner_submissions WHERE workbook_key = $1 AND cycle_version = $2`,
    [WORKBOOK_KEY, cycleVersion]
  );
}

/**
 * Get latest logistics submission for a user.
 */
export async function getLatestSubmission(cycleVersion, userId) {
  const rows = await query(
    `SELECT id, state, row_count, downloaded_at, correction_requested_at, created_at
     FROM ops_workbook_logistics_submissions
     WHERE workbook_key = $1 AND cycle_version = $2 AND user_id = $3
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [WORKBOOK_KEY, cycleVersion, userId]
  );
  return rows[0] || null;
}

/**
 * Get submission rows for a submission.
 */
export async function getSubmissionRows(submissionId) {
  return query(
    `SELECT work_order_key, work_order_value, case_value, customer_value, customer_asset_value, location_value, status_reason, sub_status, is_escalated, correction_requested, correction_explanation
     FROM ops_workbook_logistics_submission_rows WHERE submission_id = $1
     ORDER BY created_at ASC`,
    [submissionId]
  );
}

/**
 * Submit logistics updates for a technician.
 */
export async function submitUpdates({ cycleVersion, userId, displayName, username, updates, sourceRows, sourceWorkbookName }) {
  const now = new Date().toISOString();
  const subStatusKey = normalizeHeader('Sub-Status');
  const workOrderSummaryKey = normalizeHeader('Work Order Summary');
  const primaryIncidentDescriptionKey = normalizeHeader('Primary Incident Description');
  const operatorSummary = String(displayName || username || '').trim();
  const downloadableUpdates = updates.filter((update) => !isOmittedDownloadSubStatus(update.subStatus));

  return withTransaction(async (client) => {
    // Create submission record
    const subResult = await client.query(
      `INSERT INTO ops_workbook_logistics_submissions (workbook_key, cycle_version, user_id, username, display_name, source_workbook_name, state, row_count, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'submitted',$7,$8,$8) RETURNING id`,
      [WORKBOOK_KEY, cycleVersion, userId, username, displayName, sourceWorkbookName, updates.length, now]
    );
    const submissionId = subResult.rows[0].id;

    for (const update of updates) {
      const sourceRow = sourceRows[update.workOrderKey];
      if (!sourceRow) continue;

      const snapshot = parseJsonObject(sourceRow.source_snapshot_json);
      snapshot[subStatusKey] = update.subStatus || null;
      if (operatorSummary) snapshot[workOrderSummaryKey] = operatorSummary;
      snapshot[primaryIncidentDescriptionKey] = isFailureSubStatus(update.subStatus)
        ? (update.failureReason || null)
        : null;
      const omittedFromDownload = isOmittedDownloadSubStatus(update.subStatus);

      if (omittedFromDownload) {
        await client.query(
          `DELETE FROM ops_workbook_merged_updates
           WHERE workbook_key = $1 AND cycle_version = $2 AND work_order_key = $3`,
          [WORKBOOK_KEY, cycleVersion, update.workOrderKey]
        );
      } else {
        // Upsert merged update
        await client.query(
          `INSERT INTO ops_workbook_merged_updates (workbook_key, cycle_version, work_order_key, work_order_value, owner_value, owner_key, row_snapshot_json, uploaded_by_user_id, uploaded_by_display_name, uploaded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (workbook_key, cycle_version, work_order_key) DO UPDATE SET
             row_snapshot_json=EXCLUDED.row_snapshot_json, uploaded_by_user_id=EXCLUDED.uploaded_by_user_id,
             uploaded_by_display_name=EXCLUDED.uploaded_by_display_name, uploaded_at=EXCLUDED.uploaded_at`,
          [WORKBOOK_KEY, cycleVersion, update.workOrderKey, sourceRow.work_order_value, sourceRow.owner_value, sourceRow.owner_key, JSON.stringify(snapshot), userId, operatorSummary || displayName, now]
        );
      }

      // Store submission row
      const caseValue = (snapshot['case'] || '').trim() || sourceRow.work_order_value;
      await client.query(
        `INSERT INTO ops_workbook_logistics_submission_rows (submission_id, workbook_key, cycle_version, work_order_key, work_order_value, case_value, customer_value, customer_asset_value, location_value, status_reason, sub_status, is_escalated, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [submissionId, WORKBOOK_KEY, cycleVersion, update.workOrderKey, sourceRow.work_order_value, caseValue, sourceRow.customer_value, sourceRow.customer_asset_value, sourceRow.location_value, sourceRow.status_reason, update.subStatus, update.escalate ? 1 : 0, now]
      );

      // Upsert completed row
      await client.query(
        `INSERT INTO ops_workbook_completed_rows (workbook_key, cycle_version, user_id, work_order_key, case_value, submission_id, status, is_escalated, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (workbook_key, cycle_version, user_id, work_order_key) DO UPDATE SET
           case_value=EXCLUDED.case_value, submission_id=EXCLUDED.submission_id, status=EXCLUDED.status,
           is_escalated=EXCLUDED.is_escalated, completed_at=EXCLUDED.completed_at`,
        [WORKBOOK_KEY, cycleVersion, userId, update.workOrderKey, caseValue, submissionId, omittedFromDownload ? 'omitted' : 'submitted', update.escalate ? 1 : 0, now]
      );

      // Write to activity log
      await client.query(
        `INSERT INTO ops_logistics_activity_log (workbook_key, cycle_version, user_id, username, display_name, event_type, case_value, customer_value, location_value, customer_asset_value, stage_value, new_sub_status, escalation_state, notify_rc_state, reason_notes, source_workbook_name, created_at)
         VALUES ($1,$2,$3,$4,$5,'Sub-Status Update Submitted',$6,$7,$8,$9,$10,$11,$12,false,$13,$14,$15)`,
        [WORKBOOK_KEY, cycleVersion, userId, username, displayName, caseValue, sourceRow.customer_value || '', sourceRow.location_value || '', sourceRow.customer_asset_value || '', sourceRow.status_reason || '', update.subStatus, update.escalate || false, update.failureReason || null, sourceWorkbookName, now]
      );
    }

    // Upsert owner submission
    await client.query(
      `INSERT INTO ops_workbook_owner_submissions (workbook_key, cycle_version, user_id, username, display_name, owner_key, accepted_rows, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (workbook_key, cycle_version, user_id) DO UPDATE SET
         accepted_rows=EXCLUDED.accepted_rows, submitted_at=EXCLUDED.submitted_at`,
      [WORKBOOK_KEY, cycleVersion, userId, username, displayName, displayName.toLowerCase(), downloadableUpdates.length, now]
    );

    return { submissionId, rowCount: downloadableUpdates.length, processedRowCount: updates.length };
  });
}

/**
 * Get pending completed rows (submitted, not yet exported).
 */
export async function getPendingCompletedRows(cycleVersion) {
  return query(
    `SELECT user_id, work_order_key, case_value, submission_id, status, completed_at
     FROM ops_workbook_completed_rows
     WHERE workbook_key = $1 AND cycle_version = $2 AND status = 'submitted' AND exported_download_id IS NULL
     ORDER BY completed_at ASC`,
    [WORKBOOK_KEY, cycleVersion]
  );
}

/**
 * Get latest submissions by user for the cycle.
 */
export async function getLatestSubmissionsByUser(cycleVersion) {
  const rows = await query(
    `SELECT user_id, username, display_name, state, row_count, downloaded_at, created_at, id
     FROM ops_workbook_logistics_submissions
     WHERE workbook_key = $1 AND cycle_version = $2
     ORDER BY user_id ASC, created_at DESC, id DESC`,
    [WORKBOOK_KEY, cycleVersion]
  );
  const byUser = {};
  for (const row of rows) {
    if (!byUser[row.user_id]) byUser[row.user_id] = row;
  }
  return byUser;
}

/**
 * Get download history for a cycle.
 */
export async function getDownloadHistory(cycleVersion) {
  return query(
    `SELECT d.id, d.file_name, d.record_count, d.downloaded_by_user_id, d.downloaded_at,
            u.upn AS downloaded_by_username, COALESCE(NULLIF(u.display_name,''), u.upn) AS downloaded_by_display_name
     FROM ops_workbook_download_history d
     LEFT JOIN users u ON u.id = d.downloaded_by_user_id
     WHERE d.workbook_key = $1 AND d.cycle_version = $2
     ORDER BY d.downloaded_at DESC`,
    [WORKBOOK_KEY, cycleVersion]
  );
}

/**
 * Get a stored compiled workbook download by archive id.
 */
export async function getDownloadArchive(downloadId) {
  const rows = await query(
    `SELECT file_name, content_type, file_bytes
     FROM ops_workbook_download_history
     WHERE workbook_key = $1 AND id = $2
     LIMIT 1`,
    [WORKBOOK_KEY, downloadId]
  );
  return rows[0] || null;
}

/**
 * Build and store a compiled download workbook.
 */
export async function buildAndStoreDownload({ cycleVersion, userId, sourceRows, mergedUpdates, pendingRows, activeWorkbook }) {
  const now = new Date().toISOString();
  const workbookBytesResult = await query(
    `SELECT workbook_bytes FROM ops_active_workbooks WHERE workbook_key = $1`,
    [WORKBOOK_KEY]
  );
  if (!workbookBytesResult[0]) throw new Error('No active workbook');

  const wb = XLSX.read(workbookBytesResult[0].workbook_bytes, { type: 'buffer' });
  const sheetName = wb.SheetNames[activeWorkbook.sheet_index || 0];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerRowIdx = activeWorkbook.header_row_index || 0;
  const headerRow = raw[headerRowIdx] || [];
  const normalizedHeaders = headerRow.map((h) => normalizeHeader(h));

  const downloadPlan = buildPendingDownloadPlan({ sourceRows, mergedUpdates, pendingRows });
  const exportKeys = new Set(downloadPlan.exportRows.map((r) => r.work_order_key));
  const processedKeys = new Set(downloadPlan.processedRows.map((r) => r.work_order_key));
  const mergedByKey = downloadPlan.mergedSnapshotsByKey;
  const sourceByKey = downloadPlan.sourceByKey;

  // Apply merged updates to the sheet and remove non-pending rows
  const keepRows = new Set();
  for (const key of exportKeys) {
    const source = sourceByKey[key];
    if (!source) continue;
    const rowIdx = source.source_row_index - 1; // raw is 0-indexed
    if (rowIdx <= headerRowIdx) continue;
    keepRows.add(rowIdx);
    const merged = mergedByKey[key];
    if (merged) {
      for (let col = 0; col < normalizedHeaders.length; col++) {
        const norm = normalizedHeaders[col];
        if (norm && Object.prototype.hasOwnProperty.call(merged, norm)) {
          raw[rowIdx][col] = merged[norm] ?? '';
        }
      }
    }
  }

  // Build new sheet with only header + pending rows
  const newData = [raw[headerRowIdx]];
  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    if (keepRows.has(i)) newData.push(raw[i]);
  }

  const newSheet = XLSX.utils.aoa_to_sheet(newData);
  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, newSheet, sheetName);
  const fileBytes = Buffer.from(XLSX.write(newWb, { type: 'buffer', bookType: 'xlsx' }));

  const baseName = (activeWorkbook.file_name || 'workbook').replace(/\.xlsx$/i, '');
  const filename = `${baseName}-compiled.xlsx`;

  return withTransaction(async (client) => {
    const dlResult = await client.query(
      `INSERT INTO ops_workbook_download_history (workbook_key, cycle_version, file_name, source_workbook_name, content_type, record_count, file_bytes, downloaded_by_user_id, downloaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [WORKBOOK_KEY, cycleVersion, filename, activeWorkbook.file_name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', exportKeys.size, fileBytes, userId, now]
    );
    const downloadId = dlResult.rows[0].id;

    // Mark every processed submission row exported, including submitted rows that
    // are intentionally omitted from the compiled workbook.
    const keys = Array.from(processedKeys);
    if (keys.length) {
      const placeholders = keys.map((_, i) => `$${i + 4}`).join(',');
      await client.query(
        `UPDATE ops_workbook_completed_rows SET exported_download_id = $1, status = 'downloaded'
         WHERE workbook_key = $2 AND cycle_version = $3 AND exported_download_id IS NULL AND work_order_key IN (${placeholders})`,
        [downloadId, WORKBOOK_KEY, cycleVersion, ...keys]
      );
    }

    // Mark submissions as downloaded
    const subIds = [...new Set(pendingRows.map((r) => r.submission_id).filter(Boolean))];
    if (subIds.length) {
      const placeholders = subIds.map((_, i) => `$${i + 5}`).join(',');
      await client.query(
        `UPDATE ops_workbook_logistics_submissions SET state = 'downloaded', downloaded_download_id = $1, downloaded_at = $2, updated_at = $2
         WHERE workbook_key = $3 AND cycle_version = $4 AND id IN (${placeholders})`,
        [downloadId, now, WORKBOOK_KEY, cycleVersion, ...subIds]
      );
    }

    // Clear owner submissions
    await client.query(
      `DELETE FROM ops_workbook_owner_submissions WHERE workbook_key = $1 AND cycle_version = $2`,
      [WORKBOOK_KEY, cycleVersion]
    );

    return { downloadId, filename, fileBytes, recordCount: exportKeys.size };
  });
}

/**
 * Undo a submission (rework).
 */
export async function undoSubmission(submissionId, cycleVersion, userId) {
  const now = new Date().toISOString();
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE ops_workbook_logistics_submissions SET state = 'rework_in_progress', rework_started_at = $1, updated_at = $1
       WHERE workbook_key = $2 AND cycle_version = $3 AND id = $4 AND user_id = $5`,
      [now, WORKBOOK_KEY, cycleVersion, submissionId, userId]
    );
    await client.query(
      `UPDATE ops_workbook_completed_rows SET status = 'rework_in_progress', exported_download_id = NULL
       WHERE workbook_key = $1 AND cycle_version = $2 AND submission_id = $3 AND user_id = $4`,
      [WORKBOOK_KEY, cycleVersion, submissionId, userId]
    );
    await client.query(
      `DELETE FROM ops_workbook_owner_submissions WHERE workbook_key = $1 AND cycle_version = $2 AND user_id = $3`,
      [WORKBOOK_KEY, cycleVersion, userId]
    );
  });
}
