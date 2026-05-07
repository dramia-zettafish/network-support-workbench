'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
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
          <button type="button" onClick={() => openEditModal(ticket)}>Edit</button>
          <button type="button" onClick={() => handleDeleteTicket(ticket.ticket_number)}>Delete</button>
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

  async function handleDeleteTicket(ticketNumber) {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;

    try {
      await apiRequest(`/tickets/${ticketNumber}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Ticket deleted successfully.' });
      loadTickets();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete ticket.' });
    }
  }

  function openEditModal(ticket) {
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
