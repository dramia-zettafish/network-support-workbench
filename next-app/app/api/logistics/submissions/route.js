/**
 * POST /api/logistics/submissions — submit pickup/delivery outcomes.
 * GET  /api/logistics/submissions — return current chamber submissions.
 *
 * POST requires write-safety guard. GET is read-only.
 */

import { NextResponse } from 'next/server';
import { requireWriteEnabled } from '@/lib/write-safety';
import { parseActiveWorkbook } from '@/lib/logistics/workbook-parser.js';
import { loadChamber, addSubmissions } from '@/lib/logistics/chamber-storage.js';

export const dynamic = 'force-dynamic';

/** Allowed sub_status values by status_reason */
const ALLOWED_SUB_STATUS = {
  'ready for pickup': ['Pick up Successful', 'Pick Up Failed'],
  'ready for delivery': ['Delivery Successful', ''],
};

export async function GET() {
  const chamber = loadChamber();
  if (!chamber) {
    return NextResponse.json({ submissions: [], message: 'No active workbook' });
  }

  // Group by owner
  const byOwner = {};
  for (const s of chamber.submissions) {
    if (!byOwner[s.owner]) byOwner[s.owner] = [];
    byOwner[s.owner].push(s);
  }

  return NextResponse.json({
    submissions: chamber.submissions,
    byOwner,
    count: chamber.submissions.length,
  });
}

export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { owner, updates } = body;
  if (!owner || typeof owner !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "owner" field' }, { status: 400 });
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Missing or empty "updates" array' }, { status: 400 });
  }

  const parsed = parseActiveWorkbook();
  if (!parsed) {
    return NextResponse.json({ error: 'No active workbook' }, { status: 404 });
  }

  // Build lookup of workbook rows by work_order_number
  const rowMap = {};
  for (const row of parsed.rows) {
    rowMap[row.work_order_number] = row;
  }

  const errors = [];
  const validEntries = [];

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    if (!u.work_order_number) {
      errors.push({ index: i, field: 'work_order_number', message: 'Missing work_order_number' });
      continue;
    }

    const row = rowMap[u.work_order_number];
    if (!row) {
      errors.push({ index: i, work_order_number: u.work_order_number, message: 'Work order not found in active workbook' });
      continue;
    }

    if (row.owner.toLowerCase() !== owner.toLowerCase()) {
      errors.push({ index: i, work_order_number: u.work_order_number, message: `Row owner "${row.owner}" does not match supplied owner "${owner}"` });
      continue;
    }

    const statusKey = row.status_reason.toLowerCase();
    const allowed = ALLOWED_SUB_STATUS[statusKey];
    if (!allowed) {
      errors.push({ index: i, work_order_number: u.work_order_number, message: `Status reason "${row.status_reason}" does not support submissions` });
      continue;
    }

    // For Ready For Pickup, sub_status is required
    if (statusKey === 'ready for pickup' && (!u.sub_status || u.sub_status.trim() === '')) {
      errors.push({ index: i, work_order_number: u.work_order_number, message: 'sub_status is required for Ready For Pickup rows' });
      continue;
    }

    const subStatus = (u.sub_status || '').trim();
    if (!allowed.includes(subStatus)) {
      errors.push({ index: i, work_order_number: u.work_order_number, message: `Invalid sub_status "${subStatus}". Allowed: ${allowed.filter(Boolean).join(', ') || '(blank)'}` });
      continue;
    }

    validEntries.push({
      work_order_number: u.work_order_number,
      owner,
      sub_status: subStatus,
      submittedAt: new Date().toISOString(),
    });
  }

  if (errors.length > 0 && validEntries.length === 0) {
    return NextResponse.json({ error: 'All submissions failed validation', errors }, { status: 400 });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Some submissions failed validation', errors }, { status: 400 });
  }

  const chamber = addSubmissions(validEntries);
  if (!chamber) {
    return NextResponse.json({ error: 'Failed to persist submissions' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    submitted: validEntries.length,
    totalSubmissions: chamber.submissions.length,
  });
}
