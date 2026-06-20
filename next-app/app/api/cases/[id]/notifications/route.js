// Read-only notification preview endpoint.
// No INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE.
// No email sending. No SMTP. No timeline notes. No stage/status changes.

import { query } from '@/lib/db.js';
import { validateTableName } from '@/lib/db-read-queries.js';
import { requireAuth } from '@/lib/auth';
import { isValidNotificationType, generateNotification } from '@/lib/rma-notifications.js';

export const dynamic = 'force-dynamic';

const CASES_TABLE = 'cm_cases';
const RMA_TABLE = 'cm_case_workflow_rma';

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
  } catch (err) {
    if (err.unauthorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !isValidNotificationType(type)) {
      return Response.json(
        { error: `Invalid notification type. Valid types: manufacturer_engaged, manufacturer_case_opened, rma_approved_eta, inbound_tracking_available, rma_denied` },
        { status: 400 }
      );
    }

    validateTableName(CASES_TABLE);
    validateTableName(RMA_TABLE);

    const { id } = await params;

    const caseRows = await query(
      `SELECT case_number, requester_name, requester_email, poc_name, poc_email FROM cm_cases WHERE id = $1`,
      [id]
    );

    if (!caseRows || caseRows.length === 0) {
      return Response.json({ error: 'Case not found' }, { status: 404 });
    }

    const rmaRows = await query(
      `SELECT manufacturer, product_id, serial_number, rma_number, rma_status, entitlement_status, vendor_sr_number, replacement_ship_promised_at, inbound_tracking, inbound_shipping_carrier FROM cm_case_workflow_rma WHERE case_id = $1`,
      [id]
    );

    const caseData = caseRows[0];
    const rma = rmaRows && rmaRows.length > 0 ? rmaRows[0] : null;

    const notification = generateNotification(type, caseData, rma);

    return Response.json({
      data: {
        type,
        to: notification.to,
        cc: notification.cc,
        subject: notification.subject,
        body: notification.body,
        warnings: notification.warnings,
      },
    });
  } catch (err) {
    console.error('Notification preview error:', err);
    return Response.json({ error: 'Unable to generate notification preview' }, { status: 500 });
  }
}
