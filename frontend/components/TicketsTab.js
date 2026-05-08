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

const emptyResponse = {
  resolution_type: 'no_replacement',
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

const emptyRmaEmail = {
  dynamics_case_number: '',
  issue: ''
};

const emptyUpsDevice = {
  model: '',
  sn: '',
  snmp_ip: '',
  hostname: '',
  asset_tag: '',
  mac_address: '',
  room: ''
};

const emptyBatteryPack = {
  sn: '',
  asset_tag: ''
};

export default function TicketsTab() {
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
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
  const [rmaEmailStep, setRmaEmailStep] = useState(false);
  const [rmaEmailForm, setRmaEmailForm] = useState(emptyRmaEmail);
  const [upsDevices, setUpsDevices] = useState([{ ...emptyUpsDevice }]);
  const [batteryPacks, setBatteryPacks] = useState([]);

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
    setRmaEmailStep(false);
    setRmaEmailForm(emptyRmaEmail);
    setUpsDevices([{ ...emptyUpsDevice }]);
    setBatteryPacks([]);
    setResponseLoading(true);

    try {
      const response = await apiRequest(`/tickets/${ticket.ticket_number}/response`);
      setResponseRecord(response);
      setResponseForm(responseToForm(response));
      if (ticket.device_type === 'ups') {
        setUpsDevices([responseToUpsDevice(response)]);
      }
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
    setRmaEmailStep(false);
    setRmaEmailForm(emptyRmaEmail);
    setUpsDevices([{ ...emptyUpsDevice }]);
    setBatteryPacks([]);
    setResponseLoading(false);
  }

  function responseToForm(response) {
    return Object.fromEntries(
      Object.keys(emptyResponse).map((key) => [key, response[key] || emptyResponse[key]])
    );
  }

  function responseToUpsDevice(response) {
    return {
      model: response.replacement_model || '',
      sn: response.replacement_sn || '',
      snmp_ip: response.replacement_ip || '',
      hostname: response.replacement_hostname || '',
      asset_tag: response.replacement_asset_tag || '',
      mac_address: response.replacement_mac || '',
      room: response.replacement_room || ''
    };
  }

  function updateResponseForm(field, value) {
    setResponseForm((current) => ({ ...current, [field]: value }));
  }

  function updateRmaEmailForm(field, value) {
    setRmaEmailForm((current) => ({ ...current, [field]: value }));
  }

  function normalizeResponsePayload(statusOverride, form = responseForm) {
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value])
    );
    payload.resolution_type = form.resolution_type;
    payload.status = statusOverride || form.status || 'open';
    return payload;
  }

  async function saveResponse(statusOverride, formOverride) {
    if (!responseTicket) return null;
    const payload = normalizeResponsePayload(statusOverride, formOverride);
    const endpoint = `/tickets/${responseTicket.ticket_number}/response`;
    const savedResponse = responseRecord
      ? await apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(payload) })
      : await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) });

    setResponseRecord(savedResponse);
    setResponseForm(responseToForm(savedResponse));
    return savedResponse;
  }

  function updateUpsDevice(index, field, value) {
    setUpsDevices((current) =>
      current.map((device, currentIndex) => currentIndex === index ? { ...device, [field]: value } : device)
    );
  }

  function addUpsDevice() {
    setUpsDevices((current) => [...current, { ...emptyUpsDevice }]);
  }

  function removeUpsDevice(index) {
    setUpsDevices((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateBatteryPack(index, field, value) {
    setBatteryPacks((current) =>
      current.map((pack, currentIndex) => currentIndex === index ? { ...pack, [field]: value } : pack)
    );
  }

  function addBatteryPack() {
    setBatteryPacks((current) => [...current, { ...emptyBatteryPack }]);
  }

  function removeBatteryPack(index) {
    setBatteryPacks((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function closeTicketStatus() {
    if (!responseTicket) return;
    await apiRequest(`/tickets/${responseTicket.ticket_number}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'closed' })
    });
  }

  async function holdTicketStatus() {
    if (!responseTicket) return;
    await apiRequest(`/tickets/${responseTicket.ticket_number}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'on_hold' })
    });
  }

  async function handleCopyPermanentResponse() {
    try {
      await saveResponse('closed');
      await copyTextToClipboard(buildPermanentResponseText(responseForm));
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      setMessage({ type: 'success', text: 'Permanent replacement response copied.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy permanent replacement response.' });
    }
  }

  async function handleCopyNoReplacementResponse() {
    try {
      await saveResponse('closed');
      await copyTextToClipboard(buildNoReplacementResponseText(responseForm));
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      setMessage({ type: 'success', text: 'No replacement response copied.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy no replacement response.' });
    }
  }

  async function handleCopyTempResponse() {
    try {
      await saveResponse('temp_placed');
      await copyTextToClipboard(buildTempResponseText(responseForm));
      await holdTicketStatus();
      setRmaEmailStep(true);
      loadTickets();
      setMessage({ type: 'success', text: 'Temporary device response copied. Prepare the RMA email next.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy temporary device response.' });
    }
  }

  async function handleCopyRmaEmail() {
    try {
      await copyTextToClipboard(buildRmaEmailText(responseTicket, responseForm, rmaEmailForm));
      closeResponseModal();
      setMessage({ type: 'success', text: 'RMA email copied.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy RMA email.' });
    }
  }

  async function handleCopyRmaResponse() {
    try {
      await saveResponse('closed');
      await copyTextToClipboard(buildRmaResponseText(responseForm));
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      setMessage({ type: 'success', text: 'RMA replacement response copied.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy RMA replacement response.' });
    }
  }

  async function handleCopyUpsResponse() {
    try {
      const firstUps = upsDevices[0] || emptyUpsDevice;
      const upsResponseForm = {
        ...responseForm,
        resolution_type: 'permanent',
        response_note: responseForm.response_note,
        replacement_model: firstUps.model,
        replacement_sn: firstUps.sn,
        replacement_mac: firstUps.mac_address,
        replacement_hostname: firstUps.hostname,
        replacement_ip: firstUps.snmp_ip,
        replacement_asset_tag: firstUps.asset_tag,
        replacement_room: firstUps.room
      };
      await saveResponse('closed', upsResponseForm);
      await seedUpsPendingInstall(firstUps, batteryPacks[0]);
      await copyTextToClipboard(buildUpsResponseText(upsResponseForm.response_note, upsDevices, batteryPacks));
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      setMessage({ type: 'success', text: 'UPS response copied and UPS install moved to Pending.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy UPS response.' });
    }
  }

  async function seedUpsPendingInstall(firstUps, firstBatteryPack) {
    const installs = await apiRequest('/ups-installations/?limit=1000&offset=0');
    const install = (installs || []).find((item) => item.ticket_number === responseTicket.ticket_number);
    if (!install) return;

    await apiRequest(`/ups-installations/${install.ups_installation_id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'intake',
        model: firstUps.model || null,
        serial_number: firstUps.sn || null,
        snmp_ip: firstUps.snmp_ip || null,
        hostname: firstUps.hostname || null,
        asset_tag: firstUps.asset_tag || null,
        mac_address: firstUps.mac_address || null,
        room_number: firstUps.room || null,
        defective_battery_pack_serial: firstBatteryPack?.sn || null,
        battery_pack_1_asset_tag: firstBatteryPack?.asset_tag || null
      })
    });
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

  function getDevicePhrase(deviceType) {
    if (deviceType === 'access_point') return 'AP';
    if (deviceType === 'switch') return 'switch';
    if (deviceType === 'ups') return 'UPS';
    return 'device';
  }

  function buildRmaEmailText(ticket, form, emailForm) {
    const devicePhrase = getDevicePhrase(ticket?.device_type);
    return [
      getGreeting(),
      '',
      `We were unable to fix the issue with this ${devicePhrase} and need a replacement for it. Could you process the RMA for this device please?`,
      '',
      'Customer: HISD',
      `Campus: ${ticket?.school_name || '-'}`,
      `Dynamics Case#: ${emailForm.dynamics_case_number || '-'}`,
      `Part Number/Model: ${form.defective_model || '-'}`,
      `Defective SN: ${form.defective_sn || '-'}`,
      `Issue: ${emailForm.issue || '-'}`
    ].join('\n');
  }

  function buildNoReplacementResponseText(form) {
    return [
      getGreeting(),
      '',
      form.response_note || '',
      '',
      'Device Information:',
      fieldLine('Model', form.replacement_model),
      fieldLine('SN', form.replacement_sn),
      fieldLine('MAC', form.replacement_mac),
      fieldLine('Hostname', form.replacement_hostname),
      fieldLine('IP', form.replacement_ip),
      fieldLine('Asset Tag', form.replacement_asset_tag),
      fieldLine('Room', form.replacement_room),
      '',
      'Could you please update the ticket. Thank You!'
    ].join('\n');
  }

  function buildUpsResponseText(note, devices, packs) {
    const lines = [
      getGreeting(),
      '',
      note || ''
    ];

    devices.forEach((device, index) => {
      lines.push(
        '',
        `UPS ${index + 1} Information:`,
        fieldLine('Model', device.model),
        fieldLine('SN', device.sn),
        fieldLine('SNMP IP', device.snmp_ip),
        fieldLine('Hostname', device.hostname),
        fieldLine('Asset Tag', device.asset_tag),
        fieldLine('MAC Address', device.mac_address),
        fieldLine('Room', device.room)
      );
    });

    packs.forEach((pack, index) => {
      lines.push(
        '',
        packs.length === 1 ? 'Battery Pack:' : `Battery Pack ${index + 1}:`,
        fieldLine('SN', pack.sn),
        fieldLine('Asset Tag', pack.asset_tag)
      );
    });

    return lines.join('\n');
  }

  const responseTypeLocked = Boolean(responseRecord?.resolution_locked_at);
  const responseClosed = responseForm.status === 'closed';
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

  function renderResponseNote(label, field, rows = 4) {
    return (
      <label className={styles.fullWidthLabel}>
        {label}
        <textarea
          value={responseForm[field]}
          onChange={(event) => updateResponseForm(field, event.target.value)}
          maxLength={2000}
          rows={rows}
          disabled={responseClosed}
        />
      </label>
    );
  }

  function renderUpsResponse() {
    return (
      <>
        <div className={styles.responseHeader}>
          <div className={styles.responseContext}>
            <span>{responseTicket.school_name}</span>
            <strong>UPS Replacement Response</strong>
          </div>
        </div>
        <section className={styles.responsePhase}>
          <div className={styles.phaseHeader}>
            <h3>UPS Information</h3>
            {!responseClosed && <button type="button" onClick={addUpsDevice}>Add UPS</button>}
          </div>
          <div className={styles.deviceStack}>
            {upsDevices.map((device, index) => (
              <div className={styles.responseFieldset} key={`ups-${index}`}>
                <div className={styles.phaseHeader}>
                  <h4>UPS {index + 1}</h4>
                  {index > 0 && !responseClosed && (
                    <button type="button" onClick={() => removeUpsDevice(index)}>Remove</button>
                  )}
                </div>
                <div className={styles.responseGrid}>
                  {[
                    ['model', 'Model'],
                    ['sn', 'SN'],
                    ['snmp_ip', 'SNMP IP'],
                    ['hostname', 'Hostname'],
                    ['asset_tag', 'Asset Tag'],
                    ['mac_address', 'MAC Address'],
                    ['room', 'Room']
                  ].map(([field, label]) => (
                    <label key={field}>
                      {label}
                      <input
                        value={device[field]}
                        onChange={(event) => updateUpsDevice(index, field, event.target.value)}
                        maxLength={field === 'mac_address' ? 32 : field === 'room' ? 50 : 100}
                        disabled={responseClosed}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.responsePhase}>
          <div className={styles.phaseHeader}>
            <h3>Battery Packs</h3>
            {!responseClosed && <button type="button" onClick={addBatteryPack}>Add Battery Pack</button>}
          </div>
          {batteryPacks.length > 0 ? (
            <div className={styles.deviceStack}>
              {batteryPacks.map((pack, index) => (
                <div className={styles.responseFieldset} key={`battery-${index}`}>
                  <div className={styles.phaseHeader}>
                    <h4>{batteryPacks.length === 1 ? 'Battery Pack' : `Battery Pack ${index + 1}`}</h4>
                    {!responseClosed && <button type="button" onClick={() => removeBatteryPack(index)}>Remove</button>}
                  </div>
                  <div className={styles.responseGrid}>
                    <label>
                      SN
                      <input value={pack.sn} onChange={(event) => updateBatteryPack(index, 'sn', event.target.value)} maxLength={100} disabled={responseClosed} />
                    </label>
                    <label>
                      Asset Tag
                      <input value={pack.asset_tag} onChange={(event) => updateBatteryPack(index, 'asset_tag', event.target.value)} maxLength={100} disabled={responseClosed} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mutedText">Add a battery pack only when one needs to be included in the response.</p>
          )}
        </section>
        {renderResponseNote('Response Note', 'response_note', 4)}
        <div className={styles.actions}>
          <button type="button" className="primaryButton" onClick={handleCopyUpsResponse} disabled={responseClosed}>
            Copy UPS Response
          </button>
          <button type="button" onClick={closeResponseModal}>Close</button>
        </div>
      </>
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
                  onChange={(event) => updateTicketForm('mdf_idf', event.target.value.toUpperCase())}
                  maxLength={100}
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
              {responseTicket.device_type === 'ups' ? (
                renderUpsResponse()
              ) : rmaEmailStep ? (
                <>
                  <div className={styles.responseHeader}>
                    <div className={styles.responseContext}>
                      <span>{responseTicket.school_name}</span>
                      <strong>RMA Email</strong>
                    </div>
                  </div>
                  <div className={styles.rmaEmailGrid}>
                    <div className={styles.readOnlyField}>
                      <span>Customer</span>
                      <strong>HISD</strong>
                    </div>
                    <div className={styles.readOnlyField}>
                      <span>Campus</span>
                      <strong>{responseTicket.school_name}</strong>
                    </div>
                    <div className={styles.readOnlyField}>
                      <span>Part Number/Model</span>
                      <strong>{responseForm.defective_model || '-'}</strong>
                    </div>
                    <div className={styles.readOnlyField}>
                      <span>Defective SN</span>
                      <strong>{responseForm.defective_sn || '-'}</strong>
                    </div>
                  </div>
                  <div className={styles.responseSections}>
                    <label>
                      Dynamics Case #
                      <input
                        value={rmaEmailForm.dynamics_case_number}
                        onChange={(event) => updateRmaEmailForm('dynamics_case_number', event.target.value)}
                        maxLength={32}
                      />
                    </label>
                    <label>
                      Issue
                      <textarea
                        value={rmaEmailForm.issue}
                        onChange={(event) => updateRmaEmailForm('issue', event.target.value)}
                        maxLength={1000}
                        rows={4}
                      />
                    </label>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className="primaryButton" onClick={handleCopyRmaEmail}>
                      Copy RMA Email
                    </button>
                    <button type="button" onClick={closeResponseModal}>Close</button>
                  </div>
                </>
              ) : (
                <>
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
              </div>

              {responseTypeLocked && (
                <p className="mutedText">Resolution type is locked because a response has already been copied.</p>
              )}

              {responseForm.resolution_type === 'no_replacement' ? (
                <>
                  <div className={styles.responseSections}>
                    {renderDeviceFields('Device Information', replacementFields, responseClosed)}
                  </div>
                  {renderResponseNote('Response Note', 'response_note', 5)}
                  <div className={styles.actions}>
                    <button type="button" className="primaryButton" onClick={handleCopyNoReplacementResponse} disabled={responseClosed}>
                      Copy Response
                    </button>
                    <button type="button" onClick={closeResponseModal}>Close</button>
                  </div>
                </>
              ) : responseForm.resolution_type === 'permanent' ? (
                <>
                  <div className={styles.responseSections}>
                    {renderDeviceFields('Defective Device', defectiveFields, responseClosed)}
                    {renderDeviceFields('Replacement Device', replacementFields, responseClosed)}
                  </div>
                  {renderResponseNote('Response Note', 'response_note')}
                  <div className={styles.actions}>
                    <button type="button" className="primaryButton" onClick={handleCopyPermanentResponse} disabled={responseClosed}>
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
                      <div className={styles.responseSections}>
                        {renderDeviceFields('Defective Device', defectiveFields, responseClosed)}
                        {renderDeviceFields('Temporary Device', tempFields, responseClosed)}
                      </div>
                      {renderResponseNote('Temp Response Note', 'temp_response_note')}
                      <div className={styles.actions}>
                        <button type="button" className="primaryButton" onClick={handleCopyTempResponse} disabled={responseClosed}>
                          Copy Temporary Response
                        </button>
                      </div>
                    </section>
                  )}

                  {rmaPhaseUnlocked && (
                    <section className={styles.responsePhase}>
                      <h3>Phase 2 - RMA Replacement</h3>
                      <div className={styles.responseSections}>
                        {renderDeviceFields('Replacement Device', replacementFields, responseClosed)}
                      </div>
                      {renderResponseNote('RMA Response Note', 'rma_response_note')}
                      <div className={styles.actions}>
                        <button type="button" className="primaryButton" onClick={handleCopyRmaResponse} disabled={responseClosed}>
                          Copy RMA Response
                        </button>
                        <button type="button" onClick={closeResponseModal}>Close</button>
                      </div>
                    </section>
                  )}
                </>
              )}
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
