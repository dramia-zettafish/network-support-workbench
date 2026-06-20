// Gated write endpoint: execute manual RMA workflow actions.
// Uses write-safety guard. No automatic emails. No hidden triggers.

import { randomUUID } from 'node:crypto';
import { requireWriteEnabled, sanitizeWriteError } from '@/lib/write-safety';
import { requireAuth } from '@/lib/auth';
import { SUPPORTED_ACTIONS, checkPrerequisites, buildNoteBody, getRecommendedNotification } from '@/lib/rma-workflow-actions.js';
import getPool from '@/lib/db.js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  // Write-safety gate
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  // Auth
  try {
    await requireAuth(request);
  } catch (err) {
    if (err.unauthorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action } = body || {};
  if (!action || !SUPPORTED_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: 'Invalid or missing action', supportedActions: SUPPORTED_ACTIONS },
      { status: 400 }
    );
  }

  const { id } = await params;

  const client = await getPool().connect();
  try {
    // Re-query case and RMA data server-side (never trust client)
    const caseResult = await client.query(
      'SELECT id FROM cm_cases WHERE id = $1',
      [id]
    );
    if (caseResult.rows.length === 0) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const rmaResult = await client.query(
      'SELECT manufacturer, product_id, serial_number, rma_number, rma_status, entitlement_status, vendor_sr_number, replacement_ship_promised_at, inbound_tracking, inbound_shipping_carrier, outbound_tracking, outbound_shipping_carrier FROM cm_case_workflow_rma WHERE case_id = $1',
      [id]
    );

    const rma = rmaResult.rows.length > 0 ? rmaResult.rows[0] : null;

    // Check prerequisites
    const prereqs = checkPrerequisites(action, rma);
    if (!prereqs.met) {
      return NextResponse.json(
        { error: 'Prerequisites not met', missingPrerequisites: prereqs.missing, action },
        { status: 400 }
      );
    }

    // Execute action: insert SystemEvent note + update timestamps in transaction
    await client.query('BEGIN');

    const noteBody = buildNoteBody(action);
    await client.query(
      'INSERT INTO cm_case_notes (id, note_type, body, case_id, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [randomUUID(), 'SystemEvent', noteBody, id]
    );

    await client.query(
      'UPDATE cm_cases SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');

    const recommendedNotification = getRecommendedNotification(action);

    return NextResponse.json({
      success: true,
      action,
      message: noteBody,
      ...(recommendedNotification && { recommendedNotificationType: recommendedNotification }),
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    return sanitizeWriteError(error);
  } finally {
    client.release();
  }
}
