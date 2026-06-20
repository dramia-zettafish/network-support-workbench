/**
 * POST /api/logistics/workbook/upload
 *
 * Accepts an .xlsx file upload, detects headers, parses rows, and stores
 * to ops_active_workbooks + ops_workbook_source_rows (DB-backed).
 */

import { NextResponse } from 'next/server';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { detectSheet, parseRows, storeWorkbook, storeSourceRows, getActiveWorkbook } from '@/lib/logistics/workbook-db.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  let formData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const filename = (file.name || 'upload.xlsx').replace(/['"]/g, '');
  if (!filename.endsWith('.xlsx')) return NextResponse.json({ error: 'Only .xlsx files are accepted' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) return NextResponse.json({ error: 'Empty file' }, { status: 400 });

  const detected = detectSheet(buffer);
  if (!detected) {
    return NextResponse.json({ error: 'No worksheet contains the required logistics headers: Work Order Number, Customer (Case) (Case), Customer Asset (Case) (Case), Location (Case) (Case), Status Reason (Case) (Case), Sub-Status, Owner (Case) (Case)' }, { status: 400 });
  }

  const { rows, duplicates } = parseRows(detected);
  if (duplicates.length) {
    return NextResponse.json({ error: `Duplicate Work Order Numbers found: ${duplicates.slice(0, 10).join(', ')}` }, { status: 400 });
  }

  // Resolve user ID from users table
  const userRows = await query('SELECT id FROM users WHERE upn = $1 LIMIT 1', [user.username]);
  const userId = userRows[0]?.id || user.id;

  const existing = await getActiveWorkbook();
  const cycleVersion = existing ? (existing.cycle_version || 0) + 1 : 1;

  await storeWorkbook({
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheetName: detected.sheetName,
    sheetIndex: detected.sheetIndex,
    headerRowIndex: detected.headerRowIndex,
    cycleVersion,
    workbookBytes: buffer,
    userId,
  });

  await storeSourceRows(cycleVersion, rows);

  return NextResponse.json({
    success: true,
    filename,
    uploadedAt: new Date().toISOString(),
    rowCount: Object.keys(rows).length,
    sheetName: detected.sheetName,
    cycleVersion,
  });
}
