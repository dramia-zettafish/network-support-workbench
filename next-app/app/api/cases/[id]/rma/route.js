import { randomUUID } from 'node:crypto';
import { requireWriteEnabled, assertAllowedMethod, sanitizeWriteError } from '@/lib/write-safety';
import getPool from '@/lib/db.js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Hardcoded allowlist: form field name -> DB column name
const FIELD_MAP = {
  manufacturer: 'manufacturer',
  product_id: 'product_id',
  serial_number: 'serial_number',
  mac_address: 'mac_address',
  issue_description: 'issue_description',
  rma_status: 'rma_status',
  rma_number: 'rma_number',
  entitlement_status: 'entitlement_status',
  vendor_sr_number: 'vendor_sr_number',
  replacement_ship_to: 'replacement_ship_to',
  replacement_ship_date: 'replacement_ship_promised_at',
  inbound_shipping_carrier: 'inbound_shipping_carrier',
  inbound_tracking: 'inbound_tracking',
  outbound_shipping_carrier: 'outbound_shipping_carrier',
  outbound_tracking: 'outbound_tracking',
  return_required: 'return_required',
};

// Human-readable labels for audit notes
const FIELD_LABELS = {
  manufacturer: 'Manufacturer',
  product_id: 'Product ID',
  serial_number: 'Serial Number',
  mac_address: 'MAC Address',
  issue_description: 'Issue Description',
  rma_status: 'RMA Status',
  rma_number: 'RMA Number',
  entitlement_status: 'Entitlement Status',
  vendor_sr_number: 'Vendor SR Number',
  replacement_ship_to: 'Replacement Ship To',
  replacement_ship_date: 'Replacement Ship Date',
  inbound_shipping_carrier: 'Inbound Shipping Carrier',
  inbound_tracking: 'Inbound Tracking',
  outbound_shipping_carrier: 'Outbound Shipping Carrier',
  outbound_tracking: 'Outbound Tracking',
  return_required: 'Return Required',
};

const ALLOWED_FIELDS = Object.keys(FIELD_MAP);

// Fields that must not be blank/null (DB columns are NOT NULL)
const REQUIRED_FIELDS = ['manufacturer', 'product_id', 'issue_description', 'entitlement_status'];

// Conservative max lengths for text fields (no existing pattern found in codebase)
// Based on reasonable business limits for RMA workflow data
const MAX_LENGTHS = {
  manufacturer: 255,
  product_id: 255,
  serial_number: 255,
  mac_address: 64,
  issue_description: 4000,
  rma_status: 100,
  rma_number: 100,
  entitlement_status: 100,
  vendor_sr_number: 255,
  replacement_ship_to: 1000,
  inbound_shipping_carrier: 255,
  inbound_tracking: 255,
  outbound_shipping_carrier: 255,
  outbound_tracking: 255,
};

function displayValue(val) {
  if (val === null || val === undefined || val === '') return '(blank)';
  return String(val);
}

/**
 * Validates a YYYY-MM-DD date string.
 * Returns true if the string is a valid calendar date.
 */
function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Validates and normalizes all fields in the request body.
 * Returns { normalized, fieldErrors } where fieldErrors is empty on success.
 */
function validateAndNormalize(body) {
  const fieldErrors = {};
  const normalized = {};

  for (const [field, rawValue] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.includes(field)) continue;

    // Handle return_required separately (boolean/integer)
    if (field === 'return_required') {
      if (rawValue === true || rawValue === 1 || rawValue === '1') {
        normalized[field] = 1;
      } else if (rawValue === false || rawValue === 0 || rawValue === '0') {
        normalized[field] = 0;
      } else {
        fieldErrors[field] = 'Must be true or false';
      }
      continue;
    }

    // Handle replacement_ship_date separately (date validation)
    if (field === 'replacement_ship_date') {
      const trimmed = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      if (trimmed === '' || trimmed === null || trimmed === undefined) {
        normalized[field] = null;
      } else if (typeof trimmed === 'string' && isValidDate(trimmed)) {
        normalized[field] = trimmed;
      } else {
        fieldErrors[field] = 'Must be a valid date (YYYY-MM-DD) or blank';
      }
      continue;
    }

    // All other fields: trim strings, convert empty to null for nullable fields
    let value = rawValue;
    if (typeof value === 'string') {
      value = value.trim();
    }

    // Convert empty string to null for nullable text fields
    if (value === '' || value === null || value === undefined) {
      if (REQUIRED_FIELDS.includes(field)) {
        fieldErrors[field] = `${FIELD_LABELS[field]} is required`;
        continue;
      }
      normalized[field] = null;
      continue;
    }

    // Must be a string at this point
    if (typeof value !== 'string') {
      value = String(value);
    }

    // Max length check
    const maxLen = MAX_LENGTHS[field];
    if (maxLen && value.length > maxLen) {
      fieldErrors[field] = `Must be ${maxLen} characters or fewer`;
      continue;
    }

    normalized[field] = value;
  }

  return { normalized, fieldErrors };
}

/**
 * PATCH /api/cases/[id]/rma
 *
 * Updates allowed RMA fields for a given case. Gated by write-safety.
 * Validates and normalizes inputs, compares old/new values, updates only
 * changed fields, inserts audit notes, and refreshes case activity timestamps.
 */
export async function PATCH(req, { params }) {
  const methodCheck = assertAllowedMethod(req, ['PATCH']);
  if (methodCheck) return methodCheck;

  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  const { id } = await params;

  // Parse and validate request body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  // Reject unknown fields
  const unknownFields = Object.keys(body).filter((k) => !ALLOWED_FIELDS.includes(k));
  if (unknownFields.length > 0) {
    return NextResponse.json(
      { error: `Unknown fields: ${unknownFields.join(', ')}`, code: 'UNKNOWN_FIELDS', allowed: ALLOWED_FIELDS },
      { status: 400 }
    );
  }

  // Must have at least one field
  const entries = Object.entries(body).filter(([k]) => ALLOWED_FIELDS.includes(k));
  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'No valid fields provided', code: 'NO_FIELDS' },
      { status: 400 }
    );
  }

  // Validate and normalize
  const { normalized, fieldErrors } = validateAndNormalize(body);
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fieldErrors },
      { status: 400 }
    );
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Fetch current RMA row
    const currentResult = await client.query(
      'SELECT * FROM cm_case_workflow_rma WHERE case_id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No RMA record found for this case', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const currentRow = currentResult.rows[0];

    // Compare old vs new — only keep changed fields
    const changedFields = [];
    for (const [field, newValue] of Object.entries(normalized)) {
      const column = FIELD_MAP[field];
      const oldValue = currentRow[column];
      // Normalize comparison: treat null/undefined same as null
      const oldNorm = oldValue === null || oldValue === undefined ? null : String(oldValue);
      const newNorm = newValue === null ? null : String(newValue);
      if (oldNorm !== newNorm) {
        changedFields.push({ field, column, oldValue, newValue });
      }
    }

    if (changedFields.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ data: currentRow, changed: [], changedCount: 0, message: 'No changes detected' });
    }

    // Build parameterized UPDATE for changed fields only
    const setClauses = [];
    const values = [];
    let paramIdx = 1;

    for (const { column, newValue } of changedFields) {
      setClauses.push(`${column} = $${paramIdx}`);
      values.push(newValue);
      paramIdx++;
    }

    values.push(id);
    const updateSql = `UPDATE cm_case_workflow_rma SET ${setClauses.join(', ')} WHERE case_id = $${paramIdx} RETURNING *`;
    const updateResult = await client.query(updateSql, values);

    // Insert one Field Update note per changed field
    const actor = 'Next.js Migration';
    for (const { field, oldValue, newValue } of changedFields) {
      const label = FIELD_LABELS[field] || field;
      const noteBody = `${label} changed from "${displayValue(oldValue)}" to "${displayValue(newValue)}" by user: ${actor}`;
      await client.query(
        'INSERT INTO cm_case_notes (id, note_type, body, case_id, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [randomUUID(), 'Field Update', noteBody, id]
      );
    }

    // Refresh case activity timestamps
    await client.query(
      'UPDATE cm_cases SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      data: updateResult.rows[0],
      changed: changedFields.map((c) => c.field),
      changedCount: changedFields.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return sanitizeWriteError(error);
  } finally {
    client.release();
  }
}
