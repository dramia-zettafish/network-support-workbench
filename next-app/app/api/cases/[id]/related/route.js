// Read-only related case data query endpoint.
// Source tables: cm_case_workflow_rma, cm_case_notes, cm_case_requirements

import { query } from '@/lib/db.js';
import { validateTableName } from '@/lib/db-read-queries.js';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CASES_TABLE = 'cm_cases';
const RMA_TABLE = 'cm_case_workflow_rma';
const NOTES_TABLE = 'cm_case_notes';
const REQUIREMENTS_TABLE = 'cm_case_requirements';

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
    // Validate all table names against the allowlist
    validateTableName(CASES_TABLE);
    validateTableName(RMA_TABLE);
    validateTableName(NOTES_TABLE);
    validateTableName(REQUIREMENTS_TABLE);

    const { id } = await params;

    // Verify parent case exists
    const caseRows = await query(
      `SELECT id FROM cm_cases WHERE id = $1`,
      [id]
    );

    if (!caseRows || caseRows.length === 0) {
      return Response.json({ error: 'Case not found' }, { status: 404 });
    }

    // Query RMA data
    const rmaRows = await query(
      `SELECT manufacturer, product_id, serial_number, mac_address, issue_description, rma_status, rma_number, entitlement_status, vendor_sr_number, replacement_ship_to, replacement_ship_promised_at, inbound_tracking, outbound_tracking, inbound_shipping_carrier, outbound_shipping_carrier, return_required FROM cm_case_workflow_rma WHERE case_id = $1`,
      [id]
    );

    // Query refresh data
    const refreshRows = await query(
      `SELECT manufacturer, device_type, serial_number, asset_tag, model, model_name, warranty_end, adp, issue_description, damage_excuse FROM cm_case_workflow_refresh WHERE case_id = $1`,
      [id]
    );

    // Query notes - all note_type values returned as data without filtering
    const notesRows = await query(
      `SELECT n.id, n.note_type, n.body, n.created_at, u.display_name as created_by FROM cm_case_notes n LEFT JOIN users u ON u.id = n.created_by_user_id WHERE n.case_id = $1 ORDER BY n.created_at DESC`,
      [id]
    );

    // Query requirements
    const requirementsRows = await query(
      `SELECT id, key, label, is_required, is_present FROM cm_case_requirements WHERE case_id = $1 ORDER BY key`,
      [id]
    );

    return Response.json({
      data: {
        rma: rmaRows && rmaRows.length > 0 ? rmaRows[0] : null,
        refresh: refreshRows && refreshRows.length > 0 ? refreshRows[0] : null,
        notes: notesRows || [],
        requirements: requirementsRows || [],
      },
    });
  } catch (err) {
    return Response.json(
      { error: 'Unable to retrieve related case data' },
      { status: 500 }
    );
  }
}
