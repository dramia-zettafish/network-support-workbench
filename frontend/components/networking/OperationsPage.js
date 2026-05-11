'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { deriveUpsEquipment, getUpsTicketLabel, upsStatusLabelMap, upsStatusToneMap } from '../../lib/upsHelpers';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import StatCard from '../ui/StatCard';
import StatusBadge from '../ui/StatusBadge';
import styles from './OperationsPage.module.css';

const openTicketColumns = [
  { key: 'ticket', label: 'Ticket #' },
  { key: 'school', label: 'School' },
  { key: 'deviceType', label: 'Device Type' },
  { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={row.tone}>{row.status}</StatusBadge> },
  { key: 'age', label: 'Age' }
];

const weeklyInstallColumns = [
  {
    key: 'installDate',
    label: 'Install Date',
    render: (row) => <span className={`${styles.dateBadge} ${row.isToday ? styles.todayBadge : ''}`}>{row.installDate}</span>
  },
  { key: 'school', label: 'School' },
  { key: 'idf', label: 'IDF' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={row.tone}>{row.status}</StatusBadge> }
];

const recentClosedColumns = [
  { key: 'ticket', label: 'Ticket #' },
  { key: 'school', label: 'School' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status', render: (row) => <StatusBadge tone="neutral">{row.status}</StatusBadge> }
];

const deviceTypeLabels = {
  access_point: 'Access Point',
  switch: 'Switch',
  ups: 'UPS'
};

export default function OperationsPage({ onNavigate }) {
  const [tickets, setTickets] = useState([]);
  const [closedTickets, setClosedTickets] = useState([]);
  const [upsPending, setUpsPending] = useState([]);
  const [upsScheduled, setUpsScheduled] = useState([]);
  const [upsServicing, setUpsServicing] = useState([]);
  const [upsCompleted, setUpsCompleted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadOperationsData();
  }, []);

  const openTicketRows = useMemo(() => (
    tickets
      .filter((ticket) => ticket.status === 'open' || ticket.status === 'on_hold')
      .slice(0, 10)
      .map((ticket) => ({
        id: `ticket-${ticket.ticket_number}`,
        ticket: ticket.external_ticket_number || ticket.ticket_number,
        school: ticket.school_name,
        deviceType: deviceTypeLabels[ticket.device_type] || ticket.device_type,
        status: ticket.status === 'on_hold' ? 'On Hold' : 'Open',
        tone: ticket.status === 'on_hold' ? 'warning' : 'info',
        age: getAgeLabel(ticket.date)
      }))
  ), [tickets]);

  const weeklyInstallRows = useMemo(() => {
    const weekRange = getCurrentWorkWeekRange();
    const todayKey = toDateKey(new Date());

    return [...upsScheduled, ...upsServicing]
      .filter((install) => isDateInCurrentWorkWeek(install.proposed_install_date, weekRange))
      .sort((a, b) => String(a.proposed_install_date).localeCompare(String(b.proposed_install_date)))
      .map((install) => ({
        id: install.ups_installation_id,
        installDate: install.proposed_install_date,
        isToday: install.proposed_install_date === todayKey,
        school: install.school_name,
        idf: install.idf || '-',
        equipment: deriveUpsEquipment(install),
        status: upsStatusLabelMap[install.status] || install.status,
        tone: upsStatusToneMap[install.status] || 'neutral'
      }));
  }, [upsScheduled, upsServicing]);

  const recentClosedRows = useMemo(() => {
    const ticketRows = closedTickets.slice(0, 5).map((ticket) => ({
      id: `closed-ticket-${ticket.ticket_number}`,
      ticket: ticket.external_ticket_number || ticket.ticket_number,
      school: ticket.school_name,
      type: deviceTypeLabels[ticket.device_type] || 'Ticket',
      status: 'Closed'
    }));

    const upsRows = upsCompleted.slice(0, 5).map((install) => ({
      id: `closed-ups-${install.ups_installation_id}`,
      ticket: getUpsTicketLabel(install),
      school: install.school_name,
      type: 'UPS Install',
      status: 'Fulfilled'
    }));

    return [...upsRows, ...ticketRows].slice(0, 8);
  }, [closedTickets, upsCompleted]);

  const openTicketCount = tickets.filter((ticket) => ticket.status === 'open').length;
  const onHoldTicketCount = tickets.filter((ticket) => ticket.status === 'on_hold').length;

  async function loadOperationsData() {
    setLoading(true);
    setMessage(null);

    try {
      const [
        openTickets,
        onHoldTickets,
        loadedClosedTickets,
        pendingUps,
        scheduledUps,
        servicingUps,
        completedUps
      ] = await Promise.all([
        apiRequest('/tickets/?status=open&limit=1000&offset=0'),
        apiRequest('/tickets/?status=on_hold&limit=1000&offset=0'),
        apiRequest('/tickets/?status=closed&limit=20&offset=0'),
        apiRequest('/ups-installations/?status=intake&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=scheduled&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=servicing&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=fulfilled&limit=20&offset=0')
      ]);

      setTickets([...(openTickets || []), ...(onHoldTickets || [])]);
      setClosedTickets(loadedClosedTickets || []);
      setUpsPending(pendingUps || []);
      setUpsScheduled(scheduledUps || []);
      setUpsServicing(servicingUps || []);
      setUpsCompleted(completedUps || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load operations dashboard data.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Networking"
        title="Operations"
        description="Weekly view for open tickets, current UPS installs, and recently closed work."
        actions={<button type="button" className="secondaryButton" onClick={loadOperationsData}>Refresh</button>}
      />

      {message && <p className={`${styles.message} ${styles[message.type]}`}>{message.text}</p>}

      <div className={styles.dashboardStack}>
        <section className={styles.sectionGrid}>
          <div className={styles.statRail}>
            <StatCard
              label="Open Tickets"
              value={String(openTicketCount)}
              detail={`${onHoldTicketCount} on hold`}
              status={{ label: 'Ticket Queue', tone: openTicketCount > 0 ? 'info' : 'neutral' }}
            />
            <button type="button" className="primaryButton" onClick={() => onNavigate('tickets')}>
              Create Ticket
            </button>
          </div>

          <SectionCard title="Open / On Hold Tickets" description="Current ticket queue preview.">
            {loading ? (
              <p className="mutedText">Loading tickets...</p>
            ) : openTicketRows.length > 0 ? (
              <DataTable columns={openTicketColumns} rows={openTicketRows} getRowKey={(row) => row.id} />
            ) : (
              <EmptyState title="No open tickets" description="Open and on-hold tickets will appear here." />
            )}
          </SectionCard>
        </section>

        <section className={styles.sectionGrid}>
          <div className={styles.statRail}>
            <StatCard
              label="UPS Pending"
              value={String(upsPending.length)}
              detail="Waiting for NOC schedule"
              status={{ label: 'Queue', tone: upsPending.length > 0 ? 'warning' : 'neutral' }}
            />
            <StatCard
              label="This Week"
              value={String(weeklyInstallRows.length)}
              detail="Current work week installs"
              status={{ label: 'UPS Installs', tone: weeklyInstallRows.length > 0 ? 'success' : 'neutral' }}
            />
            <button type="button" className="secondaryButton" onClick={() => onNavigate('ups')}>Go to UPS</button>
          </div>

          <SectionCard title="UPS This Week" description="Current Monday-Friday install view. Past dates automatically fall off.">
            {loading ? (
              <p className="mutedText">Loading this week's installs...</p>
            ) : weeklyInstallRows.length > 0 ? (
              <DataTable columns={weeklyInstallColumns} rows={weeklyInstallRows} getRowKey={(row) => row.id} />
            ) : (
              <EmptyState title="No UPS installs this week" description="Scheduled UPS installs for the current work week will appear here." />
            )}
          </SectionCard>
        </section>

        <SectionCard title="Recently Closed" description="Recently closed tickets and fulfilled UPS installs.">
          {loading ? (
            <p className="mutedText">Loading recent closed work...</p>
          ) : recentClosedRows.length > 0 ? (
            <DataTable columns={recentClosedColumns} rows={recentClosedRows} getRowKey={(row) => row.id} />
          ) : (
            <EmptyState title="No closed work found" description="Closed tickets and fulfilled UPS installs will appear here." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function getAgeLabel(dateValue) {
  if (!dateValue) return '-';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays > 0) return `${diffDays}d`;
  return `in ${Math.abs(diffDays)}d`;
}

function getCurrentWorkWeekRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const day = today.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: today > monday ? today : monday,
    end: friday
  };
}

function isDateInCurrentWorkWeek(dateValue, weekRange) {
  if (!dateValue) return false;

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  return date >= weekRange.start && date <= weekRange.end;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
