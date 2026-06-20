/**
 * GET /api/logistics/workbook/status — returns active workbook metadata from DB.
 */

import { NextResponse } from 'next/server';
import { getActiveWorkbook, getSourceRows } from '@/lib/logistics/workbook-db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workbook = await getActiveWorkbook();
    if (!workbook) {
      return NextResponse.json({ active: false, message: 'No active workbook uploaded' });
    }

    const rows = await getSourceRows(workbook.cycle_version || 1);

    return NextResponse.json({
      active: true,
      filename: workbook.file_name,
      uploadedAt: workbook.uploaded_at,
      uploadedBy: workbook.uploaded_by_display_name || workbook.uploaded_by_user_id,
      rowCount: rows.length,
      cycleVersion: workbook.cycle_version,
      sheetName: workbook.sheet_name,
    });
  } catch (err) {
    console.error('[workbook/status] Error:', err.message);
    return NextResponse.json({ active: false, message: 'Database unavailable' });
  }
}
