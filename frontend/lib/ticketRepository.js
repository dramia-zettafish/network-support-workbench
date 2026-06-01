import { query, transaction } from './db';
import { optionalEnum, optionalString, rejectUnknownFields, requiredEnum, requiredInteger, requiredString } from './serverValidation';

export const ticketStatuses = ['open', 'on_hold', 'closed'];
export const deviceTypes = ['switch', 'access_point', 'ups'];
export const responseResolutionTypes = ['permanent', 'temp_rma', 'no_replacement'];
export const responseStatuses = ['open', 'temp_placed', 'closed'];

const ticketColumns = `
  ticket_number,
  external_ticket_number,
  device_type,
  school_name,
  tea_code,
  mdf_idf,
  date,
  note,
  priority,
  status
`;

const responseColumns = `
  id,
  ticket_id,
  resolution_type,
  status,
  response_note,
  temp_response_note,
  rma_response_note,
  defective_model,
  defective_sn,
  defective_mac,
  defective_asset_tag,
  defective_room,
  replacement_model,
  replacement_sn,
  replacement_mac,
  replacement_hostname,
  replacement_ip,
  replacement_asset_tag,
  replacement_room,
  temp_model,
  temp_sn,
  temp_mac,
  temp_hostname,
  temp_ip,
  temp_asset_tag,
  temp_room,
  resolution_locked_at,
  created_at,
  updated_at
`;

const responseFields = [
  'resolution_type',
  'status',
  'response_note',
  'temp_response_note',
  'rma_response_note',
  'defective_model',
  'defective_sn',
  'defective_mac',
  'defective_asset_tag',
  'defective_room',
  'replacement_model',
  'replacement_sn',
  'replacement_mac',
  'replacement_hostname',
  'replacement_ip',
  'replacement_asset_tag',
  'replacement_room',
  'temp_model',
  'temp_sn',
  'temp_mac',
  'temp_hostname',
  'temp_ip',
  'temp_asset_tag',
  'temp_room'
];

const responseMaxLengths = {
  response_note: 2000,
  temp_response_note: 2000,
  rma_response_note: 2000,
  defective_model: 100,
  defective_sn: 100,
  defective_mac: 32,
  defective_asset_tag: 100,
  defective_room: 50,
  replacement_model: 100,
  replacement_sn: 100,
  replacement_mac: 32,
  replacement_hostname: 100,
  replacement_ip: 100,
  replacement_asset_tag: 100,
  replacement_room: 50,
  temp_model: 100,
  temp_sn: 100,
  temp_mac: 32,
  temp_hostname: 100,
  temp_ip: 100,
  temp_asset_tag: 100,
  temp_room: 50
};

export async function listTickets({ status, limit, offset }) {
  const where = [];
  const params = [];

  if (status) {
    where.push(`status = $${params.length + 1}`);
    params.push(requiredEnum(status, 'status', ticketStatuses));
  }

  params.push(limit, offset);

  const result = await query(
    `
      SELECT ${ticketColumns}
      FROM tickets
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ticket_number DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params
  );

  return result.rows;
}

export async function createTicket(payload) {
  const ticket = validateTicketCreate(payload);

  return transaction(async (client) => {
    const ticketResult = await client.query(
      `
        INSERT INTO tickets (
          external_ticket_number,
          device_type,
          school_name,
          tea_code,
          mdf_idf,
          date,
          note,
          priority,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
        RETURNING ${ticketColumns}
      `,
      [
        ticket.external_ticket_number,
        ticket.device_type,
        ticket.school_name,
        ticket.tea_code,
        ticket.mdf_idf,
        ticket.date,
        ticket.note,
        ticket.priority
      ]
    );

    const createdTicket = ticketResult.rows[0];

    if (createdTicket.device_type === 'ups') {
      await client.query(
        `
          INSERT INTO ups_installations (
            ticket_number,
            external_ticket_number,
            school_name,
            tea_code,
            idf,
            created_date,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'intake')
        `,
        [
          createdTicket.ticket_number,
          createdTicket.external_ticket_number,
          createdTicket.school_name,
          createdTicket.tea_code,
          createdTicket.mdf_idf,
          createdTicket.date
        ]
      );
    }

    return createdTicket;
  });
}

export async function updateTicket(ticketNumber, payload) {
  rejectUnknownFields(payload, ['note', 'status']);

  const updates = {};
  const note = optionalString(payload.note, 'note', 1000);
  const status = optionalEnum(payload.status, 'status', ticketStatuses);

  if (note !== undefined) updates.note = note;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return getTicketOrThrow(ticketNumber);
  }

  const assignments = [];
  const params = [];
  Object.entries(updates).forEach(([field, value]) => {
    params.push(value);
    assignments.push(`${field} = $${params.length}`);
  });
  params.push(ticketNumber);

  const result = await query(
    `
      UPDATE tickets
      SET ${assignments.join(', ')}
      WHERE ticket_number = $${params.length}
      RETURNING ${ticketColumns}
    `,
    params
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error('Ticket not found'), { status: 404 });
  }

  return result.rows[0];
}

export async function deleteTicket(ticketNumber) {
  return transaction(async (client) => {
    await client.query('DELETE FROM ups_installations WHERE ticket_number = $1', [ticketNumber]);
    const result = await client.query('DELETE FROM tickets WHERE ticket_number = $1 RETURNING ticket_number', [ticketNumber]);

    if (!result.rows[0]) {
      throw Object.assign(new Error('Ticket not found'), { status: 404 });
    }

    return { message: 'Ticket deleted' };
  });
}

export async function getTicketResponse(ticketNumber) {
  const result = await query(
    `SELECT ${responseColumns} FROM device_responses WHERE ticket_id = $1`,
    [ticketNumber]
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error('Ticket response not found'), { status: 404 });
  }

  return result.rows[0];
}

export async function createTicketResponse(ticketNumber, payload) {
  const response = validateResponsePayload(payload, { partial: false });

  return transaction(async (client) => {
    const ticket = await client.query('SELECT ticket_number FROM tickets WHERE ticket_number = $1', [ticketNumber]);
    if (!ticket.rows[0]) {
      throw Object.assign(new Error('Ticket not found'), { status: 404 });
    }

    const existing = await client.query('SELECT id FROM device_responses WHERE ticket_id = $1', [ticketNumber]);
    if (existing.rows[0]) {
      throw Object.assign(new Error('Ticket response already exists'), { status: 400 });
    }

    const fields = Object.keys(response);
    const values = Object.values(response);
    if (isLockingResponseStatus(response.status)) {
      fields.push('resolution_locked_at');
      values.push(new Date());
    }
    const params = [ticketNumber, ...values];

    const result = await client.query(
      `
        INSERT INTO device_responses (ticket_id, ${fields.join(', ')})
        VALUES ($1, ${fields.map((_, index) => `$${index + 2}`).join(', ')})
        RETURNING ${responseColumns}
      `,
      params
    );

    return result.rows[0];
  });
}

export async function updateTicketResponse(ticketNumber, payload) {
  rejectUnknownFields(payload, responseFields);

  return transaction(async (client) => {
    const existingResult = await client.query(
      `SELECT ${responseColumns} FROM device_responses WHERE ticket_id = $1`,
      [ticketNumber]
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      throw Object.assign(new Error('Ticket response not found'), { status: 404 });
    }

    const response = validateResponsePayload(payload, { partial: true });
    if (existing.resolution_locked_at && response.resolution_type !== undefined) {
      delete response.resolution_type;
    }

    const assignments = [];
    const params = [];
    Object.entries(response).forEach(([field, value]) => {
      params.push(value);
      assignments.push(`${field} = $${params.length}`);
    });

    if (
      response.status &&
      isLockingResponseStatus(response.status) &&
      !existing.resolution_locked_at
    ) {
      assignments.push('resolution_locked_at = NOW()');
    }

    assignments.push('updated_at = NOW()');

    if (assignments.length === 1) {
      return existing;
    }

    params.push(ticketNumber);
    const result = await client.query(
      `
        UPDATE device_responses
        SET ${assignments.join(', ')}
        WHERE ticket_id = $${params.length}
        RETURNING ${responseColumns}
      `,
      params
    );

    return result.rows[0];
  });
}

async function getTicketOrThrow(ticketNumber) {
  const result = await query(`SELECT ${ticketColumns} FROM tickets WHERE ticket_number = $1`, [ticketNumber]);
  if (!result.rows[0]) {
    throw Object.assign(new Error('Ticket not found'), { status: 404 });
  }
  return result.rows[0];
}

function validateTicketCreate(payload) {
  rejectUnknownFields(payload, [
    'external_ticket_number',
    'device_type',
    'school_name',
    'tea_code',
    'mdf_idf',
    'date',
    'note',
    'priority'
  ]);

  return {
    external_ticket_number: requiredString(payload.external_ticket_number, 'external_ticket_number', 8),
    device_type: requiredEnum(payload.device_type, 'device_type', deviceTypes),
    school_name: requiredString(payload.school_name, 'school_name', 255),
    tea_code: requiredInteger(payload.tea_code, 'tea_code', { min: 0, max: 999 }),
    mdf_idf: optionalString(payload.mdf_idf, 'mdf_idf', 100),
    date: requiredString(payload.date, 'date'),
    note: optionalString(payload.note, 'note', 1000),
    priority: optionalString(payload.priority, 'priority')
  };
}

function validateResponsePayload(payload, { partial }) {
  rejectUnknownFields(payload, responseFields);

  const response = {};
  responseFields.forEach((field) => {
    if (payload[field] === undefined && partial) return;

    if (field === 'resolution_type') {
      response[field] = payload[field] === undefined
        ? 'permanent'
        : requiredEnum(payload[field], field, responseResolutionTypes);
      return;
    }

    if (field === 'status') {
      response[field] = payload[field] === undefined
        ? 'open'
        : requiredEnum(payload[field], field, responseStatuses);
      return;
    }

    response[field] = optionalString(payload[field], field, responseMaxLengths[field]);
  });

  return response;
}

function isLockingResponseStatus(status) {
  return status === 'temp_placed' || status === 'closed';
}
