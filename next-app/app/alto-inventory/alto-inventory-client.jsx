'use client';

import { useState, useEffect } from 'react';

export default function AltoInventoryClient() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState('mac_address');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/alto-inventory');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setItems(data.data || []);
      } catch {
        setError('Unable to load Alto inventory data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const filtered = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (item.mac_address || '').toLowerCase().includes(term) ||
      (item.location || '').toLowerCase().includes(term) ||
      (item.customer_issued_to || '').toLowerCase().includes(term) ||
      (item.case_issued_on || '').toLowerCase().includes(term);
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortCol] || '';
    let bVal = b[sortCol] || '';
    if (sortCol === 'date_added' || sortCol === 'date_issued') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const columns = [
    { key: 'mac_address', label: 'MAC Address' },
    { key: 'location', label: 'Location' },
    { key: 'date_added', label: 'Date Added' },
    { key: 'date_issued', label: 'Date Issued' },
    { key: 'customer_issued_to', label: 'Customer Issued To' },
    { key: 'case_issued_on', label: 'Case Issued On' },
  ];

  function exportCSV() {
    const header = columns.map((c) => c.label).join(',');
    const rows = sorted.map((item) =>
      `"${item.mac_address || ''}","${item.location || ''}","${item.date_added ? new Date(item.date_added).toLocaleDateString() : ''}","${item.date_issued ? new Date(item.date_issued).toLocaleDateString() : ''}","${(item.customer_issued_to || '').replace(/"/g, '""')}","${(item.case_issued_on || '').replace(/"/g, '""')}"`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alto_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>Alto Inventory</h1>

      <div className="flex gap-2 items-center mb-4">
        <input
          type="text"
          placeholder="Search by MAC address, location, customer, or case..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded text-sm"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
        <button onClick={exportCSV} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">Export CSV</button>
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left px-4 py-3 font-semibold cursor-pointer select-none hover:text-[var(--color-accent)]"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    {searchTerm ? 'No matching records found.' : 'No Alto inventory records.'}
                  </td>
                </tr>
              ) : (
                sorted.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--color-text-primary)' }}>{item.mac_address}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{item.location}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{item.date_added ? new Date(item.date_added).toLocaleDateString() : ''}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{item.date_issued ? new Date(item.date_issued).toLocaleDateString() : ''}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{item.customer_issued_to}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{item.case_issued_on}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{sorted.length} record{sorted.length !== 1 ? 's' : ''}</p>}
    </div>
  );
}
