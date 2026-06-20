import { requireAuth, requireTeamAccess } from '@/lib/auth';
import { requireWriteEnabled } from '@/lib/write-safety';
import { query } from '@/lib/db.js';
import { withTransaction } from '@/lib/db-write.js';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const INTAKE_TEAM_KEY = 'intake_administrators';

function parseExcelDate(v) {
  if (!v) return null;
  const s = v.toString().trim();
  if (!s) return null;
  if (/^\d{4,5}$/.test(s)) {
    const d = new Date((parseInt(s, 10) - 25569) * 86400000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  }
  return s;
}

const COMMON_COLS = ['customer_name', 'requester_name', 'requester_email', 'requester_phone', 'request_source', 'priority', 'facility'];
const POC_COLS = ['poc_name', 'poc_email', 'poc_phone', 'poc_address'];
const RMA_COLS = ['manufacturer', 'product_id', 'serial_number', 'mac_address', 'issue_description'];
const REFRESH_COLS = ['program', 'manufacturer', 'device_type', 'serial_number', 'asset_tag', 'model', 'model_name', 'issue_description', 'damage_excuse', 'warranty_end', 'adp'];

export async function GET(request) {
  try {
    await requireTeamAccess(INTAKE_TEAM_KEY, request);
    const { searchParams } = new URL(request.url);
    const wk = searchParams.get('workflow') || 'refresh';

    const cols = [...COMMON_COLS, ...(wk === 'rma' ? [...POC_COLS, ...RMA_COLS] : REFRESH_COLS)];
    const ws = XLSX.utils.aoa_to_sheet([cols]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bulk-import-template-${wk}.xlsx"`,
      },
    });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.forbidden) return Response.json({ error: 'Not permitted' }, { status: 403 });
    return Response.json({ error: 'Template generation failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireTeamAccess(INTAKE_TEAM_KEY, request);

    const formData = await request.formData();
    const file = formData.get('file');
    const wk = formData.get('workflow') || 'refresh';

    if (!file) return Response.json({ error: 'No file uploaded' }, { status: 422 });

    const arrayBuf = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return Response.json({ error: 'No data rows found' }, { status: 422 });

    // Validate workflow
    const [workflow] = await query(`SELECT workflow_key, owning_team_id, assignment_team_id FROM cm_workflows WHERE lower(workflow_key) = lower($1) AND is_enabled = 1`, [wk]);
    if (!workflow) return Response.json({ error: 'Workflow not enabled' }, { status: 400 });

    const [creator] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    const creatorId = creator?.id || null;
    const owningTeamId = workflow.assignment_team_id || workflow.owning_team_id;
    const now = new Date().toISOString();
    const created = [];
    const errors = [];

    await withTransaction(async (client) => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.customer_name?.toString().trim() || !r.requester_name?.toString().trim() || !r.requester_email?.toString().trim()) {
          errors.push(`Row ${i + 2}: missing required field (customer_name, requester_name, or requester_email)`);
          continue;
        }

        const caseId = crypto.randomUUID();
        const seqResult = await client.query(`INSERT INTO cm_case_number_seq DEFAULT VALUES RETURNING id`);
        const seq = seqResult.rows[0].id;
        const prefix = wk.toUpperCase();
        const caseNumber = `${prefix}-${String(seq).padStart(6, '0')}`;

        await client.query(
          `INSERT INTO cm_cases (id, case_number, title, customer_name, facility, requester_name, requester_email, requester_phone, poc_name, poc_email, poc_phone, poc_address, request_source, workflow_key, owning_team_id, created_by_user_id, stage, status, priority, last_activity_at, created_at, updated_at, hisd_exception, program)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
          [caseId, caseNumber, caseNumber, r.customer_name.toString().trim(), r.facility?.toString().trim() || null,
           r.requester_name.toString().trim(), r.requester_email.toString().trim().replace(/^mailto:/i, ''), r.requester_phone?.toString().trim() || null,
           r.poc_name?.toString().trim() || null, r.poc_email?.toString().trim() || null, r.poc_phone?.toString().trim() || null, r.poc_address?.toString().trim() || null,
           r.request_source?.toString().trim() || 'Service Desk', wk, owningTeamId, creatorId,
           wk === 'refresh' ? 'Ready for Pickup' : 'Intake', 'Active', r.priority?.toString().trim() || 'Normal',
           now, now, now, 0, r.program?.toString().trim() || null]
        );

        if (wk === 'rma') {
          await client.query(
            `INSERT INTO cm_case_workflow_rma (case_id, manufacturer, product_id, serial_number, mac_address, issue_description, entitlement_status, proof_of_purchase_required, return_required) VALUES ($1,$2,$3,$4,$5,$6,'Pending',0,0)`,
            [caseId, r.manufacturer?.toString().trim() || null, r.product_id?.toString().trim() || null, r.serial_number?.toString().trim().toUpperCase() || null, r.mac_address?.toString().trim() || null, r.issue_description?.toString().trim() || null]
          );
        } else if (wk === 'refresh') {
          await client.query(
            `INSERT INTO cm_case_workflow_refresh (case_id, manufacturer, device_type, serial_number, asset_tag, model, model_name, issue_description, damage_excuse, warranty_end, adp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [caseId, r.manufacturer?.toString().trim() || null, r.device_type?.toString().trim() || null, r.serial_number?.toString().trim().toUpperCase() || null, r.asset_tag?.toString().trim() || null, r.model?.toString().trim() || null, r.model_name?.toString().trim() || null, r.issue_description?.toString().trim() || null, r.damage_excuse?.toString().trim() || null, parseExcelDate(r.warranty_end), r.adp?.toString().trim() || null]
          );
        }

        await client.query(
          `INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1,$2,'SystemEvent','Case created via bulk import.',$3,CURRENT_TIMESTAMP)`,
          [crypto.randomUUID(), caseId, creatorId]
        );

        created.push(caseNumber);
      }
    });

    return Response.json({ ok: true, created: created.length, case_numbers: created, errors });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.forbidden) return Response.json({ error: 'Not permitted' }, { status: 403 });
    console.error('[api/cases/bulk-import POST]', err.stack || err.message);
    return Response.json({ error: err.message || 'Bulk import failed' }, { status: 500 });
  }
}
