import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { mutate } from '@/lib/db-write.js';

/**
 * PATCH /api/checkin/set-location — set inventory location for a part during check-in
 * Body: { part_no, location }
 */
export async function PATCH(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  try {
    const { part_no, location } = await req.json();
    if (!part_no || !location) {
      return NextResponse.json({ error: 'part_no and location are required' }, { status: 422 });
    }

    await mutate(
      `UPDATE inventory SET location = $1, updated_at = CURRENT_TIMESTAMP WHERE part_no = $2`,
      [location.trim(), part_no.trim().toUpperCase()]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return sanitizeWriteError(error);
  }
}
