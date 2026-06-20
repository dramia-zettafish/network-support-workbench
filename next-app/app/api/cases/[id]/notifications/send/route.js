// Gated write endpoint: send RMA notification email and insert timeline note.
// Uses write-safety guard. No automatic sends. No stage transitions.

import { randomUUID } from 'node:crypto';
import { requireWriteEnabled, sanitizeWriteError } from '@/lib/write-safety';
import { requireAuth } from '@/lib/auth';
import { isValidNotificationType, generateNotification } from '@/lib/rma-notifications.js';
import { sendEmail, getSmtpStatus } from '@/lib/email.js';
import getPool from '@/lib/db.js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TIMELINE_LABELS = {
  manufacturer_engaged: 'manufacturer engagement update sent to case contacts',
  manufacturer_case_opened: 'manufacturer case/service request update sent to case contacts',
  rma_approved_eta: 'RMA approval / ETA update sent to case contacts',
  inbound_tracking_available: 'inbound tracking update sent to case contacts',
  rma_denied: 'RMA denial update sent to case contacts',
};

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

  const { type } = body || {};
  if (!type || !isValidNotificationType(type)) {
    return NextResponse.json(
      { error: 'Invalid notification type', validTypes: ['manufacturer_engaged', 'manufacturer_case_opened', 'rma_approved_eta', 'inbound_tracking_available', 'rma_denied'] },
      { status: 400 }
    );
  }

  // Check SMTP config before querying DB
  const smtp = getSmtpStatus();
  if (!smtp.configured) {
    return NextResponse.json(
      { error: 'Email service not configured', code: 'SMTP_NOT_CONFIGURED' },
      { status: 503 }
    );
  }

  const { id } = await params;

  // Re-query case and RMA data server-side (never trust client)
  const client = await getPool().connect();
  try {
    const caseResult = await client.query(
      'SELECT case_number, requester_name, requester_email, poc_name, poc_email FROM cm_cases WHERE id = $1',
      [id]
    );
    if (caseResult.rows.length === 0) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const caseData = caseResult.rows[0];

    if (!caseData.requester_email) {
      return NextResponse.json(
        { error: 'No recipient email address on case. Cannot send notification.' },
        { status: 400 }
      );
    }

    const rmaResult = await client.query(
      'SELECT manufacturer, product_id, serial_number, rma_number, rma_status, entitlement_status, vendor_sr_number, replacement_ship_promised_at, inbound_tracking, inbound_shipping_carrier FROM cm_case_workflow_rma WHERE case_id = $1',
      [id]
    );
    const rma = rmaResult.rows.length > 0 ? rmaResult.rows[0] : null;

    // Generate notification server-side
    const notification = generateNotification(type, caseData, rma);
    if (!notification) {
      return NextResponse.json({ error: 'Failed to generate notification' }, { status: 500 });
    }

    // Send email
    await sendEmail({
      to: notification.to,
      cc: notification.cc,
      subject: notification.subject,
      text: notification.body,
    });

    // Email succeeded — write timeline note in a transaction
    await client.query('BEGIN');

    const noteBody = `Customer email sent: ${TIMELINE_LABELS[type] || type}.`;
    await client.query(
      'INSERT INTO cm_case_notes (id, note_type, body, case_id, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [randomUUID(), 'SystemEvent', noteBody, id]
    );

    await client.query(
      'UPDATE cm_cases SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      type,
      to: notification.to,
      cc: notification.cc,
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    if (error.code === 'SMTP_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'Email service not configured', code: 'SMTP_NOT_CONFIGURED' }, { status: 503 });
    }
    return sanitizeWriteError(error);
  } finally {
    client.release();
  }
}
