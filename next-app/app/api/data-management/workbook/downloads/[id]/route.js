/**
 * GET /api/data-management/workbook/downloads/:id - download a stored compiled workbook.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDownloadArchive } from '@/lib/logistics/workbook-db.js';

export const dynamic = 'force-dynamic';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const downloadId = Number(params?.id);
  if (!Number.isInteger(downloadId) || downloadId <= 0) {
    return NextResponse.json({ error: 'Invalid download id' }, { status: 400 });
  }

  const archive = await getDownloadArchive(downloadId);
  if (!archive) return NextResponse.json({ error: 'Download archive not found' }, { status: 404 });

  return new Response(archive.file_bytes, {
    headers: {
      'Content-Type': archive.content_type || XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${archive.file_name || 'workbook.xlsx'}"`,
    },
  });
}
