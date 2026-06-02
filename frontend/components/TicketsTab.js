'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import ReviewCopyPanel from './communications/ReviewCopyPanel';
import DataTable from './ui/DataTable';
import Modal from './ui/Modal';
import SectionCard from './ui/SectionCard';
import SpotlightPanel from './ui/SpotlightPanel';
import StatusBadge from './ui/StatusBadge';
import { useToast } from './ui/ToastProvider';
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

export default function TicketsTab({ initialOpenTicket = null, initialOpenTicketNumber = null, showCreate = true }) {
  const { showToast } = useToast();
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingTicket, setSavingTicket] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [deleteConfirmTicket, setDeleteConfirmTicket] = useState(null);
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
  const [reviewCopyConfig, setReviewCopyConfig] = useState(null);

  useEffect(() => {
    loadTickets();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    if (!initialOpenTicket) return;
    openResponseModal(initialOpenTicket);
  }, [initialOpenTicket]);

  useEffect(() => {
    if (!initialOpenTicketNumber || tickets.length === 0) return;
    const matchingTicket = tickets.find((ticket) => String(ticket.ticket_number) === String(initialOpenTicketNumber));
    if (matchingTicket) {
      openResponseModal(matchingTicket);
    }
  }, [initialOpenTicketNumber, tickets]);

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
          <button type="button" className="secondaryButton compactButton" onClick={(event) => openEditModal(event, ticket)}>Edit</button>
          <button type="button" className="dangerButton compactButton" onClick={(event) => openDeleteConfirm(event, ticket)}>Delete</button>
        </div>
      )
    }
  ];

  function notify(type, title, message = '') {
    showToast({ type, title, message });
  }

  async function loadTickets() {
    setLoading(true);
    setLoadFailed(false);
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
      setLoadFailed(true);
      notify('error', 'Failed to load tickets', 'Use Retry to load the ticket list again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket(event) {
    event.preventDefault();
    setFormError('');

    if (!ticketForm.external_ticket_number.trim()) {
      setFormError('Ticket # is required.');
      return;
    }

    if (!ticketForm.school_name.trim()) {
      setFormError('School Name is required.');
      return;
    }

    if (!ticketForm.tea_code.trim()) {
      setFormError('TEA Code is required.');
      return;
    }

    if (!Number.isInteger(Number.parseInt(ticketForm.tea_code, 10))) {
      setFormError('TEA Code must be a number.');
      return;
    }

    if (!ticketForm.date) {
      setFormError('Date is required.');
      return;
    }

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
      setSavingTicket(true);
      await apiRequest('/tickets/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      notify('success', 'Ticket created');
      setTicketForm(emptyTicket);
      setCurrentPage(1);
      loadTickets();
    } catch (error) {
      notify('error', 'Failed to create ticket', 'Check the required fields and try again.');
      setFormError('Failed to create ticket. Check the required fields and try again.');
    } finally {
      setSavingTicket(false);
    }
  }

  async function handleUpdateTicket(event) {
    event.preventDefault();
    if (!editingTicket) return;

    try {
      setUpdatingTicket(true);
      await apiRequest(`/tickets/${editingTicket.ticket_number}`, {
        method: 'PUT',
        body: JSON.stringify({
          note: editForm.note || null,
          status: editForm.status
        })
      });
      notify('success', 'Ticket updated');
      closeEditModal();
      loadTickets();
    } catch (error) {
      notify('error', 'Failed to update ticket');
    } finally {
      setUpdatingTicket(false);
    }
  }

  function openDeleteConfirm(event, ticket) {
    event.stopPropagation();
    setDeleteConfirmTicket(ticket);
  }

  function closeDeleteConfirm() {
    if (deletingTicket) return;
    setDeleteConfirmTicket(null);
  }

  async function handleConfirmDeleteTicket() {
    if (!deleteConfirmTicket) return;

    try {
      setDeletingTicket(true);
      await apiRequest(`/tickets/${deleteConfirmTicket.ticket_number}`, { method: 'DELETE' });
      notify('success', 'Ticket deleted');
      setDeleteConfirmTicket(null);
      loadTickets();
    } catch (error) {
      notify('error', 'Failed to delete ticket');
    } finally {
      setDeletingTicket(false);
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
    setReviewCopyConfig(null);
    setResponseLoading(true);

    try {
      const response = await apiRequest(`/ticket-responses/${ticket.ticket_number}`);
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
    setReviewCopyConfig(null);
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
    const endpoint = `/ticket-responses/${responseTicket.ticket_number}`;
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

  function openReviewCopy(config) {
    setReviewCopyConfig({
      title: 'Review Response',
      cancelLabel: 'Back',
      confirmLabel: 'Copy Message',
      ...config
    });
  }

  function closeReviewCopy() {
    setReviewCopyConfig(null);
  }

  function handleReviewPermanentResponse() {
    openReviewCopy({
      purpose: 'Permanent Replacement Response',
      initialMessage: buildPermanentResponseText(responseForm),
      onConfirmCopy: completePermanentResponse
    });
  }

  async function completePermanentResponse() {
    try {
      await saveResponse('closed');
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      notify('success', 'Permanent response copied');
    } catch (error) {
      notify('error', 'Permanent response failed', 'The workflow update did not complete.');
      throw error;
    }
  }

  function handleReviewNoReplacementResponse() {
    openReviewCopy({
      purpose: 'No Replacement Response',
      initialMessage: buildNoReplacementResponseText(responseForm),
      onConfirmCopy: completeNoReplacementResponse
    });
  }

  async function completeNoReplacementResponse() {
    try {
      await saveResponse('closed');
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      notify('success', 'No replacement response copied');
    } catch (error) {
      notify('error', 'No replacement response failed', 'The workflow update did not complete.');
      throw error;
    }
  }

  function handleReviewTempResponse() {
    openReviewCopy({
      purpose: 'Temporary Device Response',
      initialMessage: buildTempResponseText(responseForm),
      onConfirmCopy: completeTempResponse
    });
  }

  async function completeTempResponse() {
    try {
      await saveResponse('temp_placed');
      await holdTicketStatus();
      setRmaEmailStep(true);
      setReviewCopyConfig(null);
      loadTickets();
      notify('success', 'Temporary response copied', 'Prepare the RMA email next.');
    } catch (error) {
      notify('error', 'Temporary response failed', 'The workflow update did not complete.');
      throw error;
    }
  }

  function handleReviewRmaEmail() {
    openReviewCopy({
      title: 'Review RMA Email',
      purpose: 'RMA Admin Email',
      initialMessage: buildRmaEmailText(responseTicket, responseForm, rmaEmailForm),
      onConfirmCopy: completeRmaEmail
    });
  }

  async function completeRmaEmail() {
    try {
      closeResponseModal();
      notify('success', 'RMA email copied');
    } catch (error) {
      notify('error', 'RMA email failed');
      throw error;
    }
  }

  function handleReviewRmaResponse() {
    openReviewCopy({
      purpose: 'RMA Replacement Response',
      initialMessage: buildRmaResponseText(responseForm),
      onConfirmCopy: completeRmaResponse
    });
  }

  async function completeRmaResponse() {
    try {
      await saveResponse('closed');
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      notify('success', 'RMA response copied');
    } catch (error) {
      notify('error', 'RMA response failed', 'The workflow update did not complete.');
      throw error;
    }
  }

  function buildUpsResponseForm() {
    const firstUps = upsDevices[0] || emptyUpsDevice;
    return {
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
  }

  function handleReviewUpsResponse() {
    const upsResponseForm = buildUpsResponseForm();
    openReviewCopy({
      purpose: 'UPS Response',
      initialMessage: buildUpsResponseText(upsResponseForm.response_note, upsDevices, batteryPacks),
      onConfirmCopy: completeUpsResponse
    });
  }

  async function completeUpsResponse() {
    try {
      const upsResponseForm = buildUpsResponseForm();
      await saveResponse('closed', upsResponseForm);
      await seedUpsPendingInstalls(upsDevices, batteryPacks);
      await closeTicketStatus();
      closeResponseModal();
      loadTickets();
      notify('success', 'UPS response copied', 'UPS install moved to Pending.');
    } catch (error) {
      notify('error', 'UPS response failed', 'The workflow update did not complete.');
      throw error;
    }
  }

  async function seedUpsPendingInstalls(devices, packs) {
    const installs = await apiRequest('/ups-installations/?limit=1000&offset=0');
    const ticketInstalls = (installs || [])
      .filter((item) => item.ticket_number === responseTicket.ticket_number)
      .sort((left, right) => left.ups_installation_id - right.ups_installation_id);
    const normalizedDevices = devices.length > 0 ? devices : [{ ...emptyUpsDevice }];

    await Promise.all(normalizedDevices.map((device, index) => {
      const firstBatteryPack = index === 0 ? packs[0] : null;
      const payload = {
        status: 'intake',
        model: device.model || null,
        serial_number: device.sn || null,
        snmp_ip: device.snmp_ip || null,
        hostname: device.hostname || null,
        asset_tag: device.asset_tag || null,
        mac_address: device.mac_address || null,
        room_number: device.room || null,
        defective_battery_pack_serial: firstBatteryPack?.sn || null,
        battery_pack_1_asset_tag: firstBatteryPack?.asset_tag || null
      };
      const existingInstall = ticketInstalls[index];

      if (existingInstall) {
        return apiRequest(`/ups-installations/${existingInstall.ups_installation_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      }

      return apiRequest('/ups-installations', {
        method: 'POST',
        body: JSON.stringify({
          ticket_number: responseTicket.ticket_number,
          external_ticket_number: responseTicket.external_ticket_number,
          school_name: responseTicket.school_name,
          tea_code: responseTicket.tea_code,
          created_date: responseTicket.date,
          idf: responseTicket.mdf_idf || null,
          ...payload
        })
      });
    }));
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
      <SpotlightPanel className={styles.responseFieldset} mode="interactive">
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
      </SpotlightPanel>
    );
  }

  function renderResponseNote(label, field, rows = 4) {
    return (
      <SpotlightPanel as="label" className={styles.fullWidthLabel} mode="interactive">
        {label}
        <textarea
          value={responseForm[field]}
          onChange={(event) => updateResponseForm(field, event.target.value)}
          maxLength={2000}
          rows={rows}
          disabled={responseClosed}
        />
      </SpotlightPanel>
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
        <SpotlightPanel as="section" className={styles.responsePhase} mode="interactive">
          <div className={styles.phaseHeader}>
            <h3>UPS Information</h3>
            {!responseClosed && <button type="button" className="secondaryButton compactButton" onClick={addUpsDevice}>Add UPS</button>}
          </div>
          <div className={styles.deviceStack}>
            {upsDevices.map((device, index) => (
              <SpotlightPanel className={styles.responseFieldset} mode="interactive" key={`ups-${index}`}>
                <div className={styles.phaseHeader}>
                  <h4>UPS {index + 1}</h4>
                  {index > 0 && !responseClosed && (
                    <button type="button" className="dangerButton compactButton" onClick={() => removeUpsDevice(index)}>Remove</button>
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
              </SpotlightPanel>
            ))}
          </div>
        </SpotlightPanel>
        <SpotlightPanel as="section" className={styles.responsePhase} mode="interactive">
          <div className={styles.phaseHeader}>
            <h3>Battery Packs</h3>
            {!responseClosed && <button type="button" className="secondaryButton compactButton" onClick={addBatteryPack}>Add Battery Pack</button>}
          </div>
          {batteryPacks.length > 0 ? (
            <div className={styles.deviceStack}>
              {batteryPacks.map((pack, index) => (
                <SpotlightPanel className={styles.responseFieldset} mode="interactive" key={`battery-${index}`}>
                  <div className={styles.phaseHeader}>
                    <h4>{batteryPacks.length === 1 ? 'Battery Pack' : `Battery Pack ${index + 1}`}</h4>
                    {!responseClosed && <button type="button" className="dangerButton compactButton" onClick={() => removeBatteryPack(index)}>Remove</button>}
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
                </SpotlightPanel>
              ))}
            </div>
          ) : (
            <p className="mutedText">Add a battery pack only when one needs to be included in the response.</p>
          )}
        </SpotlightPanel>
        {renderResponseNote('Response Note', 'response_note', 4)}
        <div className={styles.actions}>
          <button type="button" className="primaryButton" onClick={handleReviewUpsResponse} disabled={responseClosed}>
            Review & Copy UPS Response
          </button>
          <button type="button" className="secondaryButton" onClick={closeResponseModal}>Close</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.layout}>
        {showCreate && (
          <SectionCard title="Create New Ticket">
            <form className={styles.form} onSubmit={handleCreateTicket}>
              <div className={styles.formGrid}>
                <label>
                  Ticket # <span className={styles.requiredMark} aria-label="Required">*</span>
                  <input
                    type="text"
                    value={ticketForm.external_ticket_number}
                    onChange={(event) => updateTicketForm('external_ticket_number', event.target.value)}
                    required
                    maxLength={8}
                  />
                </label>
                <label>
                  Device Type <span className={styles.requiredMark} aria-label="Required">*</span>
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
                  School Name <span className={styles.requiredMark} aria-label="Required">*</span>
                  <input
                    type="text"
                    value={ticketForm.school_name}
                    onChange={(event) => updateTicketForm('school_name', event.target.value)}
                    required
                    maxLength={255}
                  />
                </label>
                <label>
                  TEA Code <span className={styles.requiredMark} aria-label="Required">*</span>
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
                  Date <span className={styles.requiredMark} aria-label="Required">*</span>
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
              {formError && <p className={`${styles.message} ${styles.error}`}>{formError}</p>}
              <div className={styles.actions}>
                <button type="submit" className="primaryButton" disabled={savingTicket}>
                  {savingTicket ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        <SectionCard
          title="Tickets"
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
          ) : loadFailed ? (
            <div className={styles.retryState}>
              <p className="mutedText">Failed to load tickets.</p>
              <button type="button" className="secondaryButton" onClick={loadTickets}>Retry</button>
            </div>
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
              className="secondaryButton"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage}</span>
            <button
              type="button"
              className="secondaryButton"
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
              {reviewCopyConfig ? (
                <ReviewCopyPanel {...reviewCopyConfig} onCancel={closeReviewCopy} />
              ) : responseTicket.device_type === 'ups' ? (
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
                    <button type="button" className="primaryButton" onClick={handleReviewRmaEmail}>
                      Review & Copy RMA Email
                    </button>
                    <button type="button" className="secondaryButton" onClick={closeResponseModal}>Close</button>
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
                    <button type="button" className="primaryButton" onClick={handleReviewNoReplacementResponse} disabled={responseClosed}>
                      Review & Copy Response
                    </button>
                    <button type="button" className="secondaryButton" onClick={closeResponseModal}>Close</button>
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
                    <button type="button" className="primaryButton" onClick={handleReviewPermanentResponse} disabled={responseClosed}>
                      Review & Copy Response
                    </button>
                    <button type="button" className="secondaryButton" onClick={closeResponseModal}>Close</button>
                  </div>
                </>
              ) : (
                <>
                  {!showRmaOnly && (
                    <SpotlightPanel as="section" className={styles.responsePhase} mode="interactive">
                      <h3>Phase 1 - Temporary Device</h3>
                      <div className={styles.responseSections}>
                        {renderDeviceFields('Defective Device', defectiveFields, responseClosed)}
                        {renderDeviceFields('Temporary Device', tempFields, responseClosed)}
                      </div>
                      {renderResponseNote('Temp Response Note', 'temp_response_note')}
                      <div className={styles.actions}>
                        <button type="button" className="primaryButton" onClick={handleReviewTempResponse} disabled={responseClosed}>
                          Review & Copy Temporary Response
                        </button>
                      </div>
                    </SpotlightPanel>
                  )}

                  {rmaPhaseUnlocked && (
                    <SpotlightPanel as="section" className={styles.responsePhase} mode="interactive">
                      <h3>Phase 2 - RMA Replacement</h3>
                      <div className={styles.responseSections}>
                        {renderDeviceFields('Replacement Device', replacementFields, responseClosed)}
                      </div>
                      {renderResponseNote('RMA Response Note', 'rma_response_note')}
                      <div className={styles.actions}>
                        <button type="button" className="primaryButton" onClick={handleReviewRmaResponse} disabled={responseClosed}>
                          Review & Copy RMA Response
                        </button>
                        <button type="button" className="secondaryButton" onClick={closeResponseModal}>Close</button>
                      </div>
                    </SpotlightPanel>
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
              <button type="submit" className="primaryButton" disabled={updatingTicket}>
                {updatingTicket ? 'Updating...' : 'Update Ticket'}
              </button>
              <button type="button" className="secondaryButton" onClick={closeEditModal} disabled={updatingTicket}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirmTicket && (
        <Modal title="Delete this record?" onClose={closeDeleteConfirm}>
          <p className="mutedText">This action cannot be undone.</p>
          <div className={styles.actions}>
            <button type="button" className="secondaryButton" onClick={closeDeleteConfirm} disabled={deletingTicket}>Cancel</button>
            <button type="button" className="dangerButton" onClick={handleConfirmDeleteTicket} disabled={deletingTicket}>
              {deletingTicket ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
