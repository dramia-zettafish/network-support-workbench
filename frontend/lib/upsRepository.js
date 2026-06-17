import { query, transaction } from './db';
import { optionalEnum, optionalString, rejectUnknownFields, requiredEnum, requiredInteger, requiredString, validationError } from './serverValidation';

export const upsStatuses = ['intake', 'servicing', 'scheduled', 'confirm_ip', 'fulfilled'];
const scheduleDays = ['mon', 'tue', 'wed', 'thu'];

const upsColumnNames = [
  'ups_installation_id',
  'ticket_number',
  'external_ticket_number',
  'school_name',
  'tea_code',
  'created_date',
  'status',
  'serial_number',
  'defective_battery_pack_serial',
  'idf',
  'asset_tag',
  'new_serial_number',
  'new_webcard_serial',
  'new_asset_tag',
  'mac_address',
  'new_mac_address',
  'hostname',
  'new_battery_pack_asset_tag',
  'new_battery_pack_serial',
  'model',
  'room_number',
  'installed_date',
  'installed_by',
  'notes',
  'snmp_ip',
  'previous_snmp_ip',
  'battery_pack_1_asset_tag',
  'ups_po',
  'bp_po',
  'proposed_install_date',
  'approved_install_date',
  'install_contact',
  'install_contact_number',
  'ip_response_email_body',
  'ip_response_email_created_at',
  'ip_response_email_confirmed_at'
];

const upsColumns = upsColumnNames.join(',\n  ');

const qualifiedUpsColumns = `
  ${upsColumnNames.map((column) => `ups.${column}`).join(',\n  ')}
`;

const updateFields = [
  'status',
  'serial_number',
  'defective_battery_pack_serial',
  'idf',
  'asset_tag',
  'new_serial_number',
  'new_webcard_serial',
  'new_asset_tag',
  'mac_address',
  'new_mac_address',
  'hostname',
  'new_battery_pack_asset_tag',
  'new_battery_pack_serial',
  'model',
  'room_number',
  'installed_date',
  'installed_by',
  'notes',
  'snmp_ip',
  'previous_snmp_ip',
  'battery_pack_1_asset_tag',
  'ups_po',
  'bp_po',
  'proposed_install_date',
  'approved_install_date',
  'install_contact',
  'install_contact_number',
  'ip_response_email_body',
  'ip_response_email_created_at',
  'ip_response_email_confirmed_at'
];

const fieldMaxLengths = {
  serial_number: 100,
  defective_battery_pack_serial: 100,
  idf: 100,
  asset_tag: 100,
  new_serial_number: 100,
  new_webcard_serial: 100,
  new_asset_tag: 100,
  mac_address: 32,
  new_mac_address: 32,
  hostname: 100,
  new_battery_pack_asset_tag: 100,
  new_battery_pack_serial: 100,
  model: 100,
  room_number: 50,
  installed_by: 100,
  notes: 1000,
  snmp_ip: 100,
  previous_snmp_ip: 100,
  battery_pack_1_asset_tag: 100,
  ups_po: 100,
  bp_po: 100,
  install_contact: 255,
  install_contact_number: 20
};

const activeUpsStatuses = ['intake', 'scheduled', 'servicing', 'confirm_ip'];

export async function listUpsInstallations({ status, search, limit, offset }) {
  const where = [];
  const params = [];

  if (status) {
    where.push(`ups.status = $${params.length + 1}`);
    params.push(requiredEnum(status, 'status', upsStatuses));

    if (activeUpsStatuses.includes(status)) {
      where.push(`(ticket.ticket_number IS NULL OR ticket.status <> 'on_hold')`);
    }
  }

  if (search) {
    params.push(`%${optionalString(search, 'search', 100)}%`);
    where.push(`
      CONCAT_WS(' ',
        ups.ticket_number::text,
        ups.external_ticket_number,
        ups.school_name,
        ups.tea_code::text,
        ups.created_date,
        ups.status::text,
        ups.serial_number,
        ups.defective_battery_pack_serial,
        ups.idf,
        ups.asset_tag,
        ups.new_serial_number,
        ups.new_webcard_serial,
        ups.new_asset_tag,
        ups.mac_address,
        ups.new_mac_address,
        ups.hostname,
        ups.new_battery_pack_asset_tag,
        ups.new_battery_pack_serial,
        ups.model,
        ups.room_number,
        ups.installed_date,
        ups.installed_by,
        ups.notes,
        ups.snmp_ip,
        ups.previous_snmp_ip,
        ups.battery_pack_1_asset_tag,
        ups.ups_po,
        ups.bp_po,
        ups.proposed_install_date,
        ups.approved_install_date,
        ups.install_contact,
        ups.install_contact_number,
        ups.ip_response_email_body
      ) ILIKE $${params.length}
    `);
  }

  params.push(limit, offset);
  const result = await query(
    `
      SELECT ${qualifiedUpsColumns}
      FROM ups_installations ups
      LEFT JOIN tickets ticket ON ticket.ticket_number = ups.ticket_number
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ups.ups_installation_id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return result.rows;
}

export async function updateUpsInstallation(upsInstallationId, payload, allowedFields = updateFields) {
  const normalized = validateUpsUpdate(payload, allowedFields);
  return updateUpsById(upsInstallationId, normalized);
}

export async function createUpsInstallation(payload, allowedFields = updateFields) {
  const normalized = validateUpsCreate(payload, allowedFields);
  const fields = Object.keys(normalized);
  const values = Object.values(normalized);

  const result = await query(
    `
      INSERT INTO ups_installations (${fields.join(', ')})
      VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})
      RETURNING ${upsColumns}
    `,
    values
  );

  return result.rows[0];
}

export async function rollbackUpsInstallation(upsInstallationId) {
  const result = await query(
    `
      UPDATE ups_installations
      SET status = 'intake', proposed_install_date = NULL
      WHERE ups_installation_id = $1
      RETURNING ${upsColumns}
    `,
    [upsInstallationId]
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error('UPS installation not found'), { status: 404 });
  }

  return result.rows[0];
}

export async function scheduleUpsInstallations(payload) {
  const ids = Array.isArray(payload.ups_installation_ids)
    ? payload.ups_installation_ids.map((id) => requiredInteger(id, 'ups_installation_id'))
    : [];
  const day = requiredEnum(payload.day, 'day', scheduleDays);

  if (ids.length === 0) {
    throw Object.assign(new Error('ups_installation_ids is required'), { status: 400 });
  }

  const proposedInstallDate = resolveNextWeekday(day);
  const rows = await updateScheduleRows(ids.map((id) => ({ ups_installation_id: id, proposed_install_date: proposedInstallDate })));

  return {
    proposed_install_date: proposedInstallDate,
    rows: sortScheduleRowsByDate(rows)
  };
}

export async function scheduleUpsInstallationsWithDates(payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rows.length === 0) {
    throw Object.assign(new Error('rows is required'), { status: 400 });
  }

  const normalizedRows = rows.map((row) => ({
    ups_installation_id: requiredInteger(row.ups_installation_id, 'ups_installation_id'),
    proposed_install_date: requiredString(row.proposed_install_date, 'proposed_install_date')
  }));

  return {
    proposed_install_date: '',
    rows: sortScheduleRowsByDate(await updateScheduleRows(normalizedRows))
  };
}

function updateScheduleRows(rows) {
  return transaction(async (client) => {
    const ids = rows.map((row) => row.ups_installation_id);
    const installResult = await client.query(
      `SELECT ${upsColumns} FROM ups_installations WHERE ups_installation_id = ANY($1::int[])`,
      [ids]
    );

    if (installResult.rows.length !== new Set(ids).size) {
      throw Object.assign(new Error('One or more UPS installations were not found'), { status: 404 });
    }

    const installsById = new Map(installResult.rows.map((install) => [install.ups_installation_id, install]));
    const responseRows = [];

    for (const row of rows) {
      const updateResult = await client.query(
        `
          UPDATE ups_installations
          SET proposed_install_date = $1, status = 'scheduled'
          WHERE ups_installation_id = $2
          RETURNING ${upsColumns}
        `,
        [row.proposed_install_date, row.ups_installation_id]
      );
      responseRows.push(buildScheduleRow({ ...installsById.get(row.ups_installation_id), ...updateResult.rows[0] }));
    }

    return responseRows;
  });
}

async function updateUpsById(upsInstallationId, updates) {
  if (Object.keys(updates).length === 0) {
    return getUpsOrThrow(upsInstallationId);
  }

  if (updates.status === 'fulfilled') {
    const current = await getUpsOrThrow(upsInstallationId);
    const hasConfirmedIpResponse = Boolean(updates.ip_response_email_confirmed_at || current.ip_response_email_confirmed_at);
    if (!hasConfirmedIpResponse) {
      throw validationError('UPS IP response email must be confirmed before completion');
    }
    if (current.status !== 'confirm_ip' && current.status !== 'fulfilled') {
      throw validationError('UPS must be in Confirm IP before completion');
    }
  }

  const assignments = [];
  const params = [];
  Object.entries(updates).forEach(([field, value]) => {
    params.push(value);
    assignments.push(`${field} = $${params.length}`);
  });
  params.push(upsInstallationId);

  const result = await query(
    `
      UPDATE ups_installations
      SET ${assignments.join(', ')}
      WHERE ups_installation_id = $${params.length}
      RETURNING ${upsColumns}
    `,
    params
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error('UPS installation not found'), { status: 404 });
  }

  return result.rows[0];
}

async function getUpsOrThrow(upsInstallationId) {
  const result = await query(
    `SELECT ${upsColumns} FROM ups_installations WHERE ups_installation_id = $1`,
    [upsInstallationId]
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('UPS installation not found'), { status: 404 });
  }
  return result.rows[0];
}

function validateUpsUpdate(payload, allowedFields) {
  rejectUnknownFields(payload, allowedFields);
  const updates = {};

  allowedFields.forEach((field) => {
    if (payload[field] === undefined) return;

    if (field === 'status') {
      updates[field] = optionalEnum(payload[field], field, upsStatuses);
      return;
    }

    updates[field] = optionalString(payload[field], field, fieldMaxLengths[field]);
  });

  return updates;
}

function validateUpsCreate(payload, allowedFields) {
  const createFields = [
    'ticket_number',
    'external_ticket_number',
    'school_name',
    'tea_code',
    'created_date',
    ...allowedFields
  ];
  rejectUnknownFields(payload, createFields);

  const updatePayload = {};
  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) updatePayload[field] = payload[field];
  });
  const updates = validateUpsUpdate(updatePayload, allowedFields);

  return {
    ticket_number: requiredInteger(payload.ticket_number, 'ticket_number'),
    external_ticket_number: optionalString(payload.external_ticket_number, 'external_ticket_number', 8),
    school_name: requiredString(payload.school_name, 'school_name', 255),
    tea_code: requiredInteger(payload.tea_code, 'tea_code', { min: 0, max: 999 }),
    created_date: requiredString(payload.created_date, 'created_date'),
    status: updates.status || 'intake',
    ...updates
  };
}

export function buildScheduleRow(ups) {
  return {
    ups_installation_id: ups.ups_installation_id,
    ticket_number: String(ups.external_ticket_number || ups.ticket_number),
    idf: ups.idf,
    school_name: ups.school_name,
    install_contact: '',
    install_contact_number: '',
    proposed_install_date: ups.proposed_install_date || '',
    type: 'Replace',
    equipment: deriveUpsEquipment(ups)
  };
}

export function deriveUpsEquipment(ups) {
  const batteryPackCount = [
    Boolean(ups.defective_battery_pack_serial || ups.battery_pack_1_asset_tag),
    Boolean(ups.new_battery_pack_serial || ups.new_battery_pack_asset_tag)
  ].filter(Boolean).length;

  if (batteryPackCount === 0) return 'UPS';
  return `UPS, ${batteryPackCount} BP`;
}

function sortScheduleRowsByDate(rows) {
  return [...rows].sort((left, right) => {
    const dateComparison = String(left.proposed_install_date || '').localeCompare(String(right.proposed_install_date || ''));
    if (dateComparison !== 0) return dateComparison;

    const schoolComparison = String(left.school_name || '').localeCompare(String(right.school_name || ''));
    if (schoolComparison !== 0) return schoolComparison;

    return String(left.ticket_number || '').localeCompare(String(right.ticket_number || ''));
  });
}

function resolveNextWeekday(day) {
  const weekdayMap = { mon: 0, tue: 1, wed: 2, thu: 3 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekday = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + (7 - currentWeekday));
  nextMonday.setDate(nextMonday.getDate() + weekdayMap[day]);
  return toDateKey(nextMonday);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
