/**
 * POST /api/logistics/workbook/updates — submit pickup/delivery outcomes.
 */

import { NextResponse } from 'next/server';
import { requireWriteEnabled } from '@/lib/write-safety';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { getActiveWorkbook, getSourceRows, getCompletedRowKeys, submitUpdates } from '@/lib/logistics/workbook-db.js';

export const dynamic = 'force-dynamic';

const ALLOWED_SUB_STATUS = {
  'ready for pickup': ['Pick up Successful', 'Pick Up Failed', 'Device Not On Pickup List'],
  'ready for delivery': ['Delivery Successful', 'Delivery Failure'],
};

const FAILURE_SUB_STATUS = new Set(['Pick Up Failed', 'Delivery Failure']);

export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.updates) || !body.updates.length) {
    return NextResponse.json({ error: 'Missing updates array' }, { status: 422 });
  }

  const userRows = await query('SELECT id, display_name FROM users WHERE upn = $1 LIMIT 1', [user.username]);
  const userId = userRows[0]?.id || user.id;
  const displayName = (userRows[0]?.display_name || '').trim();

  const workbook = await getActiveWorkbook();
  if (!workbook) return NextResponse.json({ error: 'No active workbook' }, { status: 404 });

  const cycleVersion = workbook.cycle_version || 1;
  const sourceRows = await getSourceRows(cycleVersion);
  const completedKeys = await getCompletedRowKeys(cycleVersion, userId);

  const sourceByKey = {};
  for (const r of sourceRows) sourceByKey[r.work_order_key] = r;

  // Validate and normalize updates
  const normalizedUpdates = [];
  for (const u of body.updates) {
    const woValue = String(u.work_order_value || u.workOrderValue || '').trim();
    const woKey = woValue.replace(/\s+/g, ' ').toLowerCase();
    if (!woKey) continue;

    const source = sourceByKey[woKey];
    if (!source) return NextResponse.json({ error: `Work Order "${woValue}" not in active workbook` }, { status: 422 });
    if (source.owner_value.trim().toLowerCase() !== displayName.toLowerCase()) {
      return NextResponse.json({ error: `Work Order "${woValue}" is not assigned to you` }, { status: 422 });
    }
    if (completedKeys.has(woKey)) continue;

    const statusKey = (source.status_reason || '').toLowerCase();
    const allowed = ALLOWED_SUB_STATUS[statusKey];
    if (!allowed) continue;

    const subStatus = String(u.sub_status || u.subStatus || '').trim();
    if (!subStatus) return NextResponse.json({ error: `Sub-Status required for "${woValue}"` }, { status: 422 });
    if (!allowed.includes(subStatus)) {
      return NextResponse.json({ error: `Invalid Sub-Status "${subStatus}" for "${woValue}"` }, { status: 422 });
    }

    const failureReason = String(u.failure_reason || u.failureReason || '').trim();
    if (FAILURE_SUB_STATUS.has(subStatus) && !failureReason) {
      return NextResponse.json({ error: `Failure reason required for "${woValue}"` }, { status: 422 });
    }

    normalizedUpdates.push({
      workOrderKey: woKey,
      subStatus,
      escalate: !!u.escalate,
      failureReason,
    });
  }

  if (!normalizedUpdates.length) return NextResponse.json({ error: 'No valid updates' }, { status: 422 });

  const result = await submitUpdates({
    cycleVersion,
    userId,
    displayName,
    username: user.username,
    updates: normalizedUpdates,
    sourceRows: sourceByKey,
    sourceWorkbookName: workbook.file_name,
  });

  return NextResponse.json({
    ok: true,
    updatedRows: result.rowCount,
    message: `Updated ${result.rowCount} case${result.rowCount !== 1 ? 's' : ''}.`,
  });
}
