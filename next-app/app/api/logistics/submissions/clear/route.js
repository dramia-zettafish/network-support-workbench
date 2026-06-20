/**
 * POST /api/logistics/submissions/clear
 *
 * Clears the submission chamber. Requires write-safety guard and { "confirm": true }.
 * Does NOT delete the active uploaded workbook.
 */

import { NextResponse } from 'next/server';
import { requireWriteEnabled } from '@/lib/write-safety';
import { clearChamber, loadChamber } from '@/lib/logistics/chamber-storage.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'Confirmation required. Send { "confirm": true } to clear the chamber.' },
      { status: 400 }
    );
  }

  const chamber = loadChamber();
  if (!chamber) {
    return NextResponse.json({ error: 'No active workbook' }, { status: 404 });
  }

  const cleared = clearChamber();
  return NextResponse.json({
    success: true,
    message: 'Chamber cleared. Active workbook remains uploaded.',
    clearedAt: cleared.lastClearedAt,
  });
}
