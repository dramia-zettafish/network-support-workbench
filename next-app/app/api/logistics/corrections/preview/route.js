/**
 * POST /api/logistics/corrections/preview
 *
 * Generates a correction request message preview for the Route Coordinator.
 * Preview-only — does not persist or send anything.
 * No write-safety guard needed (read-only generation).
 */

import { NextResponse } from 'next/server';
import { loadChamber } from '@/lib/logistics/chamber-storage.js';
import { parseActiveWorkbook } from '@/lib/logistics/workbook-parser.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { owner, work_order_numbers, explanation } = body;
  if (!owner || typeof owner !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "owner" field' }, { status: 400 });
  }
  if (!Array.isArray(work_order_numbers) || work_order_numbers.length === 0) {
    return NextResponse.json({ error: 'Missing or empty "work_order_numbers" array' }, { status: 400 });
  }
  if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or empty "explanation" field' }, { status: 400 });
  }

  const parsed = parseActiveWorkbook();
  if (!parsed) {
    return NextResponse.json({ error: 'No active workbook' }, { status: 404 });
  }

  const chamber = loadChamber();

  // Build row lookup
  const rowMap = {};
  for (const row of parsed.rows) {
    rowMap[row.work_order_number] = row;
  }

  // Build submission lookup
  const subMap = {};
  if (chamber?.submissions) {
    for (const s of chamber.submissions) {
      subMap[s.work_order_number] = s;
    }
  }

  const affectedRows = [];
  for (const wo of work_order_numbers) {
    const row = rowMap[wo];
    if (row) {
      affectedRows.push({
        work_order_number: wo,
        case_number: row.case_number,
        customer: row.customer,
        location: row.location,
        status_reason: row.status_reason,
        submitted_sub_status: subMap[wo]?.sub_status || '(not in current chamber)',
      });
    }
  }

  if (affectedRows.length === 0) {
    return NextResponse.json({ error: 'No matching rows found in workbook' }, { status: 404 });
  }

  // Generate message
  const rowLines = affectedRows.map((r) =>
    `  • WO: ${r.work_order_number} | Case: ${r.case_number} | Customer: ${r.customer} | Location: ${r.location} | Status: ${r.status_reason} | Submitted Sub-Status: ${r.submitted_sub_status}`
  ).join('\n');

  const subject = `Logistics Correction Request – ${owner}`;
  const messageBody = `To: Route Coordinator / Data Management Team

Subject: ${subject}

A correction has been requested for the following logistics row(s):

Owner: ${owner}
Affected Rows:
${rowLines}

Explanation:
${explanation.trim()}

---
This message was generated as a preview. No changes have been made to the workbook or submissions.
Please coordinate with the technician and Data Management to resolve.`;

  return NextResponse.json({
    preview: true,
    subject,
    message: messageBody,
    affectedRows,
    owner,
    explanation: explanation.trim(),
  });
}
