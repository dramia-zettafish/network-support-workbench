/**
 * Workbook Parser — parses the active logistics workbook into normalized rows.
 *
 * Column matching strategy:
 *   1. Match by header name (case-insensitive, trimmed)
 *   2. If header not found, fall back to known column letter positions
 *
 * Known column letter fallbacks (from prior workflow notes):
 *   - Case: G
 *   - Customer (Case): H
 *   - Customer Asset (Case): I
 *   - Location (Case): K
 *   - Status Reason (Case): L
 *   - Sub-Status: M
 */

import 'server-only';

import * as XLSX from 'xlsx';
import { readWorkbookBuffer } from './workbook-storage.js';

/** Header names we look for (case-insensitive match) */
const HEADER_MAP = {
  owner: 'owner',
  'work order number': 'work_order_number',
  case: 'case_number',
  'customer (case)': 'customer',
  'customer asset (case)': 'customer_asset',
  'location (case)': 'location',
  'status reason (case)': 'status_reason',
  'sub-status': 'sub_status',
};

/** Fallback column letters (0-indexed) when headers are missing/ambiguous */
const FALLBACK_COLUMNS = {
  case_number: 6,       // G
  customer: 7,          // H
  customer_asset: 8,    // I
  location: 10,         // K
  status_reason: 11,    // L
  sub_status: 12,       // M
};

/**
 * Parse the active workbook and return normalized rows + warnings.
 * @returns {{ rows: object[], warnings: string[], rowCount: number } | null}
 */
export function parseActiveWorkbook() {
  const buffer = readWorkbookBuffer();
  if (!buffer) return null;

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], warnings: ['No worksheets found'], rowCount: 0 };

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (raw.length < 2) return { rows: [], warnings: ['Sheet has no data rows'], rowCount: 0 };

  const headerRow = raw[0];
  const warnings = [];

  // Build column index map: field -> column index
  const colMap = {};
  const normalizedHeaders = headerRow.map((h) => String(h).trim().toLowerCase());

  for (const [headerName, fieldName] of Object.entries(HEADER_MAP)) {
    const idx = normalizedHeaders.indexOf(headerName);
    if (idx !== -1) {
      colMap[fieldName] = idx;
    }
  }

  // Apply fallbacks for missing columns
  for (const [fieldName, fallbackIdx] of Object.entries(FALLBACK_COLUMNS)) {
    if (!(fieldName in colMap)) {
      if (fallbackIdx < headerRow.length) {
        colMap[fieldName] = fallbackIdx;
        warnings.push(`Column "${fieldName}" not found by header name; using fallback column letter`);
      } else {
        warnings.push(`Column "${fieldName}" not found and fallback column out of range`);
      }
    }
  }

  // Check for owner and work_order_number specifically
  if (!('owner' in colMap)) warnings.push('Required column "Owner" not found');
  if (!('work_order_number' in colMap)) warnings.push('Required column "Work Order Number" not found');

  // Parse data rows
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((cell) => cell === '' || cell == null)) continue;

    const workOrderNumber = colMap.work_order_number != null ? String(r[colMap.work_order_number] || '').trim() : '';
    if (!workOrderNumber) continue; // Skip rows without work order number

    rows.push({
      work_order_number: workOrderNumber,
      case_number: colMap.case_number != null ? String(r[colMap.case_number] || '').trim() : '',
      customer: colMap.customer != null ? String(r[colMap.customer] || '').trim() : '',
      customer_asset: colMap.customer_asset != null ? String(r[colMap.customer_asset] || '').trim() : '',
      location: colMap.location != null ? String(r[colMap.location] || '').trim() : '',
      status_reason: colMap.status_reason != null ? String(r[colMap.status_reason] || '').trim() : '',
      sub_status: colMap.sub_status != null ? String(r[colMap.sub_status] || '').trim() : '',
      owner: colMap.owner != null ? String(r[colMap.owner] || '').trim() : '',
      row_number: i + 1,
    });
  }

  return { rows, warnings, rowCount: rows.length };
}
