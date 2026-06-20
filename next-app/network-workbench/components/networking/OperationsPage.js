'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { moduleHref } from '../../lib/networkRoutes';
import { isScreenshotMode } from '../../lib/publicConfig';
import { getScreenshotOperationsData } from '../../lib/screenshotData';
import { deriveUpsEquipment, upsStatusLabelMap, upsStatusToneMap } from '../../lib/upsHelpers';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import StatCard from '../ui/StatCard';
import StatusBadge from '../ui/StatusBadge';
import { useToast } from '../ui/ToastProvider';
import styles from './OperationsPage.module.css';

const openTicketColumns = [
  { key: 'ticket', label: 'Ticket #' },
  { key: 'school', label: 'School' },
  {
    key: 'deviceType',
    label: 'Device Type',
    render: (row) => <span className={`${styles.devicePill} ${styles[row.deviceTypeKey] || ''}`}>{row.deviceType}</span>
  },
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

const deviceTypeLabels = {
  access_point: 'Access Point',
  switch: 'Switch',
  ups: 'UPS'
};

export default function OperationsPage({ onNavigate }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [upsPending, setUpsPending] = useState([]);
  const [upsScheduled, setUpsScheduled] = useState([]);
  const [upsServicing, setUpsServicing] = useState([]);
  const [upsConfirmIp, setUpsConfirmIp] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    loadOperationsData();
  }, []);

  const openTicketRows = useMemo(() => (
    tickets
      .filter((ticket) => ticket.status === 'open' || ticket.status === 'on_hold')
      .slice(0, 10)
      .map((ticket) => ({
        id: `ticket-${ticket.ticket_number}`,
        ticketRecord: ticket,
        ticket: ticket.external_ticket_number || ticket.ticket_number,
        school: ticket.school_name,
        deviceTypeKey: ticket.device_type,
        deviceType: deviceTypeLabels[ticket.device_type] || ticket.device_type,
        status: ticket.status === 'on_hold' ? 'On Hold' : 'Open',
        tone: ticket.status === 'on_hold' ? 'warning' : 'info',
        age: getAgeLabel(ticket.date)
      }))
  ), [tickets]);

  const weeklyInstallRows = useMemo(() => {
    const weekRange = getCurrentWorkWeekRange();
    const todayKey = toDateKey(new Date());

    return [...upsScheduled, ...upsServicing, ...upsConfirmIp]
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
  }, [upsScheduled, upsServicing, upsConfirmIp]);

  const openTicketCount = tickets.filter((ticket) => ticket.status === 'open').length;
  const onHoldTicketCount = tickets.filter((ticket) => ticket.status === 'on_hold').length;
  const activeUpsCount = upsScheduled.length + upsServicing.length + upsConfirmIp.length;

  async function loadOperationsData() {
    setLoading(true);
    setLoadFailed(false);

    if (isScreenshotMode) {
      const screenshotData = getScreenshotOperationsData();
      setTickets(screenshotData.tickets);
      setUpsPending(screenshotData.upsPending);
      setUpsScheduled(screenshotData.upsScheduled);
      setUpsServicing(screenshotData.upsServicing);
      setUpsConfirmIp([]);
      setLoading(false);
      return;
    }

    try {
      const [
        openTickets,
        onHoldTickets,
        pendingUps,
        scheduledUps,
        servicingUps,
        confirmIpUps
      ] = await Promise.all([
        apiRequest('/tickets/?status=open&limit=1000&offset=0'),
        apiRequest('/tickets/?status=on_hold&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=intake&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=scheduled&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=servicing&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=confirm_ip&limit=1000&offset=0')
      ]);

      setTickets([...(openTickets || []), ...(onHoldTickets || [])]);
      setUpsPending(pendingUps || []);
      setUpsScheduled(scheduledUps || []);
      setUpsServicing(servicingUps || []);
      setUpsConfirmIp(confirmIpUps || []);
    } catch (error) {
      setLoadFailed(true);
      showToast({
        type: 'error',
        title: 'Dashboard failed to load',
        message: 'Retry the dashboard data when you are ready.'
      });
    } finally {
      setLoading(false);
    }
  }

  function navigate(moduleId, context = null) {
    if (onNavigate) {
      onNavigate(moduleId, context);
      return;
    }

    const href = moduleHref(moduleId);
    if (moduleId === 'tickets' && context?.openTicket?.ticket_number) {
      router.push(`${href}?ticket=${context.openTicket.ticket_number}`);
      return;
    }
    router.push(href);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Networking"
        title="Network Operations"
        description="Weekly view for open tickets, current UPS installs, and recently closed work."
        actions={<button type="button" className="secondaryButton" onClick={loadOperationsData}>Refresh</button>}
      />

      <div className={styles.dashboardStack}>
        <div className={styles.overviewGrid}>
          <StatCard
            label="Open Tickets"
            value={String(openTicketCount)}
            detail="Open network tickets"
            status={{ label: 'Ticket Queue', tone: openTicketCount > 0 ? 'info' : 'neutral' }}
          />
          <StatCard
            label="On Hold"
            value={String(onHoldTicketCount)}
            detail="Waiting on follow-up"
            status={{ label: 'Ticket Queue', tone: onHoldTicketCount > 0 ? 'warning' : 'neutral' }}
          />
          <StatCard
            label="UPS Pending"
            value={String(upsPending.length)}
            detail="Waiting for NOC schedule"
            status={{ label: 'Queue', tone: upsPending.length > 0 ? 'warning' : 'neutral' }}
          />
          <StatCard
            label="UPS This Week"
            value={String(weeklyInstallRows.length)}
            detail={`${activeUpsCount} active UPS records`}
            status={{ label: 'Installs', tone: weeklyInstallRows.length > 0 ? 'success' : 'neutral' }}
          />
        </div>

        <SectionCard title="Open / On Hold Tickets" description="Current ticket queue preview." spotlight spotlightMode="interactive">
          {loading ? (
            <p className="mutedText">Loading tickets...</p>
          ) : loadFailed ? (
            <div className={styles.retryState}>
              <p className="mutedText">Failed to load tickets.</p>
              <button type="button" className="secondaryButton" onClick={loadOperationsData}>Retry</button>
            </div>
          ) : openTicketRows.length > 0 ? (
            <DataTable
              columns={openTicketColumns}
              rows={openTicketRows}
              getRowKey={(row) => row.id}
              onRowClick={(row) => navigate('tickets', { openTicket: row.ticketRecord })}
            />
          ) : (
            <EmptyState title="No open tickets" description="Open and on-hold tickets will appear here." />
          )}
        </SectionCard>

        <SectionCard title="UPS This Week" description="Current Monday-Friday install view. Past dates automatically fall off." spotlight spotlightMode="interactive">
          {loading ? (
            <p className="mutedText">Loading this week's installs...</p>
          ) : loadFailed ? (
            <div className={styles.retryState}>
              <p className="mutedText">Failed to load UPS installs.</p>
              <button type="button" className="secondaryButton" onClick={loadOperationsData}>Retry</button>
            </div>
          ) : weeklyInstallRows.length > 0 ? (
            <DataTable columns={weeklyInstallColumns} rows={weeklyInstallRows} getRowKey={(row) => row.id} onRowClick={() => navigate('ups')} />
          ) : (
            <EmptyState title="No UPS installs this week" description="Scheduled UPS installs for the current work week will appear here." />
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
