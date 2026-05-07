'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { copyHtmlToClipboard, copyTextToClipboard } from '../../lib/clipboard';
import { deriveUpsEquipment, getUpsTicketLabel, toggleSelection, upsStatusLabelMap, upsStatusToneMap } from '../../lib/upsHelpers';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import StatusBadge from '../ui/StatusBadge';
import styles from './UpsPage.module.css';

const emptyServiceForm = {
  model: '',
  serial_number: '',
  snmp_ip: '',
  hostname: '',
  asset_tag: '',
  mac_address: '',
  room_number: '',
  defective_battery_pack_serial: '',
  battery_pack_1_asset_tag: '',
  idf: ''
};

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function UpsPage() {
  const [pendingInstalls, setPendingInstalls] = useState([]);
  const [inProgressInstalls, setInProgressInstalls] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState(new Set());
  const [selectedInProgressIds, setSelectedInProgressIds] = useState(new Set());
  const [editingInstall, setEditingInstall] = useState(null);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

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
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (install) => (
        <button type="button" onClick={() => openServiceModal(install)}>
          Service Info
        </button>
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

  function openServiceModal(install) {
    setEditingInstall(install);
    setServiceForm({
      model: install.model || '',
      serial_number: install.serial_number || '',
      snmp_ip: install.snmp_ip || '',
      hostname: install.hostname || '',
      asset_tag: install.asset_tag || '',
      mac_address: install.mac_address || '',
      room_number: install.room_number || '',
      defective_battery_pack_serial: install.defective_battery_pack_serial || '',
      battery_pack_1_asset_tag: install.battery_pack_1_asset_tag || '',
      idf: install.idf || ''
    });
  }

  function closeServiceModal() {
    setEditingInstall(null);
    setServiceForm(emptyServiceForm);
  }

  function updateServiceForm(field, value) {
    setServiceForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveServiceInfo(event) {
    event.preventDefault();
    if (!editingInstall) return;

    try {
      await apiRequest(`/ups-installations/${editingInstall.ups_installation_id}/phase2`, {
        method: 'PATCH',
        body: JSON.stringify(normalizeServicePayload(serviceForm))
      });
      setMessage({ type: 'success', text: 'UPS service info saved.' });
      closeServiceModal();
      loadUpsInstallations();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save UPS service info.' });
    }
  }

  function normalizeServicePayload(form) {
    return Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim() || null])
    );
  }

  async function handleCopyServiceEmail() {
    if (!editingInstall) return;

    try {
      await copyTextToClipboard(buildServiceEmail(editingInstall, serviceForm));
      setMessage({ type: 'success', text: 'UPS service response copied to clipboard.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to copy UPS service response.' });
    }
  }

  function buildServiceEmail(install, form) {
    const lines = [
      'Hello,',
      '',
      'Please see the UPS service response information below:',
      '',
      `Ticket #: ${getUpsTicketLabel(install)}`,
      `School: ${install.school_name}`,
      `Model: ${form.model || '-'}`,
      `Defective UPS Serial: ${form.serial_number || '-'}`,
      `SNMP IP: ${form.snmp_ip || '-'}`,
      `Hostname: ${form.hostname || '-'}`,
      `Asset Tag: ${form.asset_tag || '-'}`,
      `MAC: ${form.mac_address || '-'}`,
      `Room: ${form.room_number || '-'}`,
      `MDF/IDF: ${form.idf || '-'}`
    ];

    if (form.defective_battery_pack_serial) {
      lines.push(`Defective BP Serial: ${form.defective_battery_pack_serial}`);
    }

    if (form.battery_pack_1_asset_tag) {
      lines.push(`BP Asset Tag: ${form.battery_pack_1_asset_tag}`);
    }

    lines.push('', 'Thank you.');
    return lines.join('\n');
  }

  function openScheduleModal() {
    const selectedRows = pendingInstalls
      .filter((install) => selectedPendingIds.has(install.ups_installation_id))
      .map((install) => ({
        ups_installation_id: install.ups_installation_id,
        ticket_number: getUpsTicketLabel(install),
        idf: install.idf || '',
        school_name: install.school_name,
        proposed_install_date: install.proposed_install_date || getTodayIsoDate(),
        equipment: deriveUpsEquipment(install)
      }));

    if (selectedRows.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one pending UPS record first.' });
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

  async function handleMoveToInProgress() {
    if (scheduleRows.length === 0) return;

    try {
      const scheduleResponse = await apiRequest('/ups/schedule/custom', {
        method: 'POST',
        body: JSON.stringify({
          rows: scheduleRows.map((row) => ({
            ups_installation_id: row.ups_installation_id,
            proposed_install_date: row.proposed_install_date
          }))
        })
      });

      await copyHtmlToClipboard(
        buildScheduleHtmlTable(scheduleResponse.rows || []),
        buildScheduleTextTable(scheduleResponse.rows || [])
      );
      setMessage({ type: 'success', text: 'NOC schedule copied and selected UPS records moved to In Progress.' });
      closeScheduleModal();
      loadUpsInstallations();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to move selected UPS records to In Progress.' });
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

  function escapeTableValue(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

      {editingInstall && (
        <Modal title="UPS Service Info" onClose={closeServiceModal}>
          <div className={styles.intakeGrid}>
            <ReadOnlyField label="Ticket #" value={getUpsTicketLabel(editingInstall)} />
            <ReadOnlyField label="School" value={editingInstall.school_name} />
            <ReadOnlyField label="TEA Code" value={editingInstall.tea_code} />
            <ReadOnlyField label="MDF/IDF" value={editingInstall.idf || '-'} />
            <ReadOnlyField
              label="Status"
              value={upsStatusLabelMap[editingInstall.status] || editingInstall.status}
            />
          </div>

          <form className={styles.serviceForm} onSubmit={handleSaveServiceInfo}>
            <div className={styles.serviceGrid}>
              <label>
                Model
                <input value={serviceForm.model} onChange={(event) => updateServiceForm('model', event.target.value)} maxLength={100} />
              </label>
              <label>
                Defective UPS Serial
                <input value={serviceForm.serial_number} onChange={(event) => updateServiceForm('serial_number', event.target.value)} maxLength={100} />
              </label>
              <label>
                SNMP IP
                <input value={serviceForm.snmp_ip} onChange={(event) => updateServiceForm('snmp_ip', event.target.value)} maxLength={100} />
              </label>
              <label>
                Hostname
                <input value={serviceForm.hostname} onChange={(event) => updateServiceForm('hostname', event.target.value)} maxLength={100} />
              </label>
              <label>
                Asset Tag
                <input value={serviceForm.asset_tag} onChange={(event) => updateServiceForm('asset_tag', event.target.value)} maxLength={100} />
              </label>
              <label>
                MAC
                <input value={serviceForm.mac_address} onChange={(event) => updateServiceForm('mac_address', event.target.value)} maxLength={32} />
              </label>
              <label>
                Room
                <input value={serviceForm.room_number} onChange={(event) => updateServiceForm('room_number', event.target.value)} maxLength={50} />
              </label>
              <label>
                MDF/IDF
                <input value={serviceForm.idf} onChange={(event) => updateServiceForm('idf', event.target.value)} maxLength={100} />
              </label>
              <label>
                Defective BP Serial
                <input value={serviceForm.defective_battery_pack_serial} onChange={(event) => updateServiceForm('defective_battery_pack_serial', event.target.value)} maxLength={100} />
              </label>
              <label>
                BP Asset Tag
                <input value={serviceForm.battery_pack_1_asset_tag} onChange={(event) => updateServiceForm('battery_pack_1_asset_tag', event.target.value)} maxLength={100} />
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className="primaryButton">Save Service Info</button>
              <button type="button" onClick={handleCopyServiceEmail}>Copy Email</button>
              <button type="button" onClick={closeServiceModal}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

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
            <button type="button" onClick={closeScheduleModal}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
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
