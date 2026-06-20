'use client';

import { useState, useEffect, useMemo } from 'react';

const COLUMNS = [
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'asset_type', label: 'Asset Type' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'model_number', label: 'Model Number' },
  { key: 'description', label: 'Description' },
  { key: 'location', label: 'Location' },
  { key: 'asset_status', label: 'Asset Status' },
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'assignment_date', label: 'Assignment Date' },
  { key: 'notes', label: 'Notes' },
];

const FILTERABLE = ['asset_type', 'manufacturer', 'asset_status', 'location'];

export default function EmployeeAssetsClient() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState('serial_number');
  const [sortDir, setSortDir] = useState('asc');
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/employee-assets')
      .then((r) => r.json())
      .then((d) => setAssets(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filterOptions = useMemo(() => {
    const opts = {};
    FILTERABLE.forEach((key) => {
      opts[key] = [...new Set(assets.map((a) => a[key]).filter(Boolean))].sort();
    });
    return opts;
  }, [assets]);

  const filtered = useMemo(() => {
    let rows = assets;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => COLUMNS.some((c) => String(r[c.key] || '').toLowerCase().includes(s)));
    }
    Object.entries(filters).forEach(([key, val]) => {
      if (val) rows = rows.filter((r) => r[key] === val);
    });
    rows = [...rows].sort((a, b) => {
      const av = a[sortCol] || '';
      const bv = b[sortCol] || '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [assets, search, filters, sortCol, sortDir]);

  function handleSort(key) {
    if (sortCol === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  }

  function exportCsv() {
    const header = COLUMNS.map((c) => c.label).join(',');
    const rows = filtered.map((r) => COLUMNS.map((c) => `"${String(r[c.key] || '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'employee-assets.csv';
    a.click();
  }

  return (
    <div className="py-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded text-sm w-56"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
        {FILTERABLE.map((key) => (
          <select
            key={key}
            value={filters[key] || ''}
            onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            className="px-2 py-1.5 rounded text-sm"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="">{COLUMNS.find((c) => c.key === key)?.label}: All</option>
            {(filterOptions[key] || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
        {(search || Object.values(filters).some(Boolean)) && (
          <button onClick={() => { setSearch(''); setFilters({}); }} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-accent)' }}>Clear</button>
        )}
        <button onClick={exportCsv} className="ml-auto px-3 py-1.5 rounded text-sm font-medium" style={{ background: 'var(--color-accent)', color: '#fff' }}>Export CSV</button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-accent)]"
                  style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}
                >
                  {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>No assets found.</td></tr>
            ) : (
              filtered.map((asset, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                      {col.key === 'assignment_date' && asset[col.key] ? new Date(asset[col.key]).toLocaleDateString() : asset[col.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{filtered.length} of {assets.length} assets</p>
    </div>
  );
}
