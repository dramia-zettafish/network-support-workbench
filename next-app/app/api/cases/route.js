// Cases query + creation endpoint.
// Source table: cm_cases

import { query } from '@/lib/db.js';
import { mutate, withTransaction } from '@/lib/db-write.js';
import { validateTableName } from '@/lib/db-read-queries.js';
import { requireAuth, requireTeamAccess } from '@/lib/auth';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const CASES_TABLE = 'cm_cases';
const INTAKE_TEAM_KEY = 'intake_administrators';

const REQUEST_SOURCES = ['Service Desk', 'Technician', 'Leadership', 'PM', 'Direct', 'Savant'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'];

export async function GET(request) {
  try {
    const user = await requireAuth(request);

    validateTableName(CASES_TABLE);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const team = searchParams.get('team') || '';
    const workflow = searchParams.get('workflow') || '';
    const customer = searchParams.get('customer') || '';
    const facility = searchParams.get('facility') || '';
    const manufacturer = searchParams.get('manufacturer') || '';
    const model = searchParams.get('model') || '';
    const modelName = searchParams.get('model_name') || '';
    const defectivePart = searchParams.get('defective_part') || '';
    const defectivePartNumber = searchParams.get('defective_part_number') || '';
    const createdBy = searchParams.get('created_by') || '';
    const assignedTo = searchParams.get('assigned_to') || '';
    const activityBy = searchParams.get('activity_by') || '';
    const stage = searchParams.get('stage') || '';
    const status = searchParams.get('status') || '';
    const hasRepairSuccess = searchParams.get('has_repair_success') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10);
    const limit = rawLimit === 0 ? 0 : Math.max(1, rawLimit);
    const offset = limit === 0 ? 0 : (page - 1) * limit;

    const cols = `c.id, c.case_number, c.title, c.customer_name, c.facility, c.workflow_key, c.stage, c.status, c.priority, c.program, c.last_activity_at, c.owning_team_id, c.assigned_to_user_id, c.created_by_user_id, c.created_at, c.requester_name, c.requester_email, c.requester_phone, c.poc_name, c.poc_email, c.poc_phone, c.poc_address, cl.scheduled_pickup_date, cl.pickup_resource, cl.scheduled_delivery_date, cl.delivery_resource, cl.intake_crate, cl.actual_pickup_date, cl.actual_delivery_date, cl.picked_up_by, r.manufacturer, r.serial_number, r.asset_tag, r.model, r.model_name, r.warranty_end, r.adp, r.issue_description, r.device_type, dr.manufacturer_case_number AS depot_manufacturer_case_number, dr.engagement_date AS depot_engagement_date, dr.outbound_carrier AS depot_outbound_carrier, dr.outbound_tracking AS depot_outbound_tracking, dr.outcome AS depot_outcome, dr.inbound_carrier AS depot_inbound_carrier, dr.inbound_tracking AS depot_inbound_tracking, (SELECT n.body FROM cm_case_notes n WHERE n.case_id = c.id AND n.note_type = 'AssetLocation' ORDER BY n.created_at DESC LIMIT 1) AS asset_location_json, (SELECT COUNT(*) FROM cm_case_logistics_failures f WHERE f.case_id = c.id AND f.failure_type = 'pickup')::int AS pickup_failure_count, (SELECT COUNT(*) FROM cm_case_logistics_failures f WHERE f.case_id = c.id AND f.failure_type = 'delivery')::int AS delivery_failure_count, (SELECT COALESCE((SELECT 'Additional Part Request: ' || n.body FROM cm_case_notes n WHERE n.case_id = c.id AND n.note_type = 'Additional Part Request' ORDER BY n.created_at DESC LIMIT 1), (SELECT n.body FROM cm_case_notes n WHERE n.case_id = c.id AND n.note_type = 'Diagnostic' ORDER BY n.created_at DESC LIMIT 1))) AS diagnostic_note, (SELECT string_agg(dp.part_name, ', ' ORDER BY dp.created_at) FROM cm_case_defective_parts dp WHERE dp.case_id = c.id AND dp.issued_at IS NULL) AS defective_part, (SELECT string_agg(dp.part_number, ', ' ORDER BY dp.created_at) FROM cm_case_defective_parts dp WHERE dp.case_id = c.id AND dp.issued_at IS NULL) AS defective_part_number, (SELECT string_agg(dp.condition, ', ' ORDER BY dp.created_at) FROM cm_case_defective_parts dp WHERE dp.case_id = c.id AND dp.issued_at IS NULL) AS defective_part_condition, (SELECT EXISTS(SELECT 1 FROM cm_case_notes n WHERE n.case_id = c.id AND n.note_type = 'Repair' AND n.body LIKE '[Repair Successful]%')) AS has_repair_success`;
    const conditions = [];
    const params = [];
    let idx = 1;
    const fromClause = 'cm_cases c LEFT JOIN cm_case_logistics cl ON cl.case_id = c.id LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id LEFT JOIN cm_case_depot_repair dr ON dr.case_id = c.id';

    if (team) {
      conditions.push(`c.owning_team_id = (SELECT id FROM teams WHERE key = $${idx})`);
      params.push(team);
      idx++;
    }

    if (workflow) {
      conditions.push(`c.workflow_key = $${idx}`);
      params.push(workflow);
      idx++;
    }

    if (customer) {
      conditions.push(`c.customer_name = $${idx}`);
      params.push(customer);
      idx++;
    }

    if (facility) {
      conditions.push(`c.facility = $${idx}`);
      params.push(facility);
      idx++;
    }

    if (manufacturer) {
      conditions.push(`r.manufacturer = $${idx}`);
      params.push(manufacturer);
      idx++;
    }

    if (model) {
      conditions.push(`r.model = $${idx}`);
      params.push(model);
      idx++;
    }

    if (modelName) {
      conditions.push(`r.model_name = $${idx}`);
      params.push(modelName);
      idx++;
    }

    if (defectivePart) {
      conditions.push(`EXISTS (SELECT 1 FROM cm_case_defective_parts dp WHERE dp.case_id = c.id AND dp.issued_at IS NULL AND dp.part_name = $${idx})`);
      params.push(defectivePart);
      idx++;
    }

    if (defectivePartNumber) {
      conditions.push(`EXISTS (SELECT 1 FROM cm_case_defective_parts dp WHERE dp.case_id = c.id AND dp.issued_at IS NULL AND dp.part_number = $${idx})`);
      params.push(defectivePartNumber);
      idx++;
    }

    if (createdBy) {
      conditions.push(`c.created_by_user_id = (SELECT id FROM users WHERE lower(upn) = lower($${idx}))`);
      params.push(createdBy);
      idx++;
    }

    if (assignedTo) {
      conditions.push(`c.assigned_to_user_id = (SELECT id FROM users WHERE lower(upn) = lower($${idx}))`);
      params.push(assignedTo);
      idx++;
    }

    if (activityBy) {
      conditions.push(`c.id IN (SELECT n.case_id FROM cm_case_notes n WHERE n.created_by_user_id = (SELECT id FROM users WHERE lower(upn) = lower($${idx})) ORDER BY n.created_at DESC LIMIT 200)`);
      params.push(activityBy);
      idx++;
    }

    if (stage) {
      const stages = stage.split(',').map(s => s.trim()).filter(Boolean);
      if (stages.length === 1) {
        conditions.push(`c.stage = $${idx}`);
        params.push(stages[0]);
        idx++;
      } else {
        conditions.push(`c.stage = ANY($${idx})`);
        params.push(stages);
        idx++;
      }
    }

    if (status) {
      conditions.push(`c.status = $${idx}`);
      params.push(status);
      idx++;
    }

    if (hasRepairSuccess) {
      conditions.push(`EXISTS (SELECT 1 FROM cm_case_notes n WHERE n.case_id = c.id AND n.note_type = 'Repair' AND n.body LIKE '[Repair Successful]%')`);
    }

    if (search) {
      conditions.push(`(c.case_number ILIKE $${idx} OR c.title ILIKE $${idx} OR c.customer_name ILIKE $${idx} OR c.facility ILIKE $${idx} OR r.serial_number ILIKE $${idx} OR r.asset_tag ILIKE $${idx} OR cl.pickup_resource ILIKE $${idx} OR cl.delivery_resource ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countFrom = search ? `cm_cases c LEFT JOIN cm_case_workflow_refresh r ON r.case_id = c.id LEFT JOIN cm_case_logistics cl ON cl.case_id = c.id LEFT JOIN cm_case_depot_repair dr ON dr.case_id = c.id` : 'cm_cases c';
    const countSql = `SELECT COUNT(*) as total FROM ${countFrom} ${where}`;

    const sortableColumns = { case_number: 'c.case_number', customer_name: 'c.customer_name', facility: 'c.facility', stage: 'c.stage', status: 'c.status', priority: 'c.priority', last_activity_at: 'c.last_activity_at::timestamptz', created_at: 'c.created_at::timestamptz', workflow_key: 'c.workflow_key', owning_team_id: 'c.owning_team_id', assigned_to_user_id: 'c.assigned_to_user_id', manufacturer: 'r.manufacturer', model: 'r.model', model_name: 'r.model_name', scheduled_date: 'COALESCE(cl.scheduled_delivery_date, cl.scheduled_pickup_date)', resource: 'COALESCE(cl.delivery_resource, cl.pickup_resource)', defective_part: "(SELECT string_agg(dp.part_name, ', ' ORDER BY dp.created_at) FROM cm_case_defective_parts dp WHERE dp.case_id = c.id AND dp.issued_at IS NULL)", defective_part_number: "(SELECT string_agg(dp.part_number, ', ' ORDER BY dp.created_at) FROM cm_case_defective_parts dp WHERE dp.case_id = c.id AND dp.issued_at IS NULL)" };
    const sortBy = sortableColumns[searchParams.get('sort_by')] || 'c.last_activity_at';
    const sortDir = searchParams.get('sort_dir') === 'asc' ? 'ASC' : 'DESC';
    let dataSql;
    if (limit === 0) {
      dataSql = `SELECT ${cols} FROM ${fromClause} ${where} ORDER BY ${sortBy} ${sortDir}`;
    } else {
      dataSql = `SELECT ${cols} FROM ${fromClause} ${where} ORDER BY ${sortBy} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`;
      params.push(limit, offset);
    }

    const [countResult, rows] = await Promise.all([
      query(countSql, params.slice(0, limit === 0 ? undefined : -2)),
      query(dataSql, params),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);
    return Response.json({ data: rows, total, page, limit: limit || total, pages: limit ? Math.ceil(total / limit) : 1 });
  } catch (err) {
    if (err.unauthorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.digest?.startsWith('DYNAMIC_SERVER_USAGE')) throw err;
    return Response.json({ error: 'Unable to retrieve cases data' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;

    const user = await requireTeamAccess(INTAKE_TEAM_KEY, request);

    const body = await request.json();
    const {
      workflow_key,
      customer_name,
      requester_name,
      requester_email,
      requester_phone,
      poc_name,
      poc_email,
      poc_phone,
      poc_address,
      request_source,
      priority = 'Normal',
      facility,
      assigned_to_username,
      program,
      rma,
    } = body;

    // Validate required fields
    if (!workflow_key?.trim()) return Response.json({ error: 'workflow_key is required' }, { status: 422 });
    if (!customer_name?.trim()) return Response.json({ error: 'customer_name is required' }, { status: 422 });
    if (!requester_name?.trim()) return Response.json({ error: 'requester_name is required' }, { status: 422 });
    if (!requester_email?.trim()) return Response.json({ error: 'requester_email is required' }, { status: 422 });
    if (!request_source || !REQUEST_SOURCES.includes(request_source)) {
      return Response.json({ error: `request_source must be one of: ${REQUEST_SOURCES.join(', ')}` }, { status: 422 });
    }
    if (!PRIORITIES.includes(priority)) {
      return Response.json({ error: `priority must be one of: ${PRIORITIES.join(', ')}` }, { status: 422 });
    }

    const wk = workflow_key.trim().toLowerCase();

    // Validate workflow exists and is enabled
    const [workflow] = await query(
      `SELECT workflow_key, label, owning_team_id, assignment_team_id FROM cm_workflows WHERE lower(workflow_key) = $1 AND is_enabled = 1`,
      [wk]
    );
    if (!workflow) return Response.json({ error: 'Workflow is not enabled' }, { status: 400 });

    // Validate customer is in catalog
    const [customer] = await query(
      `SELECT id FROM cm_customer_catalog WHERE lower(name) = lower($1) AND validation_status = 'approved'`,
      [customer_name.trim()]
    );
    if (!customer) {
      return Response.json({ error: 'customer_name must be selected from the customer catalog' }, { status: 422 });
    }

    // RMA-specific validation
    if (wk === 'rma') {
      if (!rma) return Response.json({ error: 'rma details are required for RMA workflow' }, { status: 422 });
      if (!rma.manufacturer?.trim()) return Response.json({ error: 'manufacturer is required' }, { status: 422 });

      const [mfr] = await query(
        `SELECT id FROM cm_rma_manufacturers WHERE lower(name) = lower($1) AND validation_status = 'approved'`,
        [rma.manufacturer.trim()]
      );
      if (!mfr) {
        return Response.json({ error: 'manufacturer must be selected from the RMA manufacturer catalog' }, { status: 422 });
      }
    }

    // Refresh-specific validation
    const refresh = body.refresh;
    if (wk === 'refresh') {
      if (!refresh) return Response.json({ error: 'refresh details are required for Refresh workflow' }, { status: 422 });
      if (!refresh.manufacturer?.trim()) return Response.json({ error: 'manufacturer is required' }, { status: 422 });
      if (!refresh.device_type?.trim()) return Response.json({ error: 'device_type is required' }, { status: 422 });
      if (!refresh.serial_number?.trim()) return Response.json({ error: 'serial_number is required' }, { status: 422 });
      if (!refresh.issue_description?.trim()) return Response.json({ error: 'issue_description is required' }, { status: 422 });
    }

    // Resolve assigned user if provided
    let assignedToUserId = null;
    if (assigned_to_username?.trim()) {
      const [assignee] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [assigned_to_username.trim()]);
      if (!assignee) return Response.json({ error: 'Assigned user not found' }, { status: 422 });
      assignedToUserId = assignee.id;
    }

    // Resolve creating user
    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    const creatorId = creator?.id || null;

    const caseId = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await withTransaction(async (client) => {
      // Generate case number from sequence
      const seqResult = await client.query(`INSERT INTO cm_case_number_seq DEFAULT VALUES RETURNING id`);
      const seq = seqResult.rows[0].id;
      const prefix = wk.replace(/[^a-z0-9]/g, '').toUpperCase() || 'CASE';
      const caseNumber = `${prefix}-${String(seq).padStart(6, '0')}`;

      // For RMA/Refresh workflow, title = case_number
      const caseTitle = (wk === 'rma' || wk === 'refresh') ? caseNumber : (body.title?.trim() || caseNumber);

      // Determine owning team — use assignment team if configured
      const owningTeamId = workflow.assignment_team_id || workflow.owning_team_id;

      await client.query(
        `INSERT INTO cm_cases (
          id, case_number, title, description,
          customer_name, facility, requester_name, requester_email, requester_phone,
          poc_name, poc_email, poc_phone, poc_address,
          request_source, workflow_key, owning_team_id,
          created_by_user_id, assigned_to_user_id,
          stage, status, priority,
          last_activity_at, created_at, updated_at, hisd_exception, program
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18,
          $19, $20, $21,
          $22, $23, $24, $25, $26
        )`,
        [
          caseId, caseNumber, caseTitle, body.description?.trim() || null,
          customer_name.trim(), facility?.trim() || null, requester_name.trim(), requester_email.trim().replace(/^mailto:/i, ''), requester_phone?.trim() || null,
          poc_name?.trim() || null, poc_email?.trim()?.replace(/^mailto:/i, '') || null, poc_phone?.trim() || null, poc_address?.trim() || null,
          request_source, wk, owningTeamId,
          creatorId, assignedToUserId,
          wk === 'refresh' ? 'Ready for Pickup' : 'Intake', 'Active', priority,
          now, now, now, 0, program?.trim() || null,
        ]
      );

      // Insert RMA workflow details
      if (wk === 'rma' && rma) {
        await client.query(
          `INSERT INTO cm_case_workflow_rma (
            case_id, manufacturer, product_id, serial_number, mac_address,
            issue_description, unserialized_no_mac_product,
            entitlement_status, proof_of_purchase_required, return_required
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            caseId,
            rma.manufacturer.trim(),
            rma.product_id?.trim() || null,
            rma.serial_number?.trim() || null,
            rma.mac_address?.trim() || null,
            rma.issue_description?.trim() || null,
            rma.unserialized_no_mac_product ? 1 : 0,
            'Pending', 0, 0,
          ]
        );
      }

      // Insert Refresh workflow details
      if (wk === 'refresh' && refresh) {
        await client.query(
          `INSERT INTO cm_case_workflow_refresh (
            case_id, manufacturer, device_type, serial_number, asset_tag, model, model_name, warranty_end, adp, issue_description, damage_excuse
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            caseId,
            refresh.manufacturer.trim(),
            refresh.device_type.trim(),
            refresh.serial_number?.trim() || null,
            refresh.asset_tag?.trim() || null,
            refresh.model?.trim() || null,
            refresh.model_name?.trim() || null,
            refresh.warranty_end?.trim() || null,
            refresh.adp?.trim() || null,
            refresh.issue_description?.trim() || null,
            refresh.damage_excuse?.trim() || null,
          ]
        );
      }

      // Add system note
      await client.query(
        `INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at)
         VALUES ($1, $2, 'SystemEvent', 'Case created.', $3, $4)`,
        [crypto.randomUUID(), caseId, creatorId, now]
      );

      return { caseNumber, owningTeamId };
    });

    return Response.json({
      ok: true,
      id: caseId,
      case_number: result.caseNumber,
      workflow_key: wk,
      stage: wk === 'refresh' ? 'Ready for Pickup' : 'Intake',
      owning_team_id: result.owningTeamId,
      assigned_to_user_id: assignedToUserId,
    }, { status: 201 });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.forbidden) return Response.json({ error: 'Not permitted to create cases (intake administrators only)' }, { status: 403 });
    if (err.digest?.startsWith('DYNAMIC_SERVER_USAGE')) throw err;
    console.error('[api/cases POST] ERROR:', err.stack || err.message);
    return Response.json({ error: err.message || 'Case creation failed' }, { status: 500 });
  }
}
