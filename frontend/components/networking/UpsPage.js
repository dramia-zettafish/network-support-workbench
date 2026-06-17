'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { copyHtmlToClipboard } from '../../lib/clipboard';
import { moduleHref } from '../../lib/networkRoutes';
import { isScreenshotMode } from '../../lib/publicConfig';
import { getScreenshotOperationsData } from '../../lib/screenshotData';
import { deriveUpsEquipment, getUpsTicketLabel, toggleSelection, upsStatusLabelMap, upsStatusToneMap } from '../../lib/upsHelpers';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import SpotlightPanel from '../ui/SpotlightPanel';
import StatusBadge from '../ui/StatusBadge';
import { useToast } from '../ui/ToastProvider';
import UpsStatusStepper from '../ups/UpsStatusStepper';
import styles from './UpsPage.module.css';

const emptyFulfillmentForm = {
  new_asset_tag: '',
  new_serial_number: '',
  new_webcard_serial: '',
  new_mac_address: '',
  new_battery_pack_serial: '',
  new_battery_pack_asset_tag: ''
};

const emptyIpConfirmForm = {
  snmp_ip: '',
  hostname: '',
  new_mac_address: '',
  new_webcard_serial: '',
  new_asset_tag: '',
  new_serial_number: '',
  ups_po: '',
  new_battery_pack_serial: '',
  new_battery_pack_asset_tag: '',
  bp_po: ''
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
  ['previous_snmp_ip', 'Previous SNMP IP'],
  ['new_battery_pack_serial', 'BP SN'],
  ['new_battery_pack_asset_tag', 'BP Asset Tag #'],
  ['ups_po', 'UPS PO'],
  ['bp_po', 'BP PO']
];

function formatTableCell(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.filter(Boolean).map(formatTableCell).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function formatEmailDate(value) {
  const normalized = formatTableCell(value);
  if (!normalized) return '';

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;

  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

const scheduleTableColumns = [
  { label: 'Ticket #', value: (row) => row.ticket_number },
  { label: 'IDF', value: (row) => row.idf },
  { label: 'School Name', value: (row) => row.school_name },
  { label: 'Install Contact', htmlLabel: 'Install<br>Contact', value: (row) => row.install_contact },
  { label: 'Install Contact Number', htmlLabel: 'Install Contact<br>Number', value: (row) => row.install_contact_number },
  { label: 'Install Scheduled', htmlLabel: 'Install<br>Scheduled', value: (row) => formatEmailDate(row.proposed_install_date) },
  { label: 'Type', value: (row) => row.type || 'Replace' },
  { label: 'Equipment', value: (row) => row.equipment }
];

const warehouseTableColumns = [
  { label: 'Ticket #', value: (row) => row.ticket_number },
  { label: 'IDF', value: (row) => row.idf },
  { label: 'School Name', value: (row) => row.school_name },
  { label: 'Install Date', value: (row) => formatEmailDate(row.install_date) },
  { label: 'Type', value: (row) => row.type },
  { label: 'Equipment', value: (row) => row.equipment },
  { label: 'UPS Serial', value: (row) => row.ups_serial },
  { label: 'UPS PO', value: (row) => row.ups_po },
  { label: 'BP Serial(s)', value: (row) => row.bp_serials, optional: true },
  { label: 'BP PO', value: (row) => row.bp_po, optional: true }
];

const ipResponseTableColumns = [
  { label: 'FP TKT', value: (row) => formatIpResponseCell(getUpsTicketLabel(row)) },
  { label: 'Device Name', value: (row) => formatIpResponseCell(row.hostname) },
  { label: 'DNS Suffix', value: () => 'hisd.org' },
  { label: 'IP Address', value: (row) => formatIpResponseCell(row.snmp_ip) },
  { label: 'Description', value: () => 'UPS SNMP' },
  { label: 'Asset Tag', value: (row) => formatIpResponseCell(row.new_asset_tag) },
  { label: 'Serial', value: (row) => formatIpResponseCell(row.new_serial_number) },
  { label: 'Mac Add', value: (row) => formatIpResponseCell(row.new_mac_address) },
  { label: 'UPS PO#', value: (row) => formatIpResponseCell(row.ups_po) },
  { label: 'PB SN', value: (row) => formatIpResponseCell(row.new_battery_pack_serial), optional: true, optionalValue: (row) => row.new_battery_pack_serial },
  { label: 'BP Asset tag', value: (row) => formatIpResponseCell(row.new_battery_pack_asset_tag), optional: true, optionalValue: (row) => row.new_battery_pack_asset_tag },
  { label: 'BP PO#', value: (row) => formatIpResponseCell(row.bp_po), optional: true, optionalValue: (row) => row.bp_po }
];

function formatIpResponseCell(value) {
  return formatTableCell(value) || 'N/A';
}

function getPreviousSnmpIp(install) {
  return formatTableCell(install?.previous_snmp_ip) || formatTableCell(install?.snmp_ip) || null;
}

function getIpConfirmationResetFields(install) {
  return {
    snmp_ip: null,
    previous_snmp_ip: formatTableCell(install?.snmp_ip) || formatTableCell(install?.previous_snmp_ip) || null,
    ip_response_email_body: null,
    ip_response_email_created_at: null,
    ip_response_email_confirmed_at: null
  };
}

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
  const [ipConfirmInstall, setIpConfirmInstall] = useState(null);
  const [ipConfirmForm, setIpConfirmForm] = useState(emptyIpConfirmForm);
  const [completingIpConfirm, setCompletingIpConfirm] = useState(false);
  const [batchIpConfirmRows, setBatchIpConfirmRows] = useState([]);
  const [batchIpConfirmModalOpen, setBatchIpConfirmModalOpen] = useState(false);
  const [batchIpConfirmCopying, setBatchIpConfirmCopying] = useState(false);
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

  const visibleWarehouseSelectableIds = useMemo(
    () => visibleInProgressInstalls
      .filter((install) => canSelectForWarehouse(install))
      .map((install) => install.ups_installation_id),
    [visibleInProgressInstalls]
  );

  const selectedInProgressRows = useMemo(
    () => visibleInProgressInstalls.filter((install) => selectedInProgressIds.has(install.ups_installation_id)),
    [selectedInProgressIds, visibleInProgressInstalls]
  );

  const selectedWarehouseCount = useMemo(
    () => visibleWarehouseSelectableIds.filter((id) => selectedInProgressIds.has(id)).length,
    [selectedInProgressIds, visibleWarehouseSelectableIds]
  );

  const selectedInProgressStatuses = useMemo(
    () => new Set(selectedInProgressRows.map((install) => install.status)),
    [selectedInProgressRows]
  );

  const hasSelectedInProgressRows = selectedInProgressRows.length > 0;
  const allSelectedWarehouseReady = hasSelectedInProgressRows && selectedInProgressRows.every((install) => canSelectForWarehouse(install));
  const allSelectedConfirmIp = hasSelectedInProgressRows && selectedInProgressRows.every((install) => install.status === 'confirm_ip');
  const hasMixedSelectedStatuses = selectedInProgressStatuses.size > 1;

  const allVisibleWarehouseSelected =
    visibleWarehouseSelectableIds.length > 0 &&
    selectedWarehouseCount === visibleWarehouseSelectableIds.length;

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
    { key: 'tea_code', label: 'Identifier' },
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
      render: (install) => {
        if (!canSelectForBatchAction(install)) return null;

        return (
          <input
            type="checkbox"
            aria-label={`Select in progress UPS ticket ${getUpsTicketLabel(install)}`}
            checked={selectedInProgressIds.has(install.ups_installation_id)}
            onClick={(event) => event.stopPropagation()}
            onChange={() => toggleSelection(setSelectedInProgressIds, install.ups_installation_id)}
          />
        );
      }
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

  function canSelectForWarehouse(install) {
    return install.status === 'scheduled';
  }

  function canSelectForBatchAction(install) {
    return canSelectForWarehouse(install) || install.status === 'confirm_ip';
  }

  function canOpenInProgressRow(install) {
    return install.status === 'servicing' || install.status === 'confirm_ip';
  }

  function handleInProgressRowClick(install) {
    if (install.status === 'servicing') {
      openFulfillmentModal(install);
      return;
    }

    if (install.status === 'confirm_ip') {
      openIpConfirmModal(install);
    }
  }

  async function loadUpsInstallations() {
    setLoading(true);
    setLoadFailed(false);

    if (isScreenshotMode) {
      const screenshotData = getScreenshotOperationsData();
      setPendingInstalls(screenshotData.upsPending);
      setInProgressInstalls([...screenshotData.upsScheduled, ...screenshotData.upsServicing]);
      setCompletedInstalls(screenshotData.upsCompleted);
      setSelectedPendingIds(new Set());
      setSelectedInProgressIds(new Set());
      setLoading(false);
      return;
    }

    try {
      const [pending, scheduled, servicing, confirmIp, completed] = await Promise.all([
        apiRequest('/ups-installations/?status=intake&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=scheduled&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=servicing&limit=1000&offset=0'),
        apiRequest('/ups-installations/?status=confirm_ip&limit=1000&offset=0'),
        apiRequest(`/ups-installations/?status=fulfilled&limit=${completedInstallLimit}&offset=0`)
      ]);
      setPendingInstalls(pending || []);
      setInProgressInstalls([...(scheduled || []), ...(servicing || []), ...(confirmIp || [])]);
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
    if (isScreenshotMode) {
      const search = currentSearch.trim().toLowerCase();
      const completed = getScreenshotOperationsData().upsCompleted.filter((install) => {
        if (!search) return true;
        return [
          getUpsTicketLabel(install),
          install.school_name,
          install.tea_code,
          install.new_serial_number,
          install.new_mac_address,
          install.snmp_ip
        ].some((value) => String(value || '').toLowerCase().includes(search));
      });
      setCompletedInstalls(completed);
      return;
    }

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
    return buildHtmlTable(scheduleTableColumns, rows);
  }

  function buildScheduleTextTable(rows) {
    return buildTextTable(scheduleTableColumns, rows);
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
      .filter((install) => canSelectForWarehouse(install) && selectedInProgressIds.has(install.ups_installation_id))
      .map((install) => ({
        ups_installation_id: install.ups_installation_id,
        ticket_number: getUpsTicketLabel(install),
        idf: formatTableCell(install.idf),
        school_name: install.school_name,
        install_date: formatTableCell(install.proposed_install_date),
        type: 'Replace',
        equipment: deriveUpsEquipment(install),
        snmp_ip: install.snmp_ip,
        previous_snmp_ip: install.previous_snmp_ip,
        ups_serial: '',
        ups_po: formatTableCell(install.ups_po),
        bp_serials: '',
        bp_po: formatTableCell(install.bp_po)
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

      if (allVisibleWarehouseSelected) {
        visibleWarehouseSelectableIds.forEach((id) => nextIds.delete(id));
      } else {
        nextIds.clear();
        visibleWarehouseSelectableIds.forEach((id) => nextIds.add(id));
      }

      return nextIds;
    });
  }

  function openFulfillmentModal(install) {
    setFulfillmentInstall(install);
    setFulfillmentForm(buildFulfillmentForm(install));
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
        body: JSON.stringify({
          status: 'confirm_ip',
          ...getIpConfirmationResetFields(updatedInstall)
        })
      });
      notify('success', 'UPS fulfillment saved', 'The record moved to Confirm IP.');
      closeFulfillmentModal();
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to save UPS fulfillment');
    }
  }

  function buildFulfillmentForm(install) {
    return {
      new_asset_tag: install.new_asset_tag || '',
      new_serial_number: install.new_serial_number || '',
      new_webcard_serial: install.new_webcard_serial || '',
      new_mac_address: install.new_mac_address || '',
      new_battery_pack_serial: install.new_battery_pack_serial || '',
      new_battery_pack_asset_tag: install.new_battery_pack_asset_tag || ''
    };
  }

  function normalizeFulfillmentPayload(form) {
    return Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim() || null])
    );
  }

  function openIpConfirmModal(install) {
    setIpConfirmInstall(install);
    setCompletingIpConfirm(false);
    setIpConfirmForm(buildIpConfirmForm(install));
  }

  function closeIpConfirmModal() {
    setIpConfirmInstall(null);
    setIpConfirmForm(emptyIpConfirmForm);
    setCompletingIpConfirm(false);
  }

  function buildIpConfirmForm(install) {
    return {
      snmp_ip: '',
      hostname: install.hostname || '',
      new_mac_address: install.new_mac_address || '',
      new_webcard_serial: install.new_webcard_serial || '',
      new_asset_tag: install.new_asset_tag || '',
      new_serial_number: install.new_serial_number || '',
      ups_po: install.ups_po || '',
      new_battery_pack_serial: install.new_battery_pack_serial || '',
      new_battery_pack_asset_tag: install.new_battery_pack_asset_tag || '',
      bp_po: install.bp_po || ''
    };
  }

  function updateIpConfirmForm(field, value) {
    setIpConfirmForm((current) => ({ ...current, [field]: value }));
  }

  function openBatchIpConfirmModal() {
    const rows = selectedInProgressRows
      .filter((install) => install.status === 'confirm_ip')
      .map((install) => ({
        ...install,
        form: buildIpConfirmForm(install)
      }));

    if (rows.length === 0) {
      notify('warning', 'Select Confirm IP records', 'Choose at least one Confirm IP record before copying the IP response.');
      return;
    }

    setBatchIpConfirmRows(rows);
    setBatchIpConfirmModalOpen(true);
  }

  function closeBatchIpConfirmModal() {
    if (batchIpConfirmCopying) return;
    setBatchIpConfirmRows([]);
    setBatchIpConfirmModalOpen(false);
  }

  function updateBatchIpConfirmRow(upsInstallationId, field, value) {
    setBatchIpConfirmRows((currentRows) =>
      currentRows.map((row) =>
        row.ups_installation_id === upsInstallationId
          ? { ...row, form: { ...row.form, [field]: value } }
          : row
      )
    );
  }

  function buildIpConfirmPayload(form, sourceInstall) {
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim() || null])
    );
    payload.previous_snmp_ip = getPreviousSnmpIp(sourceInstall);
    return payload;
  }

  async function saveIpDetails() {
    if (!ipConfirmInstall) return null;

    const updatedInstall = await apiRequest(`/ups-installations/${ipConfirmInstall.ups_installation_id}`, {
      method: 'PUT',
      body: JSON.stringify(buildIpConfirmPayload(ipConfirmForm, ipConfirmInstall))
    });
    setIpConfirmInstall(updatedInstall);
    setIpConfirmForm(buildIpConfirmForm(updatedInstall));
    loadUpsInstallations();
    return updatedInstall;
  }

  async function handleCopyIpResponseTable() {
    if (!ipConfirmInstall) return;

    if (!formatTableCell(ipConfirmForm.snmp_ip)) {
      notify('warning', 'Confirm the UPS IP', 'Enter the current DHCP-assigned SNMP IP before copying the response.');
      return;
    }

    try {
      setCompletingIpConfirm(true);
      const savedInstall = await saveIpDetails();
      const sourceInstall = savedInstall || { ...ipConfirmInstall, ...buildIpConfirmPayload(ipConfirmForm, ipConfirmInstall) };
      const html = buildIpResponseHtml(sourceInstall);
      const text = buildIpResponseText(sourceInstall);
      const now = new Date().toISOString();

      await copyHtmlToClipboard(html, text);
      const updatedInstall = await apiRequest(`/ups-installations/${sourceInstall.ups_installation_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ip_response_email_body: text,
          ip_response_email_created_at: sourceInstall.ip_response_email_created_at || now,
          ip_response_email_confirmed_at: now,
          status: 'fulfilled'
        })
      });
      setIpConfirmInstall(updatedInstall);
      setIpConfirmForm(buildIpConfirmForm(updatedInstall));
      notify('success', 'IP response copied', 'The record moved to Completed.');
      closeIpConfirmModal();
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to copy IP response');
    } finally {
      setCompletingIpConfirm(false);
    }
  }

  async function handleCopyBatchIpResponseTable() {
    if (batchIpConfirmRows.length === 0) return;

    const missingIpRows = batchIpConfirmRows.filter((row) => !formatTableCell(row.form.snmp_ip));
    if (missingIpRows.length > 0) {
      notify('warning', 'Confirm every UPS IP', `${missingIpRows.length} selected record${missingIpRows.length === 1 ? ' needs' : 's need'} the current DHCP-assigned SNMP IP.`);
      return;
    }

    try {
      setBatchIpConfirmCopying(true);
      const savedRows = await Promise.all(
        batchIpConfirmRows.map((row) =>
          apiRequest(`/ups-installations/${row.ups_installation_id}`, {
            method: 'PUT',
            body: JSON.stringify(buildIpConfirmPayload(row.form, row))
          })
        )
      );
      const html = buildBatchIpResponseHtml(savedRows);
      const text = buildBatchIpResponseText(savedRows);
      const now = new Date().toISOString();

      await copyHtmlToClipboard(html, text);
      await Promise.all(
        savedRows.map((row) =>
          apiRequest(`/ups-installations/${row.ups_installation_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              ip_response_email_body: text,
              ip_response_email_created_at: row.ip_response_email_created_at || now,
              ip_response_email_confirmed_at: now,
              status: 'fulfilled'
            })
          })
        )
      );
      notify('success', 'IP response copied', 'Selected records moved to Completed.');
      setSelectedInProgressIds(new Set());
      closeBatchIpConfirmModal();
      loadUpsInstallations();
    } catch (error) {
      notify('error', 'Failed to copy IP response');
    } finally {
      setBatchIpConfirmCopying(false);
    }
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
        body: JSON.stringify({
          status: 'servicing',
          ...getIpConfirmationResetFields(completedSummaryInstall)
        })
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
        ups_po: formatTableCell(row.ups_po),
        bp_po: formatTableCell(row.bp_po)
      }));

      await Promise.all(
        normalizedRows.map((row) =>
          apiRequest(`/ups-installations/${row.ups_installation_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              ups_po: row.ups_po,
              bp_po: row.bp_po,
              status: 'servicing',
              ...getIpConfirmationResetFields(row)
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
    return formatTableCell(value);
  }

  function buildWarehouseHtmlTable(rows) {
    return buildHtmlTable(warehouseTableColumns, rows);
  }

  function buildWarehouseTextTable(rows) {
    return buildTextTable(warehouseTableColumns, rows);
  }

  function escapeTableCell(value) {
    return formatTableCell(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTableCell(row, column) {
    return column.value(row);
  }

  function getTableHeaderHtml(column) {
    if (column.htmlLabel) return column.htmlLabel;
    return escapeTableCell(column.label);
  }

  function getIncludedTableColumns(columns, rows) {
    return columns.filter((column) => {
      if (!column.optional) return true;
      return rows.some((row) => formatTableCell(column.optionalValue ? column.optionalValue(row) : getTableCell(row, column)));
    });
  }

  function formatIncludedCell(row, column) {
    const value = formatTableCell(getTableCell(row, column));
    return column.optional && !value ? 'N/A' : value;
  }

  function buildHtmlTable(columns, rows) {
    const includedColumns = getIncludedTableColumns(columns, rows);
    const tableStyle = 'border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px;';
    const headerStyle = 'border: 1px solid #000; padding: 6px 10px; font-weight: bold; text-align: center; vertical-align: middle; white-space: nowrap; background-color: #111827; color: #ffffff;';
    const bodyStyle = 'border: 1px solid #000; padding: 4px 8px; text-align: left; vertical-align: middle; white-space: nowrap; background-color: #ffffff; color: #000000; font-weight: normal;';

    return `
      <table style="${tableStyle}">
        <thead>
          <tr>${includedColumns.map((column) => `<th style="${headerStyle}">${getTableHeaderHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${includedColumns.map((column) => `<td style="${bodyStyle}">${escapeTableCell(formatIncludedCell(row, column))}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  function buildTextTable(columns, rows) {
    const includedColumns = getIncludedTableColumns(columns, rows);
    const headerRow = includedColumns.map((column) => column.label);
    const bodyRows = rows.map((row) => includedColumns.map((column) => formatIncludedCell(row, column)));
    return [headerRow, ...bodyRows].map((row) => row.join('\t')).join('\n');
  }

  function buildIpResponseHtml(install) {
    return buildBatchIpResponseHtml([install]);
  }

  function buildIpResponseText(install) {
    return buildBatchIpResponseText([install]);
  }

  function getIpResponseHeading(rows) {
    const schoolName = formatTableCell(rows[0]?.school_name) || 'Unknown School';
    if (rows.length === 1) return `1 UPS Installed at ${schoolName}`;
    return `${rows.length} UPS Installed at ${schoolName}`;
  }

  function sortIpResponseRows(rows) {
    return [...rows].sort((left, right) => {
      const ticketComparison = String(getUpsTicketLabel(left) || '').localeCompare(String(getUpsTicketLabel(right) || ''), undefined, { numeric: true });
      if (ticketComparison !== 0) return ticketComparison;

      const idfComparison = String(left.idf || '').localeCompare(String(right.idf || ''), undefined, { numeric: true });
      if (idfComparison !== 0) return idfComparison;

      return String(left.ups_installation_id || '').localeCompare(String(right.ups_installation_id || ''), undefined, { numeric: true });
    });
  }

  function getIpResponseSchoolGroups(rows) {
    const groupsBySchool = new Map();
    rows.forEach((row) => {
      const schoolName = formatTableCell(row.school_name) || 'Unknown School';
      if (!groupsBySchool.has(schoolName)) groupsBySchool.set(schoolName, []);
      groupsBySchool.get(schoolName).push(row);
    });

    return [...groupsBySchool.entries()]
      .sort(([leftSchool], [rightSchool]) => leftSchool.localeCompare(rightSchool))
      .map(([, schoolRows]) => ({
        rows: sortIpResponseRows(schoolRows)
      }));
  }

  function buildBatchIpResponseHtml(rows) {
    const headingStyle = 'margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 13px; color: #000000; background: transparent;';
    return getIpResponseSchoolGroups(rows)
      .map((group) => [
        `<p style="${headingStyle}"><strong>${escapeTableCell(getIpResponseHeading(group.rows))}</strong></p>`,
        buildHtmlTable(ipResponseTableColumns, group.rows)
      ].join(''))
      .join('<br>');
  }

  function buildBatchIpResponseText(rows) {
    return getIpResponseSchoolGroups(rows)
      .map((group) => [
        getIpResponseHeading(group.rows),
        '',
        buildTextTable(ipResponseTableColumns, group.rows)
      ].join('\n'))
      .join('\n\n');
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
          <strong className={styles.summaryValue}>{selectedPendingIds.size + selectedInProgressRows.length}</strong>
          <p className="mutedText">Selected for schedule, warehouse, or completion actions.</p>
        </SectionCard>
      </div>

      <div className={styles.tables}>
        <SectionCard
          title="Pending Installs"
          description="Select pending records to build the NOC schedule and move them to In Progress."
          spotlight
          spotlightMode="interactive"
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
            <DataTable className={styles.upsTable} columns={pendingColumns} rows={visiblePendingInstalls} getRowKey={(install) => install.ups_installation_id} />
          ) : (
            <EmptyState title="No pending UPS installs" description="Create a UPS ticket to populate this queue." />
          )}
        </SectionCard>

        <SectionCard
          title="In Progress"
          description="Select scheduled records to copy the warehouse table. Servicing rows open fulfillment; Confirm IP rows open IP confirmation."
          spotlight
          spotlightMode="interactive"
          actions={
            <div className={styles.sectionActions}>
              <SelectionHint count={selectedInProgressRows.length} label="in progress selected" />
              {visibleWarehouseSelectableIds.length > 0 && (
                <button type="button" className="secondaryButton" onClick={handleToggleVisibleScheduledSelection}>
                  {allVisibleWarehouseSelected ? 'Clear All' : 'Select All'}
                </button>
              )}
              {allSelectedWarehouseReady && (
                <button type="button" className="primaryButton" onClick={openWarehouseModal}>
                  Copy Warehouse Table
                </button>
              )}
              {allSelectedConfirmIp && (
                <button type="button" className="primaryButton" onClick={openBatchIpConfirmModal}>
                  Copy IP Response
                </button>
              )}
              {hasMixedSelectedStatuses && (
                <span className="mutedText">Select rows with the same status to perform a batch action.</span>
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
              className={styles.upsTable}
              columns={inProgressColumns}
              rows={visibleInProgressInstalls}
              getRowKey={(install) => install.ups_installation_id}
              onRowClick={handleInProgressRowClick}
              canClickRow={canOpenInProgressRow}
            />
          ) : (
            <EmptyState title="No in-progress UPS installs" description="Scheduled UPS records will appear here." />
          )}
        </SectionCard>

        <SectionCard
          title="Completed"
          description="Fulfilled UPS records stay here for quick reference."
          spotlight
          spotlightMode="interactive"
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
              className={styles.upsTable}
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
              <SpotlightPanel key={row.ups_installation_id} className={styles.scheduleRow} mode="interactive">
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
              </SpotlightPanel>
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

          <SpotlightPanel as="form" className={styles.serviceForm} mode="interactive" onSubmit={handleSaveFulfillment}>
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
                BP SN
                <input value={fulfillmentForm.new_battery_pack_serial} onChange={(event) => updateFulfillmentForm('new_battery_pack_serial', event.target.value)} maxLength={100} />
              </label>
              <label>
                BP Asset Tag #
                <input value={fulfillmentForm.new_battery_pack_asset_tag} onChange={(event) => updateFulfillmentForm('new_battery_pack_asset_tag', event.target.value)} maxLength={100} />
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className="primaryButton">Save Fulfillment Details</button>
              <button type="button" className="secondaryButton" onClick={closeFulfillmentModal}>Cancel</button>
            </div>
          </SpotlightPanel>
        </Modal>
      )}

      {ipConfirmInstall && (
        <Modal title="Confirm UPS IP" onClose={closeIpConfirmModal}>
          <div className={styles.summaryDetails}>
            <ReadOnlyField label="Ticket #" value={getUpsTicketLabel(ipConfirmInstall)} />
            <ReadOnlyField label="School" value={ipConfirmInstall.school_name} />
            <ReadOnlyField label="IDF" value={ipConfirmInstall.idf || '-'} />
            <ReadOnlyField label="Install Date" value={ipConfirmInstall.proposed_install_date || '-'} />
            <ReadOnlyField label="Previous SNMP IP" value={getPreviousSnmpIp(ipConfirmInstall)} />
            <ReadOnlyField label="Status" value={upsStatusLabelMap[ipConfirmInstall.status] || ipConfirmInstall.status} />
          </div>

          <SpotlightPanel as="section" className={styles.serviceForm} mode="interactive">
            <div className={styles.serviceGrid}>
              <label>
                SNMP IP
                <input value={ipConfirmForm.snmp_ip} onChange={(event) => updateIpConfirmForm('snmp_ip', event.target.value)} maxLength={100} />
              </label>
              <label>
                Device Name / Hostname
                <input value={ipConfirmForm.hostname} onChange={(event) => updateIpConfirmForm('hostname', event.target.value)} maxLength={100} />
              </label>
              <label>
                SNMP MAC
                <input value={ipConfirmForm.new_mac_address} onChange={(event) => updateIpConfirmForm('new_mac_address', event.target.value)} maxLength={32} />
              </label>
              <label>
                SNMPWEBCARD SN
                <input value={ipConfirmForm.new_webcard_serial} onChange={(event) => updateIpConfirmForm('new_webcard_serial', event.target.value)} maxLength={100} />
              </label>
              <label>
                Replacement Asset Tag #
                <input value={ipConfirmForm.new_asset_tag} onChange={(event) => updateIpConfirmForm('new_asset_tag', event.target.value)} maxLength={100} />
              </label>
              <label>
                UPS SN
                <input value={ipConfirmForm.new_serial_number} onChange={(event) => updateIpConfirmForm('new_serial_number', event.target.value)} maxLength={100} />
              </label>
              <label>
                UPS PO
                <input value={ipConfirmForm.ups_po} onChange={(event) => updateIpConfirmForm('ups_po', event.target.value)} maxLength={100} />
              </label>
              <label>
                BP SN
                <input value={ipConfirmForm.new_battery_pack_serial} onChange={(event) => updateIpConfirmForm('new_battery_pack_serial', event.target.value)} maxLength={100} />
              </label>
              <label>
                BP Asset Tag #
                <input value={ipConfirmForm.new_battery_pack_asset_tag} onChange={(event) => updateIpConfirmForm('new_battery_pack_asset_tag', event.target.value)} maxLength={100} />
              </label>
              <label>
                BP PO
                <input value={ipConfirmForm.bp_po} onChange={(event) => updateIpConfirmForm('bp_po', event.target.value)} maxLength={100} />
              </label>
            </div>
            <div className={styles.actions}>
              <button type="button" className="primaryButton" onClick={handleCopyIpResponseTable} disabled={completingIpConfirm}>
                {completingIpConfirm ? 'Copying...' : 'Copy IP Response'}
              </button>
              <button type="button" className="secondaryButton" onClick={closeIpConfirmModal}>Cancel</button>
            </div>
          </SpotlightPanel>
        </Modal>
      )}

      {batchIpConfirmModalOpen && (
        <Modal title="Confirm UPS IP Response" onClose={closeBatchIpConfirmModal}>
          <p className="mutedText">Review IP details, then copy the response table for Outlook. Selected records will move to Completed after copy.</p>
          <div className={styles.scheduleRows}>
            {batchIpConfirmRows.map((row) => (
              <SpotlightPanel key={row.ups_installation_id} className={styles.serviceForm} mode="interactive">
                <div className={styles.summaryDetails}>
                  <ReadOnlyField label="Ticket #" value={getUpsTicketLabel(row)} />
                  <ReadOnlyField label="School" value={row.school_name} />
                  <ReadOnlyField label="Previous SNMP IP" value={getPreviousSnmpIp(row)} />
                </div>
                <div className={styles.serviceGrid}>
                  <label>
                    Device Name / Hostname
                    <input value={row.form.hostname} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'hostname', event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    SNMP IP
                    <input value={row.form.snmp_ip} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'snmp_ip', event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    SNMP MAC
                    <input value={row.form.new_mac_address} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'new_mac_address', event.target.value)} maxLength={32} />
                  </label>
                  <label>
                    Replacement Asset Tag #
                    <input value={row.form.new_asset_tag} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'new_asset_tag', event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    UPS SN
                    <input value={row.form.new_serial_number} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'new_serial_number', event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    UPS PO
                    <input value={row.form.ups_po} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'ups_po', event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    BP SN
                    <input value={row.form.new_battery_pack_serial} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'new_battery_pack_serial', event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    BP Asset Tag #
                    <input value={row.form.new_battery_pack_asset_tag} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'new_battery_pack_asset_tag', event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    BP PO
                    <input value={row.form.bp_po} onChange={(event) => updateBatchIpConfirmRow(row.ups_installation_id, 'bp_po', event.target.value)} maxLength={100} />
                  </label>
                </div>
              </SpotlightPanel>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className="primaryButton" onClick={handleCopyBatchIpResponseTable} disabled={batchIpConfirmCopying}>
              {batchIpConfirmCopying ? 'Copying...' : 'Copy IP Response'}
            </button>
            <button type="button" className="secondaryButton" onClick={closeBatchIpConfirmModal} disabled={batchIpConfirmCopying}>Cancel</button>
          </div>
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
              <div className={styles.summaryGroups}>
                <ReadOnlyGroup title="Ticket / Location">
                  <ReadOnlyField label="Ticket #" value={getUpsTicketLabel(completedSummaryInstall)} />
                  <ReadOnlyField label="School" value={completedSummaryInstall.school_name} />
                  <ReadOnlyField label="Identifier" value={completedSummaryInstall.tea_code} />
                  <ReadOnlyField label="MDF/IDF" value={completedSummaryInstall.idf} />
                  <ReadOnlyField label="Install Date" value={completedSummaryInstall.proposed_install_date} />
                  <ReadOnlyField label="Equipment" value={deriveUpsEquipment(completedSummaryInstall)} />
                </ReadOnlyGroup>
                <ReadOnlyGroup title="Defective Equipment">
                  <ReadOnlyField label="Defective UPS SN" value={completedSummaryInstall.serial_number} />
                  <ReadOnlyField label="Defective BP SN" value={completedSummaryInstall.defective_battery_pack_serial} />
                  <ReadOnlyField label="Defective Asset Tag #" value={completedSummaryInstall.asset_tag} />
                  <ReadOnlyField label="Defective MAC" value={completedSummaryInstall.mac_address} />
                </ReadOnlyGroup>
                <ReadOnlyGroup title="Replacement Equipment">
                  <ReadOnlyField label="Replacement Asset Tag #" value={completedSummaryInstall.new_asset_tag} />
                  <ReadOnlyField label="UPS SN" value={completedSummaryInstall.new_serial_number} />
                  <ReadOnlyField label="SNMPWEBCARD SN" value={completedSummaryInstall.new_webcard_serial} />
                  <ReadOnlyField label="Replacement MAC" value={completedSummaryInstall.new_mac_address} />
                  <ReadOnlyField label="BP SN" value={completedSummaryInstall.new_battery_pack_serial} />
                  <ReadOnlyField label="BP Asset Tag #" value={completedSummaryInstall.new_battery_pack_asset_tag} />
                </ReadOnlyGroup>
                <ReadOnlyGroup title="SNMP / Warehouse / Status">
                  <ReadOnlyField label="SNMP IP" value={completedSummaryInstall.snmp_ip} />
                  <ReadOnlyField label="Previous SNMP IP" value={completedSummaryInstall.previous_snmp_ip} />
                  <ReadOnlyField label="UPS PO" value={completedSummaryInstall.ups_po} />
                  <ReadOnlyField label="BP PO" value={completedSummaryInstall.bp_po} />
                  <ReadOnlyField label="Status" value={upsStatusLabelMap[completedSummaryInstall.status] || completedSummaryInstall.status} />
                </ReadOnlyGroup>
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

function ReadOnlyGroup({ title, children }) {
  return (
    <SpotlightPanel as="section" className={styles.readOnlyGroup} mode="interactive">
      <h3>{title}</h3>
      <div className={styles.summaryDetails}>{children}</div>
    </SpotlightPanel>
  );
}

function ReadOnlyField({ label, value }) {
  const isMissing = value === undefined || value === null || String(value).trim() === '';

  return (
    <div className={`${styles.readOnlyField} ${isMissing ? styles.missingField : ''}`}>
      <span>{label}</span>
      <strong>{isMissing ? '-' : value}</strong>
    </div>
  );
}
