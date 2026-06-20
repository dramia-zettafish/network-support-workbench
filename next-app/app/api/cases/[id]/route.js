// Single case query + delete endpoint.
// Source table: cm_cases

import { query } from '@/lib/db.js';
import { mutate, withTransaction } from '@/lib/db-write.js';
import { validateTableName } from '@/lib/db-read-queries.js';
import { requireAuth, requireRole } from '@/lib/auth';
import { requireWriteEnabled } from '@/lib/write-safety';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const CASES_TABLE = 'cm_cases';

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
    validateTableName(CASES_TABLE);

    const { id } = await params;

    const sql = `SELECT id, case_number, title, description, customer_name, requester_name, requester_email, requester_phone, request_source, workflow_key, stage, status, priority, last_activity_at, created_at, updated_at, closed_at, facility, poc_name, poc_email, poc_phone, poc_address, owning_team_id, assigned_to_user_id, created_by_user_id, program FROM cm_cases WHERE id = $1`;

    const rows = await query(sql, [id]);

    if (!rows || rows.length === 0) {
      return Response.json({ error: 'Case not found' }, { status: 404 });
    }

    return Response.json({ data: rows[0] });
  } catch (err) {
    return Response.json({ error: 'Unable to retrieve case data' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;

    const user = await requireRole('manager', request);
    const { id } = await params;

    const rows = await query(`SELECT id FROM cm_cases WHERE id = $1`, [id]);
    if (!rows.length) return Response.json({ error: 'Case not found' }, { status: 404 });

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM cm_case_notes WHERE case_id = $1`, [id]);
      await client.query(`DELETE FROM cm_case_workflow_rma WHERE case_id = $1`, [id]);
      await client.query(`DELETE FROM cm_case_workflow_refresh WHERE case_id = $1`, [id]);
      await client.query(`DELETE FROM cm_case_logistics WHERE case_id = $1`, [id]);
      await client.query(`DELETE FROM cm_case_logistics_failures WHERE case_id = $1`, [id]);
      await client.query(`DELETE FROM cm_case_requirements WHERE case_id = $1`, [id]);
      await client.query(`DELETE FROM cm_case_reminders WHERE case_id = $1`, [id]);
      await client.query(`DELETE FROM cm_cases WHERE id = $1`, [id]);
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.forbidden) return Response.json({ error: 'Manager role required' }, { status: 403 });
    console.error('[api/cases/[id] DELETE] ERROR:', err.stack || err.message);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    const user = await requireRole(['supervisor', 'manager'], request);
    const { id } = await params;
    const body = await request.json();

    // Allowed cm_cases fields
    const CASE_FIELDS = ['title', 'description', 'customer_name', 'facility', 'requester_name', 'requester_email', 'requester_phone', 'poc_name', 'poc_email', 'poc_phone', 'poc_address', 'request_source', 'priority', 'program', 'closed_at'];
    // Allowed refresh workflow fields
    const REFRESH_FIELDS = ['manufacturer', 'device_type', 'serial_number', 'asset_tag', 'model', 'model_name', 'warranty_end', 'adp', 'issue_description', 'damage_excuse'];
    // Allowed RMA workflow fields
    const RMA_FIELDS = ['manufacturer', 'product_id', 'serial_number', 'mac_address', 'issue_description'];

    // Fetch old values for audit logging
    const [oldCase] = await query(`SELECT * FROM cm_cases WHERE id = $1`, [id]);
    const [oldRefresh] = await query(`SELECT * FROM cm_case_workflow_refresh WHERE case_id = $1`, [id]);
    const [oldRma] = await query(`SELECT * FROM cm_case_workflow_rma WHERE case_id = $1`, [id]);

    const caseUpdates = [];
    const caseValues = [];
    let idx = 1;
    for (const key of CASE_FIELDS) {
      if (key in body) {
        caseUpdates.push(`${key} = $${idx}`);
        caseValues.push(body[key] || null);
        idx++;
      }
    }

    // Handle assigned_to_username -> assigned_to_user_id
    if ('assigned_to_username' in body) {
      if (body.assigned_to_username?.trim()) {
        const [assignee] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [body.assigned_to_username.trim()]);
        if (!assignee) return Response.json({ error: 'Assigned user not found' }, { status: 422 });
        caseUpdates.push(`assigned_to_user_id = $${idx}`);
        caseValues.push(assignee.id);
        idx++;
      } else {
        caseUpdates.push(`assigned_to_user_id = $${idx}`);
        caseValues.push(null);
        idx++;
      }
    }

    if (caseUpdates.length) {
      caseUpdates.push(`updated_at = $${idx}`);
      caseValues.push(new Date().toISOString());
      idx++;
      caseValues.push(id);
      await mutate(`UPDATE cm_cases SET ${caseUpdates.join(', ')} WHERE id = $${idx}`, caseValues);
    }

    // Update refresh workflow fields
    const refreshUpdates = [];
    const refreshValues = [];
    let ridx = 1;
    for (const key of REFRESH_FIELDS) {
      if (`refresh_${key}` in body) {
        refreshUpdates.push(`${key} = $${ridx}`);
        refreshValues.push(body[`refresh_${key}`] || null);
        ridx++;
      }
    }
    if (refreshUpdates.length) {
      refreshValues.push(id);
      await mutate(`UPDATE cm_case_workflow_refresh SET ${refreshUpdates.join(', ')} WHERE case_id = $${ridx}`, refreshValues);
    }

    // Update RMA workflow fields
    const rmaUpdates = [];
    const rmaValues = [];
    let rmaidx = 1;
    for (const key of RMA_FIELDS) {
      if (`rma_${key}` in body) {
        rmaUpdates.push(`${key} = $${rmaidx}`);
        rmaValues.push(body[`rma_${key}`] || null);
        rmaidx++;
      }
    }
    if (rmaUpdates.length) {
      rmaValues.push(id);
      await mutate(`UPDATE cm_case_workflow_rma SET ${rmaUpdates.join(', ')} WHERE case_id = $${rmaidx}`, rmaValues);
    }

    // Log field update notes with old/new values
    const [editor] = await query(`SELECT id FROM users WHERE lower(upn) = lower($1)`, [user.username]);
    const changedFields = [];
    for (const k of CASE_FIELDS) {
      if (k in body && (body[k] || '') !== (oldCase?.[k] || '')) changedFields.push([k.replace(/_/g, ' '), oldCase?.[k] || '(blank)', body[k] || '(blank)']);
    }
    if ('assigned_to_username' in body) {
      const oldUser = usersList?.find?.(u => u.id === oldCase?.assigned_to_user_id);
      changedFields.push(['assigned to', oldUser?.upn || '(blank)', body.assigned_to_username || '(blank)']);
    }
    for (const k of REFRESH_FIELDS) {
      if (`refresh_${k}` in body && (body[`refresh_${k}`] || '') !== (oldRefresh?.[k] || '')) changedFields.push([k.replace(/_/g, ' '), oldRefresh?.[k] || '(blank)', body[`refresh_${k}`] || '(blank)']);
    }
    for (const k of RMA_FIELDS) {
      if (`rma_${k}` in body && (body[`rma_${k}`] || '') !== (oldRma?.[k] || '')) changedFields.push([k.replace(/_/g, ' '), oldRma?.[k] || '(blank)', body[`rma_${k}`] || '(blank)']);
    }
    for (const [field, oldVal, newVal] of changedFields) {
      const noteBody = `${field} changed from "${oldVal}" to "${newVal}" by user: ${user.username}`;
      await mutate(`INSERT INTO cm_case_notes (id, case_id, note_type, body, created_by_user_id, created_at) VALUES ($1, $2, 'Field Update', $3, $4, CURRENT_TIMESTAMP)`, [crypto.randomUUID(), id, noteBody, editor?.id || null]);
    }

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (err.forbidden) return Response.json({ error: 'Supervisor or Manager role required' }, { status: 403 });
    console.error('[api/cases/[id] PATCH] ERROR:', err.stack || err.message);
    return Response.json({ error: 'Update failed' }, { status: 500 });
  }
}
