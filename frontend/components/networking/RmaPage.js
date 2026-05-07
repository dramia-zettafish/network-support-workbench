'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { copyTextToClipboard } from '../../lib/clipboard';
import DataTable from '../ui/DataTable';
import Modal from '../ui/Modal';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import styles from './RmaPage.module.css';

const emptyRma = {
  ticket_number: '',
  customer: '',
  campus: '',
  dynamics_case_number: '',
  part_number_model: '',
  defective_serial_number: '',
  issue: ''
};

function buildRmaEmailPrompt(rma) {
  return [
    'Hello,',
    '',
    'Please assist with the following RMA request:',
    '',
    `Customer: ${rma.customer}`,
    `Campus: ${rma.campus}`,
    `Dynamics case#: ${rma.dynamics_case_number}`,
    `Part Number/Model: ${rma.part_number_model}`,
    `Defective SN: ${rma.defective_serial_number}`,
    `Issue: ${rma.issue}`,
    '',
    'Thank you.'
  ].join('\n');
}

function getTicketLabel(ticketNumber, tickets) {
  const ticket = tickets.find((item) => String(item.ticket_number) === String(ticketNumber));
  if (!ticket) return ticketNumber ? `Ticket ${ticketNumber}` : '-';
  return `#${ticket.external_ticket_number || ticket.ticket_number} - ${ticket.school_name}`;
}

export default function RmaPage() {
  const [rmaForm, setRmaForm] = useState(emptyRma);
  const [rmas, setRmas] = useState([]);
  const [openTickets, setOpenTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingRma, setEditingRma] = useState(null);
  const [editForm, setEditForm] = useState(emptyRma);

  useEffect(() => {
    loadRmas();
    loadOpenTickets();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const visibleRmas = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return rmas;
    return rmas.filter((rma) => Object.values(rma).join(' ').toLowerCase().includes(normalizedSearch));
  }, [rmas, search]);

  const rmaColumns = [
    { key: 'dynamics_case_number', label: 'Dynamics Case #' },
    { key: 'customer', label: 'Customer' },
    { key: 'campus', label: 'Campus' },
    { key: 'part_number_model', label: 'Part Number/Model' },
    { key: 'defective_serial_number', label: 'Defective SN' },
    { key: 'ticket_number', label: 'Related Ticket', render: (rma) => getTicketLabel(rma.ticket_number, openTickets) },
    {
      key: 'actions',
      label: 'Actions',
      render: (rma) => (
        <div className={styles.rowActions}>
          <button type="button" onClick={() => openEditModal(rma)}>Edit</button>
          <button type="button" onClick={() => handleDeleteRma(rma.rma_id)}>Delete</button>
        </div>
      )
    }
  ];

  async function loadRmas() {
    setLoading(true);
    try {
      const loadedRmas = await apiRequest('/rmas/');
      setRmas(loadedRmas || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load RMAs.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadOpenTickets() {
    try {
      const params = new URLSearchParams({
        status: 'open',
        limit: '1000',
        offset: '0'
      });
      const loadedTickets = await apiRequest(`/tickets/?${params}`);
      setOpenTickets(loadedTickets || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load open tickets for RMA linking.' });
    }
  }

  async function handleCreateRma(event) {
    event.preventDefault();

    const payload = normalizeRmaPayload(rmaForm);

    try {
      const createdRma = await apiRequest('/rmas/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await copyTextToClipboard(buildRmaEmailPrompt(createdRma));
      setMessage({ type: 'success', text: 'RMA created and email prompt copied to clipboard.' });
      setRmaForm(emptyRma);
      loadRmas();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create RMA.' });
    }
  }

  async function handleUpdateRma(event) {
    event.preventDefault();
    if (!editingRma) return;

    try {
      await apiRequest(`/rmas/${editingRma.rma_id}`, {
        method: 'PUT',
        body: JSON.stringify(normalizeRmaPayload(editForm))
      });
      setMessage({ type: 'success', text: 'RMA updated successfully.' });
      closeEditModal();
      loadRmas();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update RMA.' });
    }
  }

  async function handleDeleteRma(rmaId) {
    if (!window.confirm('Are you sure you want to delete this RMA?')) return;

    try {
      await apiRequest(`/rmas/${rmaId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'RMA deleted successfully.' });
      loadRmas();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete RMA.' });
    }
  }

  function normalizeRmaPayload(form) {
    return {
      ticket_number: form.ticket_number ? Number.parseInt(form.ticket_number, 10) : null,
      customer: form.customer,
      campus: form.campus,
      dynamics_case_number: form.dynamics_case_number,
      part_number_model: form.part_number_model,
      defective_serial_number: form.defective_serial_number,
      issue: form.issue
    };
  }

  function openEditModal(rma) {
    setEditingRma(rma);
    setEditForm({
      ticket_number: rma.ticket_number ? String(rma.ticket_number) : '',
      customer: rma.customer || '',
      campus: rma.campus || '',
      dynamics_case_number: rma.dynamics_case_number || '',
      part_number_model: rma.part_number_model || '',
      defective_serial_number: rma.defective_serial_number || '',
      issue: rma.issue || ''
    });
  }

  function closeEditModal() {
    setEditingRma(null);
    setEditForm(emptyRma);
  }

  function updateForm(setter, field, value) {
    setter((current) => ({ ...current, [field]: value }));
  }

  function renderRmaForm(form, setter, onSubmit, submitLabel) {
    return (
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.formGrid}>
          <label>
            Related Ticket
            <select value={form.ticket_number} onChange={(event) => updateForm(setter, 'ticket_number', event.target.value)}>
              <option value="">None</option>
              {openTickets.map((ticket) => (
                <option key={ticket.ticket_number} value={ticket.ticket_number}>
                  #{ticket.external_ticket_number || ticket.ticket_number} - {ticket.school_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Customer
            <input value={form.customer} onChange={(event) => updateForm(setter, 'customer', event.target.value)} required maxLength={255} />
          </label>
          <label>
            Campus
            <input value={form.campus} onChange={(event) => updateForm(setter, 'campus', event.target.value)} required maxLength={255} />
          </label>
          <label>
            Dynamics Case #
            <input value={form.dynamics_case_number} onChange={(event) => updateForm(setter, 'dynamics_case_number', event.target.value)} required maxLength={32} />
          </label>
          <label>
            Part Number/Model
            <input value={form.part_number_model} onChange={(event) => updateForm(setter, 'part_number_model', event.target.value)} required maxLength={100} />
          </label>
          <label>
            Defective SN
            <input value={form.defective_serial_number} onChange={(event) => updateForm(setter, 'defective_serial_number', event.target.value)} required maxLength={100} />
          </label>
        </div>
        <label>
          Issue
          <textarea value={form.issue} onChange={(event) => updateForm(setter, 'issue', event.target.value)} required maxLength={1000} rows={3} />
        </label>
        <div className={styles.actions}>
          <button type="submit" className="primaryButton">{submitLabel}</button>
        </div>
      </form>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Networking"
        title="RMA"
        description="Track RMA requests and copy the admin-ready prompt after creation."
      />

      <div className={styles.layout}>
        <SectionCard title="Create New RMA" description="Related ticket is internal and is not included in the clipboard prompt.">
          {renderRmaForm(rmaForm, setRmaForm, handleCreateRma, 'Create RMA')}
        </SectionCard>

        <SectionCard
          title="RMAs"
          actions={message && <p className={`${styles.message} ${styles[message.type]}`}>{message.text}</p>}
        >
          <div className={styles.filters}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search RMAs..." />
          </div>
          {loading ? (
            <p className="mutedText">Loading RMAs...</p>
          ) : (
            <DataTable
              columns={rmaColumns}
              rows={visibleRmas}
              getRowKey={(rma) => rma.rma_id}
              emptyTitle="No RMAs found"
              emptyDescription="Create an RMA or adjust the search."
            />
          )}
        </SectionCard>
      </div>

      {editingRma && (
        <Modal title="Edit RMA" onClose={closeEditModal}>
          {renderRmaForm(editForm, setEditForm, handleUpdateRma, 'Update RMA')}
          <div className={styles.actions}>
            <button type="button" onClick={closeEditModal}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}
