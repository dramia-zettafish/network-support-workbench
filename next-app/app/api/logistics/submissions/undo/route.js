/**
 * POST /api/logistics/submissions/undo
 *
 * Withdraws/undoes submitted rows from the chamber before Data Management clears it.
 * Requires write-safety guard. Not available after chamber has been cleared.
 */

import { NextResponse } from 'next/server';
import { requireWriteEnabled } from '@/lib/write-safety';
import { loadChamber, saveChamber } from '@/lib/logistics/chamber-storage.js';

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

  const { owner, work_order_numbers } = body;
  if (!owner || typeof owner !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "owner" field' }, { status: 400 });
  }
  if (!Array.isArray(work_order_numbers) || work_order_numbers.length === 0) {
    return NextResponse.json({ error: 'Missing or empty "work_order_numbers" array' }, { status: 400 });
  }

  const chamber = loadChamber();
  if (!chamber) {
    return NextResponse.json({ error: 'No active workbook' }, { status: 404 });
  }

  if (chamber.lastClearedAt) {
    return NextResponse.json({
      error: 'Chamber has been cleared. Undo is no longer available. Use correction request instead.',
      clearedAt: chamber.lastClearedAt,
    }, { status: 409 });
  }

  const errors = [];
  const removed = [];

  for (const wo of work_order_numbers) {
    const idx = chamber.submissions.findIndex(
      (s) => s.work_order_number === wo && s.owner.toLowerCase() === owner.toLowerCase()
    );
    if (idx === -1) {
      errors.push({ work_order_number: wo, message: 'Not found in chamber for this owner' });
    } else {
      removed.push(chamber.submissions.splice(idx, 1)[0]);
    }
  }

  if (removed.length > 0) {
    saveChamber(chamber);
  }

  if (errors.length > 0 && removed.length === 0) {
    return NextResponse.json({ error: 'No matching submissions found', errors }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    removed: removed.length,
    errors: errors.length > 0 ? errors : undefined,
    totalSubmissions: chamber.submissions.length,
  });
}
