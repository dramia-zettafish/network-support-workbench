import { requireAuth } from '@/lib/auth';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getTeamId } from '@/lib/teams.js';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DIAGNOSIS_TEAM_KEY = 'computer_technicians';
const LOGISTICS_WORKBOOK_KEY = 'test_bulk_wo_update';
const PICKUP_SOURCE_NAME = 'Refresh Pickup Scanner Import';
const PICKUP_SUCCESS_STATUS = 'Pick up Successful';
const PICKUP_STAGES = new Set(['Pickup Scheduled', 'Ready for Pickup']);
const ALREADY_DIAGNOSIS_STAGES = new Set(['Diagnosing', 'Repairing', 'Ordering', 'Quote Request', 'Part Distribution', 'Depot Repair', 'Ready for Delivery', 'Delivery Scheduled', 'Delivered', 'Completed']);
const IMPORT_ALLOWED_ROLES = new Set(['admin', 'manager', 'supervisor']);
const IMPORT_ALLOWED_TEAMS = new Set(['reporting_administrators']);

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function normalizeIdentifier(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cell(row, names) {
  const wanted = new Set(names.map(normalizeHeader));
  for (const [key, value] of Object.entries(row || {})) {
    if (wanted.has(normalizeHeader(key))) return String(value ?? '').trim();
  }
  return '';
}

function formatDateInTimeZone(date = new Date()) {
  const timeZone = process.env.PICKUP_TIME_ZONE || process.env.APP_TIMEZONE || 'America/Chicago';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateInTimeZone(parsed);
}

function rowFromExportObject(row, index) {
  return {
    rowNumber: index + 2,
    recordType: cell(row, ['recordType', 'Record Type']),
    caseNumber: cell(row, ['caseNumber', 'Case Number']),
    customer: cell(row, ['customer', 'Customer']),
    facility: cell(row, ['facility', 'Facility']),
    serialNumber: cell(row, ['serialNumber', 'Serial Number']),
    assetTag: cell(row, ['assetTag', 'Asset Tag']),
    pickupStatus: cell(row, ['pickupStatus', 'Pickup Status']),
    scannedValue: cell(row, ['scannedValue', 'Scanned Value']),
    matchedField: cell(row, ['matchedField', 'Matched Field']),
    crateNumber: cell(row, ['crateNumber']),
    actualPickupDate: cell(row, ['actualPickupDate', 'Actual Pickup Date']),
    pickedUpAt: cell(row, ['pickedUpAt', 'Picked Up At']),
    pickedUpBy: cell(row, ['pickedUpBy', 'Picked Up By']),
    notes: cell(row, ['notes', 'Notes']),
  };
}

function rowsFromScannerJson(data) {
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  const unknownScans = Array.isArray(data?.unknownScans) ? data.unknownScans : [];
  const devicesNotOnList = Array.isArray(data?.devicesNotOnList) ? data.devicesNotOnList : [];

  return [
    ...devices.map((device, index) => ({
      rowNumber: index + 1,
      recordType: 'device',
      caseNumber: String(device.caseNumber || '').trim(),
      customer: String(device.customer || '').trim(),
      facility: String(device.facility || '').trim(),
      serialNumber: String(device.serialNumber || '').trim(),
      assetTag: String(device.assetTag || '').trim(),
      pickupStatus: String(device.pickupStatus || '').trim(),
      scannedValue: String(device.scannedValue || '').trim(),
      matchedField: String(device.matchedField || '').trim(),
      crateNumber: String(device.crateNumber || '').trim(),
      actualPickupDate: String(device.actualPickupDate || '').trim(),
      pickedUpAt: String(device.pickedUpAt || '').trim(),
      pickedUpBy: String(device.pickedUpBy || '').trim(),
      notes: String(device.notes || '').trim(),
    })),
    ...unknownScans.map((scan, index) => ({
      rowNumber: devices.length + index + 1,
      recordType: 'unknown',
      caseNumber: '',
      pickupStatus: 'UNKNOWN',
      scannedValue: String(scan.scannedValue || '').trim(),
      crateNumber: String(scan.crateNumber || '').trim(),
      pickedUpAt: String(scan.scannedAt || '').trim(),
      pickedUpBy: String(scan.scannedBy || '').trim(),
      notes: String(scan.notes || '').trim(),
    })),
    ...devicesNotOnList.map((device, index) => ({
      rowNumber: devices.length + unknownScans.length + index + 1,
      recordType: 'device_not_on_list',
      caseNumber: String(device.caseNumber || '').trim(),
      customer: String(device.customer || '').trim(),
      facility: String(device.facility || '').trim(),
      serialNumber: String(device.serialNumber || '').trim(),
      assetTag: String(device.assetTag || '').trim(),
      pickupStatus: 'NOT_ON_LIST',
      scannedValue: String(device.scannedValue || '').trim(),
      crateNumber: String(device.crateNumber || '').trim(),
      actualPickupDate: String(device.actualPickupDate || '').trim(),
      pickedUpAt: String(device.addedAt || '').trim(),
      pickedUpBy: String(device.addedBy || '').trim(),
      notes: String(device.notes || '').trim(),
    })),
  ];
}

function parseCsvRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils
    .sheet_to_json(workbook.Sheets[firstSheet], { defval: '', raw: true })
    .map(rowFromExportObject);
}

function parsePickupResults(buffer, file) {
  const filename = file?.name || '';
  const textPrefix = buffer.toString('utf8', 0, Math.min(buffer.length, 256)).trimStart();
  const isJson = /\.json$/i.test(filename) || String(file?.type || '').toLowerCase().includes('json') || textPrefix.startsWith('{');

  if (isJson) {
    const data = JSON.parse(buffer.toString('utf8'));
    return rowsFromScannerJson(data);
  }

  return parseCsvRows(buffer);
}

function canImportPickupResults(user) {
  const role = String(user?.role || '').toLowerCase();
  if (IMPORT_ALLOWED_ROLES.has(role)) return true;
  return (user?.teams || []).some((team) => IMPORT_ALLOWED_TEAMS.has(String(team || '').toLowerCase()));
}

function summarizeIgnored(rows) {
  const ignored = {
    pending: 0,
    needsReview: 0,
    unknown: 0,
    notOnList: 0,
    other: 0,
  };

  for (const row of rows) {
    const recordType = row.recordType.toLowerCase();
    const pickupStatus = row.pickupStatus.toUpperCase();

    if (recordType === 'device' && pickupStatus === 'PICKED_UP') continue;
    if (recordType === 'unknown' || pickupStatus === 'UNKNOWN') ignored.unknown += 1;
    else if (recordType === 'device_not_on_list' || pickupStatus === 'NOT_ON_LIST') ignored.notOnList += 1;
    else if (pickupStatus === 'PENDING') ignored.pending += 1;
    else if (pickupStatus === 'NEEDS_REVIEW') ignored.needsReview += 1;
    else ignored.other += 1;
  }

  return ignored;
}

function buildPickedRows(rows) {
  const pickedRows = [];
  const missingIdentifierRows = [];
  const duplicateIdentifierRows = [];
  const seen = new Set();

  for (const row of rows) {
    const recordType = row.recordType.toLowerCase();
    const pickupStatus = row.pickupStatus.toUpperCase();
    if (recordType !== 'device' || pickupStatus !== 'PICKED_UP') continue;

    const key =
      normalizeIdentifier(row.caseNumber) ||
      normalizeIdentifier(row.serialNumber) ||
      normalizeIdentifier(row.assetTag) ||
      normalizeIdentifier(row.scannedValue);

    if (!key) {
      missingIdentifierRows.push({ rowNumber: row.rowNumber, reason: 'Picked-up device row has no caseNumber, serialNumber, assetTag, or scannedValue.' });
      continue;
    }

    if (seen.has(key)) {
      duplicateIdentifierRows.push({
        caseNumber: row.caseNumber || '',
        serialNumber: row.serialNumber || '',
        assetTag: row.assetTag || '',
        scannedValue: row.scannedValue || '',
        rowNumber: row.rowNumber,
        reason: 'Duplicate picked-up identifier row ignored.',
      });
      continue;
    }

    seen.add(key);
    pickedRows.push(row);
  }

  return { pickedRows, missingIdentifierRows, duplicateIdentifierRows };
}

function buildCaseIdentifierMap(rows, field) {
  const map = new Map();

  for (const row of rows) {
    const key = normalizeIdentifier(row[field]);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  return map;
}

function resolveCaseForPickedRow(row, { caseByNumber, casesBySerial, casesByAsset }) {
  const caseKey = normalizeIdentifier(row.caseNumber);
  if (caseKey) {
    return {
      caseRow: caseByNumber.get(caseKey) || null,
      reason: 'No matching EUSupport case found.',
    };
  }

  const candidates = new Map();
  const serialKey = normalizeIdentifier(row.serialNumber);
  const assetKey = normalizeIdentifier(row.assetTag);
  const scannedKey = normalizeIdentifier(row.scannedValue);

  for (const key of [serialKey, scannedKey].filter(Boolean)) {
    for (const candidate of casesBySerial.get(key) || []) {
      candidates.set(candidate.id, candidate);
    }
  }

  for (const key of [assetKey, scannedKey].filter(Boolean)) {
    for (const candidate of casesByAsset.get(key) || []) {
      candidates.set(candidate.id, candidate);
    }
  }

  if (candidates.size === 1) {
    return { caseRow: [...candidates.values()][0], reason: '' };
  }

  if (candidates.size > 1) {
    return {
      caseRow: null,
      reason: 'Multiple EUSupport cases matched the row by serialNumber or assetTag.',
    };
  }

  return {
    caseRow: null,
    reason: 'No matching EUSupport case found by serialNumber or assetTag.',
  };
}

function actualPickupDateFor(row) {
  return normalizeDate(row.actualPickupDate) || normalizeDate(row.pickedUpAt) || formatDateInTimeZone();
}

function noteBody(row, sourceFilename) {
  const details = [
    `Pickup scanner import: marked picked up and moved to Diagnosing.`,
    `Source file: ${sourceFilename || 'uploaded scanner export'}.`,
  ];

  if (row.scannedValue) details.push(`Scanned value: ${row.scannedValue}.`);
  if (row.crateNumber) details.push(`Intake crate: ${row.crateNumber}.`);
  if (row.pickedUpBy) details.push(`Picked up by: ${row.pickedUpBy}.`);
  if (row.pickedUpAt) details.push(`Picked up at: ${row.pickedUpAt}.`);

  return details.join(' ');
}

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;

    const user = await requireAuth(request);
    if (!canImportPickupResults(user)) {
      return Response.json({ error: 'Data Management permission required' }, { status: 403 });
    }
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'Upload a scanner results Excel, CSV, or JSON file.' }, { status: 422 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: 'File is too large. Upload a file smaller than 10 MB.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows;

    try {
      rows = parsePickupResults(buffer, file);
    } catch (err) {
      return Response.json({ error: 'Unable to parse scanner results export.' }, { status: 422 });
    }

    if (!rows.length) {
      return Response.json({ error: 'No rows found in the uploaded scanner results file.' }, { status: 422 });
    }

    const hasScannerColumns = rows.some((row) => row.recordType || row.pickupStatus);
    if (!hasScannerColumns) {
      return Response.json({ error: 'This does not look like a Refresh Pickup Scanner results export.' }, { status: 422 });
    }

    const ignored = summarizeIgnored(rows);
    const { pickedRows, missingIdentifierRows, duplicateIdentifierRows } = buildPickedRows(rows);

    if (!pickedRows.length) {
      return Response.json({
        ok: true,
        fileName: file.name || null,
        totalRows: rows.length,
        pickedUpRows: 0,
        updated: 0,
        alreadyProcessed: 0,
        skipped: missingIdentifierRows.length + duplicateIdentifierRows.length,
        ignored,
        skippedRows: [...missingIdentifierRows, ...duplicateIdentifierRows],
        updatedCases: [],
        message: 'No picked-up device rows were found to import.',
      });
    }

    const DIAGNOSIS_TEAM_ID = await getTeamId(DIAGNOSIS_TEAM_KEY);
    const result = await withTransaction(async (client) => {
      const creatorRes = await client.query(
        `SELECT id, display_name FROM users WHERE lower(upn) = lower($1) LIMIT 1`,
        [user.username]
      );
      const creator = creatorRes.rows[0] || null;
      const actorId = creator?.id || 0;
      const displayName = creator?.display_name || user.username;
      const caseNumberKeys = [...new Set(pickedRows.map((row) => normalizeIdentifier(row.caseNumber)).filter(Boolean))];
      const serialKeys = [...new Set(pickedRows.flatMap((row) => [normalizeIdentifier(row.serialNumber), normalizeIdentifier(row.scannedValue)]).filter(Boolean))];
      const assetKeys = [...new Set(pickedRows.flatMap((row) => [normalizeIdentifier(row.assetTag), normalizeIdentifier(row.scannedValue)]).filter(Boolean))];
      const caseRes = await client.query(
        `SELECT c.id, c.case_number, c.customer_name, c.facility, c.stage, c.status, c.workflow_key,
                r.serial_number, r.asset_tag
         FROM cm_cases c
         LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id
         WHERE regexp_replace(lower(COALESCE(c.case_number, '')), '[^a-z0-9]', '', 'g') = ANY($1::text[])
            OR regexp_replace(lower(COALESCE(r.serial_number, '')), '[^a-z0-9]', '', 'g') = ANY($2::text[])
            OR regexp_replace(lower(COALESCE(r.asset_tag, '')), '[^a-z0-9]', '', 'g') = ANY($3::text[])`,
        [caseNumberKeys, serialKeys, assetKeys]
      );
      const caseByNumber = new Map(caseRes.rows.map((caseRow) => [normalizeIdentifier(caseRow.case_number), caseRow]));
      const casesBySerial = buildCaseIdentifierMap(caseRes.rows, 'serial_number');
      const casesByAsset = buildCaseIdentifierMap(caseRes.rows, 'asset_tag');
      const updatedCases = [];
      const skippedRows = [...missingIdentifierRows, ...duplicateIdentifierRows];
      const processedCaseIds = new Set();
      let alreadyProcessed = 0;

      for (const row of pickedRows) {
        const { caseRow, reason: matchFailureReason } = resolveCaseForPickedRow(row, {
          caseByNumber,
          casesBySerial,
          casesByAsset,
        });

        if (!caseRow) {
          skippedRows.push({
            caseNumber: row.caseNumber || '',
            serialNumber: row.serialNumber || '',
            assetTag: row.assetTag || '',
            scannedValue: row.scannedValue || '',
            rowNumber: row.rowNumber,
            reason: matchFailureReason,
          });
          continue;
        }

        if (processedCaseIds.has(caseRow.id)) {
          skippedRows.push({ caseNumber: caseRow.case_number, rowNumber: row.rowNumber, reason: 'Duplicate picked-up case row ignored.' });
          continue;
        }

        if (caseRow.workflow_key !== 'refresh') {
          skippedRows.push({ caseNumber: caseRow.case_number, rowNumber: row.rowNumber, reason: 'Matching case is not a refresh case.' });
          continue;
        }

        if (caseRow.status !== 'Active') {
          skippedRows.push({ caseNumber: caseRow.case_number, rowNumber: row.rowNumber, reason: `Matching case is not Active (${caseRow.status || 'blank'}).` });
          continue;
        }

        if (caseRow.stage === 'Diagnosing') {
          alreadyProcessed += 1;
          skippedRows.push({ caseNumber: caseRow.case_number, rowNumber: row.rowNumber, reason: 'Case is already in Diagnosing.' });
          continue;
        }

        if (!PICKUP_STAGES.has(caseRow.stage)) {
          const reason = ALREADY_DIAGNOSIS_STAGES.has(caseRow.stage)
            ? `Case is already past pickup (${caseRow.stage}).`
            : `Current stage does not support pickup import (${caseRow.stage || 'blank'}).`;
          skippedRows.push({ caseNumber: caseRow.case_number, rowNumber: row.rowNumber, reason });
          continue;
        }

        const actualPickupDate = actualPickupDateFor(row);

        await client.query(
          `UPDATE cm_cases
           SET stage = 'Diagnosing',
               owning_team_id = $1,
               last_activity_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [DIAGNOSIS_TEAM_ID, caseRow.id]
        );

        await client.query(
          `INSERT INTO cm_case_logistics (case_id, actual_pickup_date, intake_crate, picked_up_by, updated_at)
           VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), CURRENT_TIMESTAMP)
           ON CONFLICT (case_id) DO UPDATE SET
             actual_pickup_date = COALESCE(NULLIF($2, ''), cm_case_logistics.actual_pickup_date),
             intake_crate = COALESCE(NULLIF($3, ''), cm_case_logistics.intake_crate),
             picked_up_by = COALESCE(NULLIF($4, ''), cm_case_logistics.picked_up_by),
             updated_at = CURRENT_TIMESTAMP`,
          [caseRow.id, actualPickupDate, row.crateNumber || '', row.pickedUpBy || '']
        );

        await client.query(
          `INSERT INTO ops_logistics_activity_log (
             workbook_key, cycle_version, user_id, username, display_name, event_type,
             case_value, customer_value, location_value, customer_asset_value, stage_value,
             new_sub_status, escalation_state, notify_rc_state, reason_notes, source_workbook_name, created_at
           )
           VALUES ($1, 0, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, false, $12, $13, CURRENT_TIMESTAMP)`,
          [
            LOGISTICS_WORKBOOK_KEY,
            actorId,
            user.username,
            displayName,
            PICKUP_SOURCE_NAME,
            caseRow.case_number,
            caseRow.customer_name || row.customer || '',
            caseRow.facility || row.facility || '',
            row.serialNumber || caseRow.serial_number || row.assetTag || caseRow.asset_tag || '',
            caseRow.stage,
            PICKUP_SUCCESS_STATUS,
            row.notes || null,
            file.name || PICKUP_SOURCE_NAME,
          ]
        );

        await client.query(
          `INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at)
           VALUES ($1, $2, 'SystemEvent', $3, $4, CURRENT_TIMESTAMP)`,
          [crypto.randomUUID(), caseRow.id, noteBody(row, file.name), creator?.id || null]
        );

        updatedCases.push({
          caseNumber: caseRow.case_number,
          fromStage: caseRow.stage,
          toStage: 'Diagnosing',
          actualPickupDate,
          crateNumber: row.crateNumber || null,
          pickedUpBy: row.pickedUpBy || null,
        });
        processedCaseIds.add(caseRow.id);
      }

      return { updatedCases, skippedRows, alreadyProcessed };
    });

    return Response.json({
      ok: true,
      fileName: file.name || null,
      totalRows: rows.length,
      pickedUpRows: pickedRows.length,
      updated: result.updatedCases.length,
      alreadyProcessed: result.alreadyProcessed,
      skipped: result.skippedRows.length,
      ignored,
      skippedRows: result.skippedRows,
      updatedCases: result.updatedCases,
    });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    console.error('[data-management/refresh-pickup-results POST]', err.stack || err.message);
    return Response.json({ error: 'Pickup results import failed.' }, { status: 500 });
  }
}
