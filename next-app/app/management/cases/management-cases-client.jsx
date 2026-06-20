'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTimezone } from '@/lib/format-date.js';

const DEFAULT_PAGE_SIZE = 50;

const EXPORT_FIELDS = [
  { key: 'case_number', label: 'Case Number' },
  { key: 'title', label: 'Title' },
  { key: 'workflow_key', label: 'Workflow' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'facility', label: 'Facility' },
  { key: 'program', label: 'Program' },
  { key: 'stage', label: 'Stage' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'owning_team_id', label: 'Owning Team' },
  { key: 'assigned_to_user_id', label: 'Assignment' },
  { key: 'created_by_user_id', label: 'Created By' },
  { key: 'created_at', label: 'Created At' },
  { key: 'last_activity_at', label: 'Last Activity' },
  { key: 'requester_name', label: 'Requester Name' },
  { key: 'requester_email', label: 'Requester Email' },
  { key: 'requester_phone', label: 'Requester Phone' },
  { key: 'poc_name', label: 'POC Name' },
  { key: 'poc_email', label: 'POC Email' },
  { key: 'poc_phone', label: 'POC Phone' },
  { key: 'poc_address', label: 'POC Address' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'device_type', label: 'Device Type' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'asset_tag', label: 'Asset Tag' },
  { key: 'model', label: 'Model' },
  { key: 'model_name', label: 'Model Name' },
  { key: 'warranty_end', label: 'Warranty End' },
  { key: 'adp', label: 'ADP' },
  { key: 'issue_description', label: 'Issue Description' },
  { key: 'diagnostic_note', label: 'Diagnostic Note' },
  { key: 'defective_part', label: 'Defective Part' },
  { key: 'defective_part_number', label: 'Defective Part Number' },
  { key: 'defective_part_condition', label: 'Defective Part Condition' },
  { key: 'scheduled_pickup_date', label: 'Scheduled Pickup Date' },
  { key: 'pickup_resource', label: 'Pickup Resource' },
  { key: 'actual_pickup_date', label: 'Actual Pickup Date' },
  { key: 'picked_up_by', label: 'Picked Up By' },
  { key: 'scheduled_delivery_date', label: 'Scheduled Delivery Date' },
  { key: 'delivery_resource', label: 'Delivery Resource' },
  { key: 'actual_delivery_date', label: 'Actual Delivery Date' },
  { key: 'intake_crate', label: 'Intake Crate' },
  { key: 'depot_manufacturer_case_number', label: 'Depot Repair - Manufacturer Case #' },
  { key: 'depot_engagement_date', label: 'Depot Repair - Engagement Date' },
  { key: 'depot_outbound_carrier', label: 'Depot Repair - Outbound Carrier' },
  { key: 'depot_outbound_tracking', label: 'Depot Repair - Outbound Tracking' },
  { key: 'depot_outcome', label: 'Depot Repair - Outcome' },
  { key: 'depot_inbound_carrier', label: 'Depot Repair - Inbound Carrier' },
  { key: 'depot_inbound_tracking', label: 'Depot Repair - Inbound Tracking' },
  { key: 'location_awaiting_part', label: 'Asset Location - Awaiting Parts' },
  { key: 'location_repaired', label: 'Asset Location - Repaired' },
  { key: 'location_no_repair_return', label: 'Asset Location - No Repair Return' },
];

const DEFAULT_EXPORT = ['case_number', 'workflow_key', 'customer_name', 'facility', 'stage', 'owning_team_id', 'assigned_to_user_id', 'last_activity_at'];

export default function ManagementCasesClient() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [usersById, setUsersById] = useState({});
  const [teamsById, setTeamsById] = useState({});
  const [teamsList, setTeamsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [sortDir, setSortDir] = useState('desc');
  const [filterWorkflow, setFilterWorkflow] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterFacility, setFilterFacility] = useState('');
  const [customers, setCustomers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState(new Set(DEFAULT_EXPORT));
  const [exporting, setExporting] = useState(false);
  const { fmt } = useTimezone();

  useEffect(() => {
    async function loadRef() {
      try {
        const res = await fetch('/api/reference/lookups');
        if (!res.ok) return;
        const { data } = await res.json();
        if (data?.users) {
          const m = {};
          const list = [];
          data.users.forEach((u) => { m[u.id] = u.display_name || u.upn; list.push({ id: u.id, name: u.display_name || u.upn, upn: u.upn }); });
          setUsersById(m);
          setUsersList(list.sort((a, b) => a.name.localeCompare(b.name)));
        }
        if (data?.teams) {
          const m = {};
          const list = [];
          data.teams.forEach((t) => { m[t.id] = t.label; list.push({ id: t.id, key: t.key, label: t.label }); });
          setTeamsById(m);
          setTeamsList(list.sort((a, b) => a.label.localeCompare(b.label)));
        }
      } catch {}
    }
    loadRef();
  }, []);

  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await fetch('/api/cases/catalogs');
        if (!res.ok) return;
        const { data } = await res.json();
        if (data?.facilities) setFacilities(data.facilities);
      } catch {}
      try {
        const res = await fetch('/api/cases?limit=0');
        if (!res.ok) return;
        const { data } = await res.json();
        if (data) {
          const c = [...new Set(data.map(r => r.customer_name).filter(Boolean))].sort();
          setCustomers(c);
        }
      } catch {}
    }
    loadFilters();
  }, []);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sort_by: sortBy, sort_dir: sortDir });
    if (search.trim()) params.set('search', search.trim());
    if (filterWorkflow) params.set('workflow', filterWorkflow);
    if (filterStage) params.set('stage', filterStage);
    if (filterTeam) params.set('team', filterTeam);
    if (filterAssignment) params.set('assigned_to', filterAssignment);
    if (filterCustomer) params.set('customer', filterCustomer);
    if (filterFacility) params.set('facility', filterFacility);
    try {
      const res = await fetch(`/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCases(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
      if (data.data?.length) { try { sessionStorage.setItem('caseNavIds', JSON.stringify(data.data.map(c => c.id))); sessionStorage.setItem('caseNavBack', '/management/cases'); } catch {} }
    } catch { setCases([]); }
    finally { setLoading(false); }
  }, [page, pageSize, search, sortBy, sortDir, filterWorkflow, filterStage, filterTeam, filterAssignment, filterCustomer, filterFacility]);

  useEffect(() => { const t = setTimeout(fetchCases, 300); return () => clearTimeout(t); }, [fetchCases]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  }

  function sortIcon(col) {
    if (sortBy !== col) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function fmtWorkflow(wk) {
    if (!wk) return '-';
    if (wk === 'rma') return 'RMA';
    return wk.charAt(0).toUpperCase() + wk.slice(1);
  }

  function resolveField(key, value, row) {
    if (key === 'owning_team_id') return teamsById[value] || value || '-';
    if (key === 'assigned_to_user_id' || key === 'created_by_user_id') return usersById[value] || value || '-';
    if (key === 'workflow_key') return fmtWorkflow(value);
    if (key === 'last_activity_at' || key === 'created_at' || key === 'scheduled_pickup_date' || key === 'scheduled_delivery_date' || key === 'actual_pickup_date' || key === 'actual_delivery_date' || key === 'depot_engagement_date') return value ? new Date(value).toLocaleString() : '-';
    if (key.startsWith('location_') && row) {
      try {
        const loc = JSON.parse(row.asset_location_json || '{}');
        const section = key === 'location_awaiting_part' ? loc.awaiting_part : key === 'location_repaired' ? loc.repaired : loc.no_repair_return;
        if (!section) return '-';
        const parts = [];
        if (section.rack) parts.push(`Rack:${section.rack}`);
        if (section.shelf) parts.push(`Shelf:${section.shelf}`);
        if (section.crate) parts.push(`Crate:${section.crate}`);
        return parts.length ? parts.join(' ') : '-';
      } catch { return '-'; }
    }
    return value || '-';
  }

  function toggleExportField(key) {
    setExportFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function doExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ limit: '0', sort_by: sortBy, sort_dir: sortDir });
      if (search.trim()) params.set('search', search.trim());
      if (filterWorkflow) params.set('workflow', filterWorkflow);
      if (filterStage) params.set('stage', filterStage);
      if (filterTeam) params.set('team', filterTeam);
      if (filterAssignment) params.set('assigned_to', filterAssignment);
      if (filterCustomer) params.set('customer', filterCustomer);
      if (filterFacility) params.set('facility', filterFacility);
      const res = await fetch(`/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      const fields = EXPORT_FIELDS.filter(f => exportFields.has(f.key));
      const header = fields.map(f => f.label).join(',');
      const rows = (data || []).map(row =>
        fields.map(f => {
          const val = resolveField(f.key, row[f.key], row);
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cases-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch {}
    finally { setExporting(false); }
  }

  const selectStyle = { padding: '6px 8px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' };
  const thStyle = { padding: '10px 16px', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const tdStyle = { padding: '10px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: '0.875rem' };

  return (
    <div style={{ paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <input
          type="text"
          placeholder="Search cases..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input-themed"
          style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', width: '300px' }}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{total} cases</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '1rem' }}>
        <select value={filterWorkflow} onChange={(e) => { setFilterWorkflow(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All Workflows</option>
          <option value="rma">RMA</option>
          <option value="refresh">Refresh</option>
        </select>
        <select value={filterCustomer} onChange={(e) => { setFilterCustomer(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All Customers</option>
          {customers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterFacility} onChange={(e) => { setFilterFacility(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All Facilities</option>
          {facilities.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterStage} onChange={(e) => { setFilterStage(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All Stages</option>
          <option value="Intake">Intake</option>
          <option value="Ready for Pickup">Ready for Pickup</option>
          <option value="Pickup Scheduled">Pickup Scheduled</option>
          <option value="Diagnosing">Diagnosing</option>
          <option value="Ready for Delivery">Ready for Delivery</option>
          <option value="Delivery Scheduled">Delivery Scheduled</option>
          <option value="Delivered">Delivered</option>
          <option value="Quote Request">Quote Request</option>
          <option value="Quote Request - Hold">Quote Request - Hold</option>
          <option value="Quoted">Quoted</option>
          <option value="Ordering">Ordering</option>
          <option value="Part Distribution">Part Distribution</option>
          <option value="Labor Claim">Labor Claim</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Closed">Closed</option>
        </select>
        <select value={filterTeam} onChange={(e) => { setFilterTeam(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All Teams</option>
          {teamsList.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={filterAssignment} onChange={(e) => { setFilterAssignment(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All Assignments</option>
          {usersList.map((u) => <option key={u.upn} value={u.upn}>{u.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setExportOpen(true)} className="px-3 py-1 text-xs font-semibold rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>📥 Export CSV</button>
        </div>
      </div>

      {exportOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setExportOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '480px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Export Fields</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Select fields to include in the CSV export.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button onClick={() => setExportFields(new Set(EXPORT_FIELDS.map(f => f.key)))} className="btn-themed" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Select All</button>
              <button onClick={() => setExportFields(new Set())} className="btn-themed" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Clear All</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {EXPORT_FIELDS.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={exportFields.has(f.key)} onChange={() => toggleExportField(f.key)} />
                  {f.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setExportOpen(false)} className="btn-themed" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>Cancel</button>
              <button onClick={doExport} disabled={exporting || exportFields.size === 0} className="btn-themed" style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}>{exporting ? 'Exporting...' : 'Export'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)' }}>
              <th style={thStyle} onClick={() => toggleSort('case_number')}>Case{sortIcon('case_number')}</th>
              <th style={thStyle} onClick={() => toggleSort('workflow_key')}>Workflow{sortIcon('workflow_key')}</th>
              <th style={thStyle} onClick={() => toggleSort('customer_name')}>Customer{sortIcon('customer_name')}</th>
              <th style={thStyle} onClick={() => toggleSort('facility')}>Facility{sortIcon('facility')}</th>
              <th style={thStyle} onClick={() => toggleSort('stage')}>Stage{sortIcon('stage')}</th>
              <th style={thStyle}>Serial Number</th>
              <th style={thStyle} onClick={() => toggleSort('owning_team_id')}>Owning Team{sortIcon('owning_team_id')}</th>
              <th style={thStyle} onClick={() => toggleSort('assigned_to_user_id')}>Assignment{sortIcon('assigned_to_user_id')}</th>
              <th style={thStyle} onClick={() => toggleSort('last_activity_at')}>Last Activity{sortIcon('last_activity_at')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center' }}>Loading...</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center' }}>No cases found</td></tr>
            ) : cases.map((c) => (
              <tr key={c.id} style={{ transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-raised)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={tdStyle}><Link href={`/cases/${c.id}`} style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>{c.case_number}</Link></td>
                <td style={tdStyle}>{fmtWorkflow(c.workflow_key)}</td>
                <td style={tdStyle}>{c.customer_name || '-'}</td>
                <td style={tdStyle}>{c.facility || '-'}</td>
                <td style={tdStyle}>{c.stage || '-'}</td>
                <td style={tdStyle}>{c.serial_number || '-'}</td>
                <td style={tdStyle}>{teamsById[c.owning_team_id] || '-'}</td>
                <td style={tdStyle}>{usersById[c.assigned_to_user_id] || '-'}</td>
                <td style={tdStyle}>{fmt(c.last_activity_at, { dateStyle: 'short', timeStyle: 'short' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem', alignItems: 'center' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-themed" style={{ padding: '6px 12px', fontSize: '0.875rem' }}>Prev</button>
          <span style={{ padding: '6px 12px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-themed" style={{ padding: '6px 12px', fontSize: '0.875rem' }}>Next</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>Rows per page:
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="input-themed" style={{ padding: '2px 4px', fontSize: '0.75rem', borderRadius: '4px' }}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>
      </div>
    </div>
  );
}
