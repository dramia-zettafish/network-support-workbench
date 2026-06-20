import { requireAuth, requireRole } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await requireRole(['supervisor', 'manager'], request);
    const { id } = await params;

    // Get case with all fields
    const [c] = await query(
      `SELECT c.*, u1.display_name AS created_by_name, u2.display_name AS assigned_to_name, t.label AS owning_team_name
       FROM cm_cases c
       LEFT JOIN users u1 ON u1.id = c.created_by_user_id
       LEFT JOIN users u2 ON u2.id = c.assigned_to_user_id
       LEFT JOIN teams t ON t.id = c.owning_team_id
       WHERE c.id = $1`, [id]
    );
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 });

    // Get refresh/rma data
    const [refresh] = await query(`SELECT * FROM cm_case_workflow_refresh WHERE case_id = $1`, [id]);
    const [rma] = await query(`SELECT * FROM cm_case_workflow_rma WHERE case_id = $1`, [id]);

    // Get logistics
    const [logistics] = await query(`SELECT * FROM cm_case_logistics WHERE case_id = $1`, [id]);

    // Get all audit-relevant notes with user info (including soft-deleted)
    const notes = await query(
      `SELECT n.note_type, n.body, n.created_at, n.deleted_at, n.deleted_by_user_id,
              u.display_name AS created_by, ud.display_name AS deleted_by
       FROM cm_case_notes n
       LEFT JOIN users u ON u.id = n.created_by_user_id
       LEFT JOIN users ud ON ud.id = n.deleted_by_user_id
       WHERE n.case_id = $1
       ORDER BY n.created_at DESC`, [id]
    );

    // Get defective parts history
    const parts = await query(
      `SELECT dp.part_name, dp.part_number, dp.condition, dp.created_at, dp.issued_at, u.display_name AS created_by
       FROM cm_case_defective_parts dp LEFT JOIN users u ON u.id = dp.created_by_user_id
       WHERE dp.case_id = $1 ORDER BY dp.created_at DESC`, [id]
    );

    // Get depot repair info
    const [depot] = await query(`SELECT * FROM cm_case_depot_repair WHERE case_id = $1`, [id]);

    // Combine into unified audit entries
    const noteEntries = notes.flatMap(n => {
      const entries = [{ date: n.created_at, by: n.created_by, type: n.note_type, details: n.body }];
      if (n.deleted_at) {
        entries.push({ date: n.deleted_at, by: n.deleted_by, type: 'Note Deleted', details: `Deleted ${n.note_type}: "${n.body?.substring(0, 80)}${n.body?.length > 80 ? '…' : ''}"` });
      }
      return entries;
    });

    const auditEntries = [
      ...noteEntries,
      ...parts.map(p => ({ date: p.created_at, by: p.created_by, type: 'Defective Part Added', details: `${p.part_name || ''}${p.part_number ? ' (' + p.part_number + ')' : ''} — ${p.condition || ''}${p.issued_at ? ' [Issued: ' + p.issued_at + ']' : ''}` })),
      ...(depot ? [{ date: depot.created_at || depot.engagement_date, by: null, type: 'Depot Repair', details: `Manufacturer Case#: ${depot.manufacturer_case_number || '-'}, Outbound: ${depot.outbound_carrier || '-'} ${depot.outbound_tracking || ''}, Outcome: ${depot.outcome || '-'}` }] : []),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Build current field snapshot
    const fields = [
      { field: 'Case Number', value: c.case_number },
      { field: 'Title', value: c.title },
      { field: 'Customer', value: c.customer_name },
      { field: 'Facility', value: c.facility },
      { field: 'Workflow', value: c.workflow_key },
      { field: 'Stage', value: c.stage },
      { field: 'Status', value: c.status },
      { field: 'Priority', value: c.priority },
      { field: 'Program', value: c.program },
      { field: 'Request Source', value: c.request_source },
      { field: 'Owning Team', value: c.owning_team_name },
      { field: 'Assigned To', value: c.assigned_to_name },
      { field: 'Created By', value: c.created_by_name },
      { field: 'Requester Name', value: c.requester_name },
      { field: 'Requester Email', value: c.requester_email },
      { field: 'Requester Phone', value: c.requester_phone },
      { field: 'POC Name', value: c.poc_name },
      { field: 'POC Email', value: c.poc_email },
      { field: 'POC Phone', value: c.poc_phone },
      { field: 'POC Address', value: c.poc_address },
      { field: 'Created At', value: c.created_at },
      { field: 'Updated At', value: c.updated_at },
      { field: 'Closed At', value: c.closed_at },
    ];

    if (refresh) {
      fields.push(
        { field: 'Manufacturer', value: refresh.manufacturer },
        { field: 'Device Type', value: refresh.device_type },
        { field: 'Serial Number', value: refresh.serial_number },
        { field: 'Asset Tag', value: refresh.asset_tag },
        { field: 'Model', value: refresh.model },
        { field: 'Model Name', value: refresh.model_name },
        { field: 'Warranty End', value: refresh.warranty_end },
        { field: 'ADP', value: refresh.adp },
        { field: 'Issue Description', value: refresh.issue_description },
        { field: 'Damage Excuse', value: refresh.damage_excuse },
      );
    }

    if (rma) {
      fields.push(
        { field: 'RMA Manufacturer', value: rma.manufacturer },
        { field: 'RMA Product ID', value: rma.product_id },
        { field: 'RMA Serial Number', value: rma.serial_number },
        { field: 'RMA MAC Address', value: rma.mac_address },
        { field: 'RMA Number', value: rma.rma_number },
        { field: 'Vendor SR Number', value: rma.vendor_sr_number },
        { field: 'RMA Issue Description', value: rma.issue_description },
      );
    }

    if (logistics) {
      fields.push(
        { field: 'Scheduled Pickup Date', value: logistics.scheduled_pickup_date },
        { field: 'Pickup Resource', value: logistics.pickup_resource },
        { field: 'Actual Pickup Date', value: logistics.actual_pickup_date },
        { field: 'Picked Up By', value: logistics.picked_up_by },
        { field: 'Intake Crate', value: logistics.intake_crate },
        { field: 'Scheduled Delivery Date', value: logistics.scheduled_delivery_date },
        { field: 'Delivery Resource', value: logistics.delivery_resource },
        { field: 'Actual Delivery Date', value: logistics.actual_delivery_date },
      );
    }

    return Response.json({ notes: auditEntries, created_by: c.created_by_name, created_at: c.created_at });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.forbidden) return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    return Response.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
