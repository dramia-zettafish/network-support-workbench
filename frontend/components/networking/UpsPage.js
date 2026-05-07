'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { deriveUpsEquipment, getUpsTicketLabel, toggleSelection, upsStatusLabelMap, upsStatusToneMap } from '../../lib/upsHelpers';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import StatusBadge from '../ui/StatusBadge';
import styles from './UpsPage.module.css';

export default function UpsPage() {
  const [pendingInstalls, setPendingInstalls] = useState([]);
  const [inProgressInstalls, setInProgressInstalls] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState(new Set());
  const [selectedInProgressIds, setSelectedInProgressIds] = useState(new Set());

  useEffect(() => {
    loadUpsInstallations();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const visiblePendingInstalls = useMemo(
    () => filterInstallations(pendingInstalls, search),
    [pendingInstalls, search]
  );

  const visibleInProgressInstalls = useMemo(
    () => filterInstallations(inProgressInstalls, search),
    [inProgressInstalls, search]
  );

  const pendingColumns = [
    {
      key: 'select',
      label: 'Select',
      render: (install) => (
        <input
          type="checkbox"
          aria-label={`Select UPS ticket ${getUpsTicketLabel(install)}`}
          checked={selectedPendingIds.has(install.ups_installation_id)}
          onChange={() => toggleSelection(setSelectedPendingIds, install.ups_installation_id)}
        />
      )
    },
    { key: 'ticket', label: 'Ticket #', render: getUpsTicketLabel },
    { key: 'school_name', label: 'School' },
    { key: 'tea_code', label: 'TEA Code' },
    { key: 'idf', label: 'MDF/IDF', render: (install) => install.idf || '-' },
    { key: 'serial_number', label: 'Defective UPS Serial', render: (install) => install.serial_number || '-' },
    { key: 'defective_battery_pack_serial', label: 'Defective BP Serial', render: (install) => install.defective_battery_pack_serial || '-' },
    { key: 'hostname', label: 'Hostname', render: (install) => install.hostname || '-' },
    {
      key: 'status',
      label: 'Status',
      render: (install) => (
        <StatusBadge tone={upsStatusToneMap[install.status] || 'neutral'}>
          {upsStatusLabelMap[install.status] || install.status}
        </StatusBadge>
      )
    }
  ];

  const inProgressColumns = [
    {
      key: 'select',
      label: 'Select',
      render: (install) => (
        <input
          type="checkbox"
          aria-label={`Select in progress UPS ticket ${getUpsTicketLabel(install)}`}
          checked={selectedInProgressIds.has(install.ups_installation_id)}
          onChange={() => toggleSelection(setSelectedInProgressIds, install.ups_installation_id)}
        />
      )
    },
    { key: 'ticket', label: 'Ticket #', render: getUpsTicketLabel },
    { key: 'school_name', label: 'School' },
    { key: 'idf', label: 'IDF', render: (install) => install.idf || '-' },
    { key: 'proposed_install_date', label: 'Install Date', render: (install) => install.proposed_install_date || '-' },
    { key: 'equipment', label: 'Equipment', render: deriveUpsEquipment },
    { key: 'ups_po', label: 'UPS PO', render: (install) => install.ups_po || '-' },
    { key: 'bp_po', label: 'BP PO', render: (install) => install.bp_po || '-' },
    {
      key: 'status',
      label: 'Status',
      render: (install) => (
        <StatusBadge tone={upsStatusToneMap[install.status] || 'neutral'}>
          {upsStatusLabelMap[install.status] || install.status}
        </StatusBadge>
      )
    }
  ];

  async function loadUpsInstallations() {
    setLoading(true);
    try {
      const [pending, inProgress] = await Promise.all([
        apiRequest('/ups-installations/?status=intake&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=scheduled&limit=1000&offset=0')
      ]);
      setPendingInstalls(pending || []);
      setInProgressInstalls(inProgress || []);
      setSelectedPendingIds(new Set());
      setSelectedInProgressIds(new Set());
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load UPS installations.' });
    } finally {
      setLoading(false);
    }
  }

  function filterInstallations(installs, currentSearch) {
    const normalizedSearch = currentSearch.trim().toLowerCase();
    if (!normalizedSearch) return installs;
    return installs.filter((install) => Object.values(install).join(' ').toLowerCase().includes(normalizedSearch));
  }

  return (
    <>
      <PageHeader
        eyebrow="Networking"
        title="UPS"
        description="Foundation view for UPS pending installs and in-progress work. Scheduling, warehouse email, and phase actions are intentionally not wired in this pass."
        actions={<button type="button" onClick={loadUpsInstallations}>Refresh</button>}
      />

      <div className={styles.toolbar}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search UPS installations..." />
        {message && <p className={`${styles.message} ${styles[message.type]}`}>{message.text}</p>}
      </div>

      <div className={styles.summaryGrid}>
        <SectionCard title="Pending">
          <strong className={styles.summaryValue}>{pendingInstalls.length}</strong>
          <p className="mutedText">Records waiting for scheduling.</p>
        </SectionCard>
        <SectionCard title="In Progress">
          <strong className={styles.summaryValue}>{inProgressInstalls.length}</strong>
          <p className="mutedText">Scheduled records awaiting fulfillment.</p>
        </SectionCard>
        <SectionCard title="Selected">
          <strong className={styles.summaryValue}>{selectedPendingIds.size + selectedInProgressIds.size}</strong>
          <p className="mutedText">Selection state only; bulk actions come next.</p>
        </SectionCard>
      </div>

      <div className={styles.tables}>
        <SectionCard
          title="Pending Installs"
          description="Selection is ready for the future NOC schedule workflow."
          actions={<SelectionHint count={selectedPendingIds.size} label="pending selected" />}
        >
          {loading ? (
            <p className="mutedText">Loading pending UPS installs...</p>
          ) : visiblePendingInstalls.length > 0 ? (
            <DataTable columns={pendingColumns} rows={visiblePendingInstalls} getRowKey={(install) => install.ups_installation_id} />
          ) : (
            <EmptyState title="No pending UPS installs" description="Create a UPS ticket to populate this queue." />
          )}
        </SectionCard>

        <SectionCard
          title="In Progress"
          description="Selection is ready for the future warehouse and completion workflows."
          actions={<SelectionHint count={selectedInProgressIds.size} label="in progress selected" />}
        >
          {loading ? (
            <p className="mutedText">Loading in-progress UPS installs...</p>
          ) : visibleInProgressInstalls.length > 0 ? (
            <DataTable columns={inProgressColumns} rows={visibleInProgressInstalls} getRowKey={(install) => install.ups_installation_id} />
          ) : (
            <EmptyState title="No in-progress UPS installs" description="Scheduled UPS records will appear here." />
          )}
        </SectionCard>
      </div>
    </>
  );
}

function SelectionHint({ count, label }) {
  return count > 0 ? <StatusBadge tone="info">{count} {label}</StatusBadge> : <StatusBadge>0 selected</StatusBadge>;
}
