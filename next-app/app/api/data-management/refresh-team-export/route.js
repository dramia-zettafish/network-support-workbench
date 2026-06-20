import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    // If no team_id, return list of available teams
    if (!teamId) {
      const teams = await query(
        `SELECT id, name FROM cm_custom_logistics_teams WHERE expires_at > CURRENT_TIMESTAMP ORDER BY name`
      );
      return Response.json({ teams });
    }

    // Get team name
    const [team] = await query(`SELECT name FROM cm_custom_logistics_teams WHERE id = $1`, [teamId]);
    if (!team) return Response.json({ error: 'Team not found' }, { status: 404 });

    const pickupResource = `[Team] ${team.name}`;

    // Query pickup scheduled cases for this team on current date
    const rows = await query(
      `SELECT c.case_number, c.title, c.description, c.customer_name, c.facility,
              c.requester_name, c.requester_email, c.requester_phone,
              c.poc_name, c.poc_email, c.poc_phone, c.poc_address,
              c.request_source, c.stage, c.status, c.priority,
              c.hisd_exception, c.cancellation_reason,
              c.last_activity_at, c.created_at, c.updated_at, c.closed_at,
              r.manufacturer, r.device_type, r.serial_number, r.asset_tag,
              r.model, r.model_name, r.issue_description, r.damage_excuse,
              r.warranty_end, r.adp,
              cl.scheduled_pickup_date, cl.pickup_resource,
              cl.scheduled_delivery_date, cl.delivery_resource,
              cl.actual_pickup_date, cl.actual_delivery_date
       FROM cm_cases c
       JOIN cm_case_logistics cl ON cl.case_id = c.id
       LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id
       WHERE c.stage = 'Pickup Scheduled'
         AND cl.pickup_resource = $1
         AND cl.scheduled_pickup_date = CURRENT_DATE::TEXT
       ORDER BY c.facility, c.customer_name, c.case_number`,
      [pickupResource]
    );

    // Build CSV
    const headers = [
      'Case Number', 'Title', 'Description', 'Customer', 'Facility',
      'Requester Name', 'Requester Email', 'Requester Phone',
      'POC Name', 'POC Email', 'POC Phone', 'POC Address',
      'Request Source', 'Stage', 'Status', 'Priority',
      'HISD Exception', 'Cancellation Reason',
      'Last Activity', 'Created At', 'Updated At', 'Closed At',
      'Manufacturer', 'Device Type', 'Serial Number', 'Asset Tag',
      'Model', 'Model Name', 'Issue Description', 'Damage Excuse',
      'Warranty End', 'ADP',
      'Scheduled Pickup Date', 'Pickup Resource',
      'Scheduled Delivery Date', 'Delivery Resource',
      'Actual Pickup Date', 'Actual Delivery Date',
    ];
    const fields = [
      'case_number', 'title', 'description', 'customer_name', 'facility',
      'requester_name', 'requester_email', 'requester_phone',
      'poc_name', 'poc_email', 'poc_phone', 'poc_address',
      'request_source', 'stage', 'status', 'priority',
      'hisd_exception', 'cancellation_reason',
      'last_activity_at', 'created_at', 'updated_at', 'closed_at',
      'manufacturer', 'device_type', 'serial_number', 'asset_tag',
      'model', 'model_name', 'issue_description', 'damage_excuse',
      'warranty_end', 'adp',
      'scheduled_pickup_date', 'pickup_resource',
      'scheduled_delivery_date', 'delivery_resource',
      'actual_pickup_date', 'actual_delivery_date',
    ];
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      csvRows.push(fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    }

    const csv = csvRows.join('\n');
    const today = new Date().toISOString().slice(0, 10);
    const filename = `pickup-scheduled-${team.name.replace(/[^a-zA-Z0-9]/g, '_')}-${today}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}
