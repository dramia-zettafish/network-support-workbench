'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { copyHtmlToClipboard } from '../../lib/clipboard';
import { moduleHref } from '../../lib/networkRoutes';
import { deriveUpsEquipment, getUpsTicketLabel, toggleSelection, upsStatusLabelMap, upsStatusToneMap } from '../../lib/upsHelpers';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import StatusBadge from '../ui/StatusBadge';
import { useToast } from '../ui/ToastProvider';
import UpsStatusStepper from '../ups/UpsStatusStepper';
import styles from './UpsPage.module.css';

const emptyFulfillmentForm = {
  new_asset_tag: '',
  new_serial_number: '',
  new_webcard_serial: '',
  new_mac_address: '',
  snmp_ip: '',
  new_battery_pack_serial: '',
  new_battery_pack_asset_tag: ''
};

const completedInstallLimit = 10;

const completedEditableFields = [
  ['asset_tag', 'Defective Asset Tag #'],
  ['mac_address', 'Defective MAC'],
  ['new_asset_tag', 'Replacement Asset Tag #'],
  ['new_serial_number', 'UPS SN'],
  ['new_webcard_serial', 'SNMPWEBCARD SN'],
  ['new_mac_address', 'Replacement MAC'],
  ['snmp_ip', 'SNMP IP'],
  ['new_battery_pack_serial', 'BP SN'],
  ['new_battery_pack_asset_tag', 'BP Asset Tag #'],
  ['ups_po', 'UPS PO'],
  ['bp_po', 'BP PO']
];

function getNextMondayIsoDate() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  date.setDate(date.getDate() + daysUntilNextMonday);
  return date.toISOString().slice(0, 10);
}

export default function UpsPage({ onNavigate }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pendingInstalls, setPendingInstalls] = useState([]);
  const [inProgressInstalls, setInProgressInstalls] = useState([]);
  const [completedInstalls, setCompletedInstalls] = useState([]);
  const [completedSearch, setCompletedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState(new Set());
  const [selectedInProgressIds, setSelectedInProgressIds] = useState(new Set());
  const [scheduleRows, setScheduleRows] = useState([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [warehouseRows, setWarehouseRows] = useState([]);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [fulfillmentInstall, setFulfillmentInstall] = useState(null);
  const [fulfillmentForm, setFulfillmentForm] = useState(emptyFulfillmentForm);
  const [completedSummaryInstall, setCompletedSummaryInstall] = useState(null);
  const [completedSummaryEditing, setCompletedSummaryEditing] = useState(false);
  const [completedSummaryForm, setCompletedSummaryForm] = useState({});
  const [returnToServicingConfirmOpen, setReturnToServicingConfirmOpen] = useState(false);
  const [returningToServicing, setReturningToServicing] = useState(false);

  useEffect(() => {
    loadUpsInstallations();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadCompletedInstallations(completedSearch);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [completedSearch]);

  const visiblePendingInstalls = useMemo(
    () => pendingInstalls,
    [pendingInstalls]
  );

  const visibleInProgressInstalls = useMemo(
    () => inProgressInstalls,
    [inProgressInstalls]
  );

  const visibleCompletedInstalls = useMemo(() => completedInstalls, [completedInstalls]);

  const visibleScheduledInProgressIds = useMemo(
    () => visibleInProgressInstalls
      .filter((install) => install.status === 'scheduled')
      .map((install) => install.ups_installation_id),
    [visibleInProgressInstalls]
  );

  const selectedScheduledInProgressCount = useMemo(
    () => visibleScheduledInProgressIds.filter((id) => selectedInProgressIds.has(id)).length,
    [selectedInProgressIds, visibleScheduledInProgressIds]
  );

  const allVisibleScheduledSelected =
    visibleScheduledInProgressIds.length > 0 &&
    selectedScheduledInProgressCount === visibleScheduledInProgressIds.length;

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
          onClick={(event) => event.stopPropagation()}
          onChange={() => toggleSelection(setSelectedInProgressIds, install.ups_installation_id)}
        />
      )
    },
    { key: 'ticket', label: 'Ticket #', render: getUpsTicketLabel },
    { key: 'school_name', label: 'School' },
    { key: 'idf', label: 'IDF', render: (install) => install.idf || '-' },
    {
      key: 'proposed_install_date',
      label: 'Install Date',
      render: (install) => <DateBadge value={install.proposed_install_date} />
    },
    { key: 'equipment', label: 'Equipment', render: deriveUpsEquipment },
    {
      key: 'status',
      label: 'Status',
      render: (install) => (
        <StatusBadge tone={upsStatusToneMap[install.status] || 'neutral'}>
          {upsStatusLabelMap[install.status] || install.status}
        </StatusBadge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (install) => (
        <div className={styles.rowActions}>
          <button type="button" className="dangerButton compactButton" onClick={(event) => handleRollbackFromRow(event, install)}>
            Remove
          </button>
        </div>
      )
    }
  ];

  const completedColumns = [
    { key: 'ticket', label: 'Ticket #', render: getUpsTicketLabel },
    { key: 'school_name', label: 'School' },
    { key: 'new_serial_number', label: 'UPS SN', render: (install) => install.new_serial_number || '-' },
    { key: 'new_mac_address', label: 'MAC', render: (install) => install.new_mac_address || '-' },
    { key: 'snmp_ip', label: 'IP', render: (install) => install.snmp_ip || '-' }
  ];

  function notify(type, title, message = '') {
    showToast({ type, title, message });
  }

  async function loadUpsInstallations() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [pending, scheduled, servicing, completed] = await Promise.all([
        apiRequest('/ups-installations/?status=intake&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=scheduled&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=servicing&limit=1000&offset=0'),
        apiRequest(`/ups-installations/?status=fulfilled&limit=${completedInstallLimit}&offset=0`)
      ]);
      setPendingInstalls(pending || []);
      setInProgressInstalls([...(scheduled || []), ...(servicing || [])]);
      setCompletedInstalls(completed || []);
      setSelectedPendingIds(new Set());
      setSelectedInProgressIds(new Set());
    } catch (error) {
      setLoadFailed(true);
      notify('error', 'UPS records failed to load', 'Use Retry to load the UPS queues again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCompletedInstallations(currentSearch) {
    try {
      const searchParam = currentSearch.trim() ? `&search=${encodeURIComponent(currentSearch.trim())}` : '';
      const completed = await apiRequest(`/ups-installations/?status=fulfilled&limit=${completedInstallLimit}&offset=0${searchParam}`);
      setCompletedInstalls(completed || []);
    } catch (error) {
      notify('error', 'Completed UPS search failed', 'Try the search again or clear the search field.');
    }
  }

  function openScheduleModal() {
    const selectedRows = pendingInstalls
      .filter((install) => selectedPendingIds.has(install.ups_installation_id))
      .map((install) => ({
        ups_installation_id: install.ups_installation_id,
        ticket_number: getUpsTicketLabel(install),
        idf: install.idf || '',
        school_name: install.school_name,
        proposed_install_date: install.proposed_install_date || getNextMondayIsoDate(),
        equipment: deriveUpsEquipment(install)
      }));

    if (selectedRows.length === 0) {
      notify('warning', 'Select pending UPS records', 'Choose at least one pending record before generating the NOC schedule.');
      return;
    }

    setScheduleRows(selectedRows);
    setScheduleModalOpen(true);
  }

  function closeScheduleModal() {
    setScheduleModalOpen(false);
    setScheduleRows([]);
  }

  function updateScheduleRowDate(upsInstallationId, proposedInstallDate) {
    setScheduleRows((currentRows) =>
      currentRows.map((row) =>
        row.ups_installation_id === upsInstallationId
          ? { ...row, proposed_install_date: proposedInstallDate }
          : row
      )
    );
  }

  async function handleRollbackFromRow(event, install) {
    event.stopPropagation();
    try {
      await apiRequest(`/ups/${install.ups_installation_id}/rollback`, { method: 'PATCH' });
      notify('success', 'UPS returned to Pending');
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to return UPS to Pending');
    }
  }

  async function handleMoveToInProgress() {
    if (scheduleRows.length === 0) return;

    try {
      const sortedRows = sortScheduleRowsByDate(scheduleRows);
      const scheduleResponse = await apiRequest('/ups/schedule/custom', {
        method: 'POST',
        body: JSON.stringify({
          rows: sortedRows.map((row) => ({
            ups_installation_id: row.ups_installation_id,
            proposed_install_date: row.proposed_install_date
          }))
        })
      });

      const copiedRows = sortScheduleRowsByDate(scheduleResponse.rows || []);
      await copyHtmlToClipboard(
        buildScheduleHtmlTable(copiedRows),
        buildScheduleTextTable(copiedRows)
      );
      notify('success', 'NOC schedule copied', 'Selected UPS records moved to In Progress.');
      closeScheduleModal();
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to move UPS records', 'The selected records were not moved to In Progress.');
    }
  }

  function buildScheduleHtmlTable(rows) {
    const headers = ['Ticket #', 'IDF', 'School Name', 'Install Contact', 'Install Contact #', 'Proposed Install Date', 'Type', 'Equipment'];
    const bodyRows = rows.map((row) => [
      row.ticket_number,
      row.idf || '',
      row.school_name,
      row.install_contact || '',
      row.install_contact_number || '',
      row.proposed_install_date,
      row.type || 'Replace',
      row.equipment
    ]);

    return `
      <table border="1" cellspacing="0" cellpadding="6">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeTableValue(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeTableValue(cell)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  function buildScheduleTextTable(rows) {
    const headers = ['Ticket #', 'IDF', 'School Name', 'Install Contact', 'Install Contact #', 'Proposed Install Date', 'Type', 'Equipment'];
    const bodyRows = rows.map((row) => [
      row.ticket_number,
      row.idf || '',
      row.school_name,
      row.install_contact || '',
      row.install_contact_number || '',
      row.proposed_install_date,
      row.type || 'Replace',
      row.equipment
    ]);

    return [headers, ...bodyRows].map((row) => row.map((cell) => cell || '').join('\t')).join('\n');
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

  function openWarehouseModal() {
    const rows = inProgressInstalls
      .filter((install) => install.status === 'scheduled' && selectedInProgressIds.has(install.ups_installation_id))
      .map((install) => ({
        ups_installation_id: install.ups_installation_id,
        ticket_number: getUpsTicketLabel(install),
        idf: warehouseValue(install.idf),
        school_name: install.school_name,
        install_date: warehouseValue(install.proposed_install_date),
        type: 'Replace',
        equipment: deriveUpsEquipment(install),
        ups_serial: 'N/A',
        ups_po: warehouseValue(install.ups_po),
        bp_serials: 'N/A',
        bp_po: warehouseValue(install.bp_po)
      }));

    if (rows.length === 0) {
      notify('warning', 'Select scheduled UPS records', 'Choose at least one scheduled record before copying the warehouse table.');
      return;
    }

    setWarehouseRows(rows);
    setWarehouseModalOpen(true);
  }

  function closeWarehouseModal() {
    setWarehouseModalOpen(false);
    setWarehouseRows([]);
    setSelectedInProgressIds(new Set());
  }

  function updateWarehouseRow(upsInstallationId, field, value) {
    setWarehouseRows((currentRows) =>
      currentRows.map((row) =>
        row.ups_installation_id === upsInstallationId ? { ...row, [field]: value } : row
      )
    );
  }

  function handleToggleVisibleScheduledSelection() {
    setSelectedInProgressIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (allVisibleScheduledSelected) {
        visibleScheduledInProgressIds.forEach((id) => nextIds.delete(id));
      } else {
        visibleScheduledInProgressIds.forEach((id) => nextIds.add(id));
      }

      return nextIds;
    });
  }

  function openFulfillmentModal(install) {
    setFulfillmentInstall(install);
    setFulfillmentForm({
      new_asset_tag: install.new_asset_tag || '',
      new_serial_number: install.new_serial_number || '',
      new_webcard_serial: install.new_webcard_serial || '',
      new_mac_address: install.new_mac_address || '',
      snmp_ip: install.snmp_ip || '',
      new_battery_pack_serial: install.new_battery_pack_serial || '',
      new_battery_pack_asset_tag: install.new_battery_pack_asset_tag || ''
    });
  }

  function closeFulfillmentModal() {
    setFulfillmentInstall(null);
    setFulfillmentForm(emptyFulfillmentForm);
  }

  function closeCompletedSummaryModal() {
    setCompletedSummaryInstall(null);
    setCompletedSummaryEditing(false);
    setCompletedSummaryForm({});
    setReturnToServicingConfirmOpen(false);
  }

  function updateFulfillmentForm(field, value) {
    setFulfillmentForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveFulfillment(event) {
    event.preventDefault();
    if (!fulfillmentInstall) return;

    try {
      const updatedInstall = await apiRequest(`/ups-installations/${fulfillmentInstall.ups_installation_id}/phase3-devices`, {
        method: 'PATCH',
        body: JSON.stringify(normalizeFulfillmentPayload(fulfillmentForm))
      });
      await apiRequest(`/ups-installations/${updatedInstall.ups_installation_id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'fulfilled' })
      });
      notify('success', 'UPS fulfillment saved', 'The record moved to Completed.');
      closeFulfillmentModal();
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to complete UPS record');
    }
  }

  function normalizeFulfillmentPayload(form) {
    return Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim() || null])
    );
  }

  function openCompletedSummaryModal(install) {
    setCompletedSummaryInstall(install);
    setCompletedSummaryEditing(false);
    setCompletedSummaryForm(buildCompletedSummaryForm(install));
  }

  function buildCompletedSummaryForm(install) {
    return Object.fromEntries(
      completedEditableFields.map(([field]) => [field, install?.[field] || ''])
    );
  }

  function updateCompletedSummaryForm(field, value) {
    setCompletedSummaryForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveCompletedSummary() {
    if (!completedSummaryInstall) return;

    try {
      const updatedInstall = await apiRequest(`/ups-installations/${completedSummaryInstall.ups_installation_id}`, {
        method: 'PUT',
        body: JSON.stringify(normalizeFulfillmentPayload(completedSummaryForm))
      });
      setCompletedSummaryInstall(updatedInstall);
      setCompletedSummaryForm(buildCompletedSummaryForm(updatedInstall));
      setCompletedSummaryEditing(false);
      notify('success', 'Completed UPS details updated');
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to update completed UPS details');
    }
  }

  function openReturnToServicingConfirm() {
    setReturnToServicingConfirmOpen(true);
  }

  function closeReturnToServicingConfirm() {
    if (returningToServicing) return;
    setReturnToServicingConfirmOpen(false);
  }

  async function handleReturnToServicing() {
    if (!completedSummaryInstall) return;

    try {
      setReturningToServicing(true);
      await apiRequest(`/ups-installations/${completedSummaryInstall.ups_installation_id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'servicing' })
      });
      notify('success', 'UPS returned to Servicing');
      closeCompletedSummaryModal();
      loadUpsInstallations();
    } catch (error) {
      setReturnToServicingConfirmOpen(false);
      notify('error', 'Failed to return UPS to Servicing', 'The UPS details modal stayed open so you can retry.');
    } finally {
      setReturningToServicing(false);
    }
  }

  async function handleCopyWarehouseTable() {
    try {
      const normalizedRows = warehouseRows.map((row) => ({
        ...row,
        ups_po: warehouseValue(row.ups_po),
        bp_po: warehouseValue(row.bp_po)
      }));

      await Promise.all(
        normalizedRows.map((row) =>
          apiRequest(`/ups-installations/${row.ups_installation_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              ups_po: row.ups_po,
              bp_po: row.bp_po,
              status: 'servicing'
            })
          })
        )
      );
      await copyHtmlToClipboard(
        buildWarehouseHtmlTable(normalizedRows),
        buildWarehouseTextTable(normalizedRows)
      );
      notify('success', 'Warehouse table copied', 'Selected UPS records were marked Servicing.');
      setSelectedInProgressIds(new Set());
      closeWarehouseModal();
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to copy warehouse table');
    }
  }

  function getWarehouseWarnings(row) {
    const warnings = [];
    if (!row.install_date) warnings.push('Missing install date');
    if (!row.idf) warnings.push('Missing IDF');
    return warnings;
  }

  function warehouseValue(value) {
    const normalized = String(value || '').trim();
    return normalized || 'N/A';
  }

  function buildWarehouseHtmlTable(rows) {
    const headers = ['Ticket #', 'IDF', 'School Name', 'Install Date', 'Type', 'Equipment', 'UPS Serial', 'UPS PO', 'BP Serial(s)', 'BP PO'];
    const bodyRows = rows.map((row) => [
      row.ticket_number,
      row.idf,
      row.school_name,
      row.install_date,
      row.type,
      row.equipment,
      row.ups_serial,
      row.ups_po,
      row.bp_serials,
      row.bp_po
    ]);

    return `
      <table border="1" cellspacing="0" cellpadding="6">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeTableValue(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeTableValue(warehouseValue(cell))}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  function buildWarehouseTextTable(rows) {
    const headers = ['Ticket #', 'IDF', 'School Name', 'Install Date', 'Type', 'Equipment', 'UPS Serial', 'UPS PO', 'BP Serial(s)', 'BP PO'];
    const bodyRows = rows.map((row) => [
      row.ticket_number,
      row.idf,
      row.school_name,
      row.install_date,
      row.type,
      row.equipment,
      row.ups_serial,
      row.ups_po,
      row.bp_serials,
      row.bp_po
    ]);

    return [headers, ...bodyRows].map((row) => row.map((cell) => warehouseValue(cell)).join('\t')).join('\n');
  }

  function escapeTableValue(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function handleDashboardClick() {
    if (onNavigate) {
      onNavigate('operations');
      return;
    }
    router.push(moduleHref('dashboard'));
  }

  return (
    <>
      <PageHeader
        eyebrow="Networking"
        title="UPS"
        description="Track UPS installs from intake through scheduling, warehouse coordination, fulfillment, and completion."
        actions={
          <>
            <button type="button" className="secondaryButton" onClick={handleDashboardClick}>Dashboard</button>
            <button type="button" className="secondaryButton" onClick={loadUpsInstallations} disabled={loading}>Refresh</button>
          </>
        }
      />

      <div className={styles.summaryGrid}>
        <SectionCard title="Pending">
          <strong className={styles.summaryValue}>{pendingInstalls.length}</strong>
          <p className="mutedText">Records waiting for scheduling.</p>
        </SectionCard>
        <SectionCard title="In Progress">
          <strong className={styles.summaryValue}>{inProgressInstalls.length}</strong>
          <p className="mutedText">Scheduled records awaiting fulfillment.</p>
        </SectionCard>
        <SectionCard title="Completed">
          <strong className={styles.summaryValue}>{completedInstalls.length}</strong>
          <p className="mutedText">Fulfilled UPS records.</p>
        </SectionCard>
        <SectionCard title="Selected">
          <strong className={styles.summaryValue}>{selectedPendingIds.size + selectedInProgressIds.size}</strong>
          <p className="mutedText">Selected for schedule, warehouse, or completion actions.</p>
        </SectionCard>
      </div>

      <div className={styles.tables}>
        <SectionCard
          title="Pending Installs"
          description="Select pending records to build the NOC schedule and move them to In Progress."
          actions={
            <div className={styles.sectionActions}>
              <SelectionHint count={selectedPendingIds.size} label="pending selected" />
              {selectedPendingIds.size > 0 && (
                <button type="button" className="primaryButton" onClick={openScheduleModal}>
                  Generate NOC Schedule
                </button>
              )}
            </div>
          }
        >
          {loading ? (
            <p className="mutedText">Loading pending UPS installs...</p>
          ) : loadFailed ? (
            <RetryState onRetry={loadUpsInstallations} text="Failed to load pending UPS installs." />
          ) : visiblePendingInstalls.length > 0 ? (
            <DataTable columns={pendingColumns} rows={visiblePendingInstalls} getRowKey={(install) => install.ups_installation_id} />
          ) : (
            <EmptyState title="No pending UPS installs" description="Create a UPS ticket to populate this queue." />
          )}
        </SectionCard>

        <SectionCard
          title="In Progress"
          description="Select scheduled records to copy the warehouse table. Servicing rows open fulfillment and move to Completed from the modal."
          actions={
            <div className={styles.sectionActions}>
              <SelectionHint count={selectedInProgressIds.size} label="in progress selected" />
              {visibleScheduledInProgressIds.length > 0 && (
                <button type="button" className="secondaryButton" onClick={handleToggleVisibleScheduledSelection}>
                  {allVisibleScheduledSelected ? 'Clear All' : 'Select All'}
                </button>
              )}
              {selectedScheduledInProgressCount > 0 && (
                <button type="button" className="primaryButton" onClick={openWarehouseModal}>
                  Copy Warehouse Table
                </button>
              )}
            </div>
          }
        >
          {loading ? (
            <p className="mutedText">Loading in-progress UPS installs...</p>
          ) : loadFailed ? (
            <RetryState onRetry={loadUpsInstallations} text="Failed to load in-progress UPS installs." />
          ) : visibleInProgressInstalls.length > 0 ? (
            <DataTable
              columns={inProgressColumns}
              rows={visibleInProgressInstalls}
              getRowKey={(install) => install.ups_installation_id}
              onRowClick={openFulfillmentModal}
              canClickRow={(install) => install.status === 'servicing'}
            />
          ) : (
            <EmptyState title="No in-progress UPS installs" description="Scheduled UPS records will appear here." />
          )}
        </SectionCard>

        <SectionCard
          title="Completed"
          description="Fulfilled UPS records stay here for quick reference."
          actions={
            <input
              className={styles.completedSearch}
              value={completedSearch}
              onChange={(event) => setCompletedSearch(event.target.value)}
              placeholder="Search completed UPS..."
            />
          }
        >
          {loading ? (
            <p className="mutedText">Loading completed UPS installs...</p>
          ) : loadFailed ? (
            <RetryState onRetry={loadUpsInstallations} text="Failed to load completed UPS installs." />
          ) : visibleCompletedInstalls.length > 0 ? (
            <DataTable
              columns={completedColumns}
              rows={visibleCompletedInstalls}
              getRowKey={(install) => install.ups_installation_id}
              onRowClick={openCompletedSummaryModal}
            />
          ) : (
            <EmptyState title="No completed UPS installs" description="Move fulfilled UPS records from In Progress when the install is complete." />
          )}
        </SectionCard>
      </div>

      {scheduleModalOpen && (
        <Modal title="NOC Schedule" onClose={closeScheduleModal}>
          <p className="mutedText">Review install dates, then move selected records to In Progress. The schedule table will be copied for Outlook.</p>
          <div className={styles.scheduleRows}>
            {scheduleRows.map((row) => (
              <div key={row.ups_installation_id} className={styles.scheduleRow}>
                <div>
                  <strong>Ticket #{row.ticket_number}</strong>
                  <span>{row.school_name}</span>
                  <span>IDF: {row.idf || '-'}</span>
                  <span>{row.equipment}</span>
                </div>
                <label>
                  Proposed Install Date
                  <input
                    type="date"
                    value={row.proposed_install_date}
                    onChange={(event) => updateScheduleRowDate(row.ups_installation_id, event.target.value)}
                    required
                  />
                </label>
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className="primaryButton" onClick={handleMoveToInProgress}>
              Move to In Progress
            </button>
            <button type="button" className="secondaryButton" onClick={closeScheduleModal}>Cancel</button>
          </div>
        </Modal>
      )}

      {warehouseModalOpen && (
        <Modal title="Warehouse Email Preview" onClose={closeWarehouseModal}>
          <p className="mutedText">Review the table below before copying it for Outlook. Blank serial columns are intentional for Warehouse.</p>
          <div className={styles.warningList}>
            {warehouseRows.flatMap((row) =>
              getWarehouseWarnings(row).map((warning) => (
                <p key={`${row.ups_installation_id}-${warning}`}>Ticket #{row.ticket_number}: {warning}</p>
              ))
            )}
          </div>
          <div className={styles.previewTableWrap}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>IDF</th>
                  <th>School Name</th>
                  <th>Install Date</th>
                  <th>Type</th>
                  <th>Equipment</th>
                  <th>UPS Serial</th>
                  <th>UPS PO</th>
                  <th>BP Serial(s)</th>
                  <th>BP PO</th>
                </tr>
              </thead>
              <tbody>
                {warehouseRows.map((row) => (
                  <tr key={row.ups_installation_id}>
                    <td>{row.ticket_number}</td>
                    <td>{warehouseValue(row.idf)}</td>
                    <td>{row.school_name}</td>
                    <td>{warehouseValue(row.install_date)}</td>
                    <td>{row.type}</td>
                    <td>{row.equipment}</td>
                    <td>{warehouseValue(row.ups_serial)}</td>
                    <td>
                      <input
                        value={row.ups_po}
                        onChange={(event) => updateWarehouseRow(row.ups_installation_id, 'ups_po', event.target.value)}
                        maxLength={100}
                      />
                    </td>
                    <td>{warehouseValue(row.bp_serials)}</td>
                    <td>
                      <input
                        value={row.bp_po}
                        onChange={(event) => updateWarehouseRow(row.ups_installation_id, 'bp_po', event.target.value)}
                        maxLength={100}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.actions}>
            <button type="button" className="primaryButton" onClick={handleCopyWarehouseTable}>
              Copy Warehouse Table
            </button>
            <button type="button" className="secondaryButton" onClick={closeWarehouseModal}>Cancel</button>
          </div>
        </Modal>
      )}

      {fulfillmentInstall && (
        <Modal title="UPS Phase 3 Fulfillment" onClose={closeFulfillmentModal}>
          <div className={styles.summaryDetails}>
            <ReadOnlyField label="Ticket #" value={getUpsTicketLabel(fulfillmentInstall)} />
            <ReadOnlyField label="School" value={fulfillmentInstall.school_name} />
            <ReadOnlyField label="IDF" value={fulfillmentInstall.idf || '-'} />
            <ReadOnlyField label="Install Date" value={fulfillmentInstall.proposed_install_date || '-'} />
            <ReadOnlyField label="Equipment" value={deriveUpsEquipment(fulfillmentInstall)} />
          </div>

          <form className={styles.serviceForm} onSubmit={handleSaveFulfillment}>
            <div className={styles.serviceGrid}>
              <label>
                Replacement Asset Tag #
                <input value={fulfillmentForm.new_asset_tag} onChange={(event) => updateFulfillmentForm('new_asset_tag', event.target.value)} maxLength={100} />
              </label>
              <label>
                UPS SN
                <input value={fulfillmentForm.new_serial_number} onChange={(event) => updateFulfillmentForm('new_serial_number', event.target.value)} maxLength={100} />
              </label>
              <label>
                SNMPWEBCARD SN
                <input value={fulfillmentForm.new_webcard_serial} onChange={(event) => updateFulfillmentForm('new_webcard_serial', event.target.value)} maxLength={100} />
              </label>
              <label>
                Replacement MAC
                <input value={fulfillmentForm.new_mac_address} onChange={(event) => updateFulfillmentForm('new_mac_address', event.target.value)} maxLength={32} />
              </label>
              <label>
                SNMP IP
                <input value={fulfillmentForm.snmp_ip} onChange={(event) => updateFulfillmentForm('snmp_ip', event.target.value)} maxLength={100} />
              </label>
              <label>
                BP SN
                <input value={fulfillmentForm.new_battery_pack_serial} onChange={(event) => updateFulfillmentForm('new_battery_pack_serial', event.target.value)} maxLength={100} />
              </label>
              <label>
                BP Asset Tag #
                <input value={fulfillmentForm.new_battery_pack_asset_tag} onChange={(event) => updateFulfillmentForm('new_battery_pack_asset_tag', event.target.value)} maxLength={100} />
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className="successButton">Move to Completed</button>
              <button type="button" className="secondaryButton" onClick={closeFulfillmentModal}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {completedSummaryInstall && (
        <Modal title="UPS Details" onClose={closeCompletedSummaryModal}>
          {completedSummaryEditing ? (
            <div className={styles.completedEditGrid}>
              {completedEditableFields.map(([field, label]) => (
                <label key={field}>
                  {label}
                  <input
                    value={completedSummaryForm[field] || ''}
                    onChange={(event) => updateCompletedSummaryForm(field, event.target.value)}
                    maxLength={field.includes('mac_address') ? 32 : 100}
                  />
                </label>
              ))}
            </div>
          ) : (
            <>
              <UpsStatusStepper status={completedSummaryInstall.status} snmpIp={completedSummaryInstall.snmp_ip} />
              <div className={styles.summaryDetails}>
                <ReadOnlyField label="Ticket #" value={getUpsTicketLabel(completedSummaryInstall)} />
                <ReadOnlyField label="School" value={completedSummaryInstall.school_name} />
                <ReadOnlyField label="TEA Code" value={completedSummaryInstall.tea_code || '-'} />
                <ReadOnlyField label="MDF/IDF" value={completedSummaryInstall.idf || '-'} />
                <ReadOnlyField label="Install Date" value={completedSummaryInstall.proposed_install_date || '-'} />
                <ReadOnlyField label="Equipment" value={deriveUpsEquipment(completedSummaryInstall)} />
                <ReadOnlyField label="Defective UPS SN" value={completedSummaryInstall.serial_number || '-'} />
                <ReadOnlyField label="Defective BP SN" value={completedSummaryInstall.defective_battery_pack_serial || '-'} />
                <ReadOnlyField label="Defective Asset Tag #" value={completedSummaryInstall.asset_tag || '-'} />
                <ReadOnlyField label="Defective MAC" value={completedSummaryInstall.mac_address || '-'} />
                <ReadOnlyField label="Replacement Asset Tag #" value={completedSummaryInstall.new_asset_tag || '-'} />
                <ReadOnlyField label="UPS SN" value={completedSummaryInstall.new_serial_number || '-'} />
                <ReadOnlyField label="SNMPWEBCARD SN" value={completedSummaryInstall.new_webcard_serial || '-'} />
                <ReadOnlyField label="Replacement MAC" value={completedSummaryInstall.new_mac_address || '-'} />
                <ReadOnlyField label="SNMP IP" value={completedSummaryInstall.snmp_ip || '-'} />
                <ReadOnlyField label="BP SN" value={completedSummaryInstall.new_battery_pack_serial || '-'} />
                <ReadOnlyField label="BP Asset Tag #" value={completedSummaryInstall.new_battery_pack_asset_tag || '-'} />
                <ReadOnlyField label="UPS PO" value={completedSummaryInstall.ups_po || '-'} />
                <ReadOnlyField label="BP PO" value={completedSummaryInstall.bp_po || '-'} />
                <ReadOnlyField label="Status" value={upsStatusLabelMap[completedSummaryInstall.status] || completedSummaryInstall.status} />
              </div>
            </>
          )}
          <div className={styles.actions}>
            {completedSummaryEditing ? (
              <>
                <button type="button" className="primaryButton" onClick={handleSaveCompletedSummary}>Save</button>
                <button type="button" className="secondaryButton" onClick={() => setCompletedSummaryEditing(false)}>Cancel</button>
              </>
            ) : (
              <>
                {completedSummaryInstall.status === 'fulfilled' && (
                  <button type="button" className="correctionButton" onClick={openReturnToServicingConfirm}>Return to Servicing</button>
                )}
                <button type="button" className="secondaryButton" onClick={() => setCompletedSummaryEditing(true)}>Edit</button>
              </>
            )}
            <button type="button" className="secondaryButton" onClick={closeCompletedSummaryModal}>Close</button>
          </div>
        </Modal>
      )}

      {returnToServicingConfirmOpen && (
        <Modal title="Return to Servicing" onClose={closeReturnToServicingConfirm}>
          <p className="mutedText">
            Return this UPS record to Servicing? Use this if the record was completed or fulfilled by mistake, or if it still needs follow-up. Existing UPS details will be preserved.
          </p>
          <div className={styles.actions}>
            <button type="button" className="secondaryButton" onClick={closeReturnToServicingConfirm} disabled={returningToServicing}>Cancel</button>
            <button type="button" className="primaryButton" onClick={handleReturnToServicing} disabled={returningToServicing}>
              {returningToServicing ? 'Returning...' : 'Return to Servicing'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function DateBadge({ value }) {
  return <span className={styles.dateBadge}>{value || '-'}</span>;
}

function RetryState({ text, onRetry }) {
  return (
    <div className={styles.retryState}>
      <p className="mutedText">{text}</p>
      <button type="button" className="secondaryButton" onClick={onRetry}>Retry</button>
    </div>
  );
}

function SelectionHint({ count, label }) {
  return count > 0 ? <StatusBadge tone="info">{count} {label}</StatusBadge> : <StatusBadge>0 selected</StatusBadge>;
}

function ReadOnlyField({ label, value }) {
  return (
    <div className={styles.readOnlyField}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}
