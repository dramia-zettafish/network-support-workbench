'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { copyTextToClipboard } from '../lib/clipboard';
import DataTable from './ui/DataTable';
import Modal from './ui/Modal';
import SectionCard from './ui/SectionCard';
import StatusBadge from './ui/StatusBadge';
import styles from './TicketsTab.module.css';

const limit = 12;

const emptyTicket = {
  external_ticket_number: '',
  device_type: 'switch',
  school_name: '',
  tea_code: '',
  mdf_idf: '',
  date: '',
  note: ''
};

const reverseDeviceTypeMap = {
  switch: 'Switch',
  access_point: 'Access Point',
  ups: 'UPS'
};

const statusLabelMap = {
  open: 'Open',
  on_hold: 'On Hold',
  closed: 'Closed'
};

const statusToneMap = {
  open: 'success',
  on_hold: 'warning',
  closed: 'neutral'
};

const responseStatusLabelMap = {
  open: 'Open',
  temp_placed: 'Temp Device in Place',
  closed: 'Closed'
};

const responseStatusToneMap = {
  open: 'success',
  temp_placed: 'warning',
  closed: 'neutral'
};

const emptyResponse = {
  resolution_type: 'permanent',
  status: 'open',
  response_note: '',
  temp_response_note: '',
  rma_response_note: '',
  defective_model: '',
  defective_sn: '',
  defective_mac: '',
  defective_asset_tag: '',
  defective_room: '',
  replacement_model: '',
  replacement_sn: '',
  replacement_mac: '',
  replacement_hostname: '',
  replacement_ip: '',
  replacement_asset_tag: '',
  replacement_room: '',
  temp_model: '',
  temp_sn: '',
  temp_mac: '',
  temp_hostname: '',
  temp_ip: '',
  temp_asset_tag: '',
  temp_room: ''
};

const defectiveFields = [
  ['defective_model', 'Model'],
  ['defective_sn', 'SN'],
  ['defective_mac', 'MAC'],
  ['defective_asset_tag', 'Asset Tag'],
  ['defective_room', 'Room']
];

const replacementFields = [
  ['replacement_model', 'Model'],
  ['replacement_sn', 'SN'],
  ['replacement_mac', 'MAC'],
  ['replacement_hostname', 'Hostname'],
  ['replacement_ip', 'IP'],
  ['replacement_asset_tag', 'Asset Tag'],
  ['replacement_room', 'Room']
];

const tempFields = [
  ['temp_model', 'Model'],
  ['temp_sn', 'SN'],
  ['temp_mac', 'MAC'],
  ['temp_hostname', 'Hostname'],
  ['temp_ip', 'IP'],
  ['temp_asset_tag', 'Asset Tag'],
  ['temp_room', 'Room']
];

export default function TicketsTab() {
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingTicket, setEditingTicket] = useState(null);
  const [editForm, setEditForm] = useState({ note: '', status: 'open' });
  const [responseTicket, setResponseTicket] = useState(null);
  const [responseRecord, setResponseRecord] = useState(null);
  const [responseForm, setResponseForm] = useState(emptyResponse);
  const [responseLoading, setResponseLoading] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const visibleTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return tickets;

    return tickets.filter((ticket) =>
      Object.values(ticket).join(' ').toLowerCase().includes(normalizedSearch)
    );
  }, [tickets, search]);

  const ticketColumns = [
    { key: 'ticket', label: 'Ticket #', render: (ticket) => ticket.external_ticket_number || ticket.ticket_number },
    { key: 'device_type', label: 'Device Type', render: (ticket) => reverseDeviceTypeMap[ticket.device_type] || ticket.device_type },
    { key: 'school_name', label: 'School' },
    { key: 'tea_code', label: 'TEA Code' },
    { key: 'mdf_idf', label: 'MDF/IDF', render: (ticket) => ticket.mdf_idf || '-' },
    { key: 'date', label: 'Date' },
    {
      key: 'status',
      label: 'Status',
      render: (ticket) => (
        <StatusBadge tone={statusToneMap[ticket.status] || 'neutral'}>
          {statusLabelMap[ticket.status] || ticket.status}
        </StatusBadge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (ticket) => (
        <div className={styles.rowActions}>
          <button type="button" onClick={(event) => openEditModal(event, ticket)}>Edit</button>
          <button type="button" onClick={(event) => handleDeleteTicket(event, ticket.ticket_number)}>Delete</button>
        </div>
      )
    }
  ];

  async function loadTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((currentPage - 1) * limit)
      });

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const loadedTickets = await apiRequest(`/tickets/?${params}`);
      setTickets(loadedTickets || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load tickets.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket(event) {
    event.preventDefault();

    const payload = {
      external_ticket_number: ticketForm.external_ticket_number,
      device_type: ticketForm.device_type,
      school_name: ticketForm.school_name,
      tea_code: Number.parseInt(ticketForm.tea_code, 10),
      mdf_idf: ticketForm.mdf_idf || null,
      date: ticketForm.date,
      note: ticketForm.note || null
    };

    try {
      await apiRequest('/tickets/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage({ type: 'success', text: 'Ticket created successfully.' });
      setTicketForm(emptyTicket);
      setCurrentPage(1);
      loadTickets();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create ticket.' });
    }
  }

  async function handleUpdateTicket(event) {
    event.preventDefault();
    if (!editingTicket) return;

    try {
      await apiRequest(`/tickets/${editingTicket.ticket_number}`, {
        method: 'PUT',
        body: JSON.stringify({
          note: editForm.note || null,
          status: editForm.status
        })
      });
      setMessage({ type: 'success', text: 'Ticket updated successfully.' });
      closeEditModal();
      loadTickets();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update ticket.' });
    }
  }

  async function handleDeleteTicket(event, ticketNumber) {
    event.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;

    try {
      await apiRequest(`/tickets/${ticketNumber}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Ticket deleted successfully.' });
      loadTickets();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete ticket.' });
    }
  }

  function openEditModal(event, ticket) {
    event.stopPropagation();
    setEditingTicket(ticket);
    setEditForm({
      note: ticket.note || '',
      status: ticket.status || 'open'
    });
  }

  function closeEditModal() {
    setEditingTicket(null);
    setEditForm({ note: '', status: 'open' });
  }

  function updateTicketForm(field, value) {
    setTicketForm((current) => ({ ...current, [field]: value }));
  }

  async function openResponseModal(ticket) {
    setResponseTicket(ticket);
    setResponseRecord(null);
    setResponseForm(emptyResponse);
    setResponseLoading(true);

    try {
      const response = await apiRequest(`/tickets/${ticket.ticket_number}/response`);
      setResponseRecord(response);
      setResponseForm(responseToForm(response));
    } catch (error) {
      setResponseRecord(null);
      setResponseForm(emptyResponse);
    } finally {
      setResponseLoading(false);
    }
  }

  function closeResponseModal() {
    setResponseTicket(null);
    setResponseRecord(null);
    setResponseForm(emptyResponse);
    setResponseLoading(false);
  }

  function responseToForm(response) {
    return Object.fromEntries(
      Object.keys(emptyResponse).map((key) => [key, response[key] || emptyResponse[key]])
    );
  }

  function updateResponseForm(field, value) {
    setResponseForm((current) => ({ ...current, [field]: value }));
  }

  function normalizeResponsePayload(statusOverride) {
    const payload = Object.fromEntries(
      Object.entries(responseForm).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value])
    );
    payload.resolution_type = responseForm.resolution_type;
    payload.status = statusOverride || responseForm.status || 'open';
    return payload;
  }

  async function saveResponse(statusOverride) {
    if (!responseTicket) return null;
    const payload = normalizeResponsePayload(statusOverride);
    const endpoint = `/tickets/${responseTicket.ticket_number}/response`;
    const savedResponse = responseRecord
      ? await apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(payload) })
      : await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) });

    setResponseRecord(savedResponse);
    setResponseForm(responseToForm(savedResponse));
    return savedResponse;
  }

  async function handleCopyPermanentResponse() {
    try {
      await saveResponse('closed');
      await copyTextToClipboard(buildPermanentResponseText(responseForm));
      closeResponseModal();
      setMessage({ type: 'success', text: 'Permanent replacement response copied.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy permanent replacement response.' });
    }
  }

  async function handleCopyNoReplacementResponse() {
    try {
      await saveResponse('closed');
      await copyTextToClipboard(buildNoReplacementResponseText(responseForm));
      closeResponseModal();
      setMessage({ type: 'success', text: 'No replacement response copied.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy no replacement response.' });
    }
  }

  async function handleCopyTempResponse() {
    try {
      await saveResponse('temp_placed');
      await copyTextToClipboard(buildTempResponseText(responseForm));
      closeResponseModal();
      setMessage({ type: 'success', text: 'Temporary device response copied. Status set to Temp Device in Place.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy temporary device response.' });
    }
  }

  async function handleCopyRmaResponse() {
    try {
      await saveResponse('closed');
      await copyTextToClipboard(buildRmaResponseText(responseForm));
      closeResponseModal();
      setMessage({ type: 'success', text: 'RMA replacement response copied.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy RMA replacement response.' });
    }
  }

  function getGreeting() {
    return new Date().getHours() < 12 ? 'Good Morning,' : 'Good Afternoon,';
  }

  function fieldLine(label, value) {
    return `${label}: ${value || '-'}`;
  }

  function buildPermanentResponseText(form) {
    return [
      getGreeting(),
      '',
      form.response_note || '',
      '',
      'Defective Device Information:',
      fieldLine('Model', form.defective_model),
      fieldLine('SN', form.defective_sn),
      fieldLine('MAC', form.defective_mac),
      fieldLine('Asset Tag', form.defective_asset_tag),
      fieldLine('Room', form.defective_room),
      '',
      'Replacement Device Information:',
      fieldLine('Model', form.replacement_model),
      fieldLine('SN', form.replacement_sn),
      fieldLine('MAC', form.replacement_mac),
      fieldLine('Hostname', form.replacement_hostname),
      fieldLine('IP', form.replacement_ip),
      fieldLine('Asset Tag', form.replacement_asset_tag),
      fieldLine('Room', form.replacement_room)
    ].join('\n');
  }

  function buildTempResponseText(form) {
    return [
      getGreeting(),
      '',
      form.temp_response_note || '',
      '',
      'Defective Device Information:',
      fieldLine('Model', form.defective_model),
      fieldLine('SN', form.defective_sn),
      fieldLine('MAC', form.defective_mac),
      fieldLine('Asset Tag', form.defective_asset_tag),
      fieldLine('Room', form.defective_room),
      '',
      'Temporary Device Information:',
      fieldLine('Model', form.temp_model),
      fieldLine('SN', form.temp_sn),
      fieldLine('MAC', form.temp_mac),
      fieldLine('Asset Tag', form.temp_asset_tag),
      fieldLine('Hostname', form.temp_hostname),
      fieldLine('IP', form.temp_ip),
      fieldLine('Room', form.temp_room)
    ].join('\n');
  }

  function buildRmaResponseText(form) {
    return [
      getGreeting(),
      '',
      form.rma_response_note || '',
      '',
      'Replacement Device Information:',
      fieldLine('Model', form.replacement_model),
      fieldLine('SN', form.replacement_sn),
      fieldLine('MAC', form.replacement_mac),
      fieldLine('Hostname', form.replacement_hostname),
      fieldLine('IP', form.replacement_ip),
      fieldLine('Asset Tag', form.replacement_asset_tag),
      fieldLine('Room', form.replacement_room)
    ].join('\n');
  }

  function buildNoReplacementResponseText(form) {
    return [
      getGreeting(),
      '',
      form.response_note || '',
      '',
      'Could you please update the ticket. Thank You!'
    ].join('\n');
  }

  const responseTypeLocked = Boolean(responseRecord?.resolution_locked_at);
  const rmaPhaseUnlocked = responseForm.status === 'temp_placed' || responseForm.status === 'closed';
  const showRmaOnly = responseForm.resolution_type === 'temp_rma' && rmaPhaseUnlocked;

  function renderDeviceFields(title, fields, disabled = false) {
    return (
      <div className={styles.responseFieldset}>
        <h4>{title}</h4>
        <div className={styles.responseGrid}>
          {fields.map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                value={responseForm[field]}
                onChange={(event) => updateResponseForm(field, event.target.value)}
                maxLength={field.includes('mac') ? 32 : field.includes('room') ? 50 : 100}
                disabled={disabled}
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.layout}>
        <SectionCard title="Create New Ticket">
          <form className={styles.form} onSubmit={handleCreateTicket}>
            <div className={styles.formGrid}>
              <label>
                Ticket #
                <input
                  type="text"
                  value={ticketForm.external_ticket_number}
                  onChange={(event) => updateTicketForm('external_ticket_number', event.target.value)}
                  required
                  maxLength={8}
                />
              </label>
              <label>
                Device Type
                <select
                  value={ticketForm.device_type}
                  onChange={(event) => updateTicketForm('device_type', event.target.value)}
                  required
                >
                  <option value="switch">Switch</option>
                  <option value="access_point">Access Point</option>
                  <option value="ups">UPS</option>
                </select>
              </label>
              <label>
                School Name
                <input
                  type="text"
                  value={ticketForm.school_name}
                  onChange={(event) => updateTicketForm('school_name', event.target.value)}
                  required
                  maxLength={255}
                />
              </label>
              <label>
                TEA Code
                <input
                  type="number"
                  value={ticketForm.tea_code}
                  onChange={(event) => updateTicketForm('tea_code', event.target.value)}
                  required
                  min="0"
                  max="999"
                />
              </label>
              <label>
                MDF/IDF
                <input
                  type="text"
                  value={ticketForm.mdf_idf}
                  onChange={(event) => updateTicketForm('mdf_idf', event.target.value)}
                  maxLength={100}
                  placeholder="MDF or IDF A"
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={ticketForm.date}
                  onChange={(event) => updateTicketForm('date', event.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Note
              <textarea
                value={ticketForm.note}
                onChange={(event) => updateTicketForm('note', event.target.value)}
                maxLength={1000}
                rows={3}
              />
            </label>
            <div className={styles.actions}>
              <button type="submit" className="primaryButton">Create Ticket</button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Tickets"
          actions={message && <p className={`${styles.message} ${styles[message.type]}`}>{message.text}</p>}
        >
          <div className={styles.filters}>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tickets..."
            />
          </div>

          {loading ? (
            <p className="mutedText">Loading tickets...</p>
          ) : (
            <DataTable
              columns={ticketColumns}
              rows={visibleTickets}
              getRowKey={(ticket) => ticket.ticket_number}
              emptyTitle="No tickets found"
              emptyDescription="Create a ticket or adjust the current filters."
              onRowClick={openResponseModal}
            />
          )}

          <div className={styles.pagination}>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => page + 1)}
              disabled={tickets.length < limit}
            >
              Next
            </button>
          </div>
        </SectionCard>
      </div>

      {responseTicket && (
        <Modal title={`Device Response - ${responseTicket.external_ticket_number || responseTicket.ticket_number}`} onClose={closeResponseModal} size="wide">
          {responseLoading ? (
            <p className="mutedText">Loading response workflow...</p>
          ) : (
            <div className={styles.responseModal}>
              <div className={styles.responseHeader}>
                {!responseTypeLocked && (
                  <label>
                    Resolution Type
                    <select
                      value={responseForm.resolution_type}
                      onChange={(event) => updateResponseForm('resolution_type', event.target.value)}
                    >
                      <option value="permanent">Permanent Replacement</option>
                      <option value="temp_rma">Temporary + RMA</option>
                      <option value="no_replacement">No Replacement</option>
                    </select>
                  </label>
                )}
                <div className={styles.responseContext}>
                  <span>{responseTicket.school_name}</span>
                  <strong>{reverseDeviceTypeMap[responseTicket.device_type] || responseTicket.device_type}</strong>
                </div>
                <div>
                  <span className="mutedText">Response Status</span>
                  <StatusBadge tone={responseStatusToneMap[responseForm.status] || 'neutral'}>
                    {responseStatusLabelMap[responseForm.status] || responseForm.status}
                  </StatusBadge>
                </div>
              </div>

              {responseTypeLocked && (
                <p className="mutedText">Resolution type is locked because a response has already been copied.</p>
              )}

              {responseForm.resolution_type === 'no_replacement' ? (
                <>
                  <label className={styles.fullWidthLabel}>
                    Response Note
                    <textarea
                      value={responseForm.response_note}
                      onChange={(event) => updateResponseForm('response_note', event.target.value)}
                      maxLength={2000}
                      rows={6}
                    />
                  </label>
                  <div className={styles.actions}>
                    <button type="button" className="primaryButton" onClick={handleCopyNoReplacementResponse}>
                      Copy Response
                    </button>
                    <button type="button" onClick={closeResponseModal}>Close</button>
                  </div>
                </>
              ) : responseForm.resolution_type === 'permanent' ? (
                <>
                  <label className={styles.fullWidthLabel}>
                    Response Note
                    <textarea
                      value={responseForm.response_note}
                      onChange={(event) => updateResponseForm('response_note', event.target.value)}
                      maxLength={2000}
                      rows={4}
                    />
                  </label>
                  <div className={styles.responseSections}>
                    {renderDeviceFields('Defective Device', defectiveFields)}
                    {renderDeviceFields('Replacement Device', replacementFields)}
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className="primaryButton" onClick={handleCopyPermanentResponse}>
                      Copy Response
                    </button>
                    <button type="button" onClick={closeResponseModal}>Close</button>
                  </div>
                </>
              ) : (
                <>
                  {!showRmaOnly && (
                    <section className={styles.responsePhase}>
                      <h3>Phase 1 - Temporary Device</h3>
                      <label className={styles.fullWidthLabel}>
                        Temp Response Note
                        <textarea
                          value={responseForm.temp_response_note}
                          onChange={(event) => updateResponseForm('temp_response_note', event.target.value)}
                          maxLength={2000}
                          rows={4}
                        />
                      </label>
                      <div className={styles.responseSections}>
                        {renderDeviceFields('Defective Device', defectiveFields)}
                        {renderDeviceFields('Temporary Device', tempFields)}
                      </div>
                      <div className={styles.actions}>
                        <button type="button" className="primaryButton" onClick={handleCopyTempResponse}>
                          Copy Temporary Response
                        </button>
                      </div>
                    </section>
                  )}

                  <section className={styles.responsePhase}>
                    <h3>Phase 2 - RMA Replacement</h3>
                    {!rmaPhaseUnlocked && (
                      <p className="mutedText">Copy the temporary device response before adding the RMA replacement response.</p>
                    )}
                    <label className={styles.fullWidthLabel}>
                      RMA Response Note
                      <textarea
                        value={responseForm.rma_response_note}
                        onChange={(event) => updateResponseForm('rma_response_note', event.target.value)}
                        maxLength={2000}
                        rows={4}
                        disabled={!rmaPhaseUnlocked}
                      />
                    </label>
                    <div className={styles.responseSections}>
                      {renderDeviceFields('Replacement Device', replacementFields, !rmaPhaseUnlocked)}
                    </div>
                    <div className={styles.actions}>
                      <button type="button" className="primaryButton" onClick={handleCopyRmaResponse} disabled={!rmaPhaseUnlocked}>
                        Copy RMA Response
                      </button>
                      <button type="button" onClick={closeResponseModal}>Close</button>
                    </div>
                  </section>
                </>
              )}
            </div>
          )}
        </Modal>
      )}

      {editingTicket && (
        <Modal title="Edit Ticket" onClose={closeEditModal}>
          <form className={styles.form} onSubmit={handleUpdateTicket}>
            <label>
              Note
              <textarea
                value={editForm.note}
                onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))}
                maxLength={1000}
                rows={3}
              />
            </label>
            <label>
              Status
              <select
                value={editForm.status}
                onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="open">Open</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <div className={styles.actions}>
              <button type="submit" className="primaryButton">Update Ticket</button>
              <button type="button" onClick={closeEditModal}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
