'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/lib/format-date.js';

export default function LedgerClient() {
  const { fmt } = useTimezone();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [partNo, setPartNo] = useState('');
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  function toggleSort(col) { if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortCol(col); setSortDir('asc'); } setPage(1); }
  function sortIcon(col) { if (sortCol !== col) return ''; return sortDir === 'asc' ? ' ▲' : ' ▼'; }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (partNo) params.set('part_no', partNo);
    if (workOrderNo) params.set('work_order_no', workOrderNo);
    if (userFilter) params.set('user', userFilter);
    if (since) params.set('since', since);
    if (until) params.set('until', until);
    params.set('limit', String(pageSize));
    params.set('offset', String((page - 1) * pageSize));
    if (sortCol) { params.set('sort_col', sortCol); params.set('sort_dir', sortDir); }
    const res = await fetch(`/api/ledger?${params}`);
    if (res.ok) { const d = await res.json(); setRows(d.data || []); setPages(d.pages || 0); }
    setLoading(false);
  }, [action, partNo, workOrderNo, userFilter, since, until, page, pageSize, sortCol, sortDir]);

  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t); }, [fetchData]);

  const filterCls = "input-themed px-3 py-2 rounded-md text-sm";

  return (
    <div className="py-8 max-w-[1200px] mx-auto">
      <div className="flex gap-2 flex-wrap mb-6">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={filterCls}>
          <option value="">All Actions</option>
          <option value="checkout">Checkout</option>
          <option value="checkin">Check In</option>
          <option value="issue">Issue</option>
          <option value="adjustment">Adjustment</option>
          <option value="location_change">Location Change</option>
          <option value="description_change">Description Change</option>
          <option value="rename">Rename</option>
        </select>
        <input placeholder="Part No" value={partNo} onChange={(e) => { setPartNo(e.target.value); setPage(1); }} className={filterCls} />
        <input placeholder="Case Number" value={workOrderNo} onChange={(e) => { setWorkOrderNo(e.target.value); setPage(1); }} className={filterCls} />
        <input placeholder="User" value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }} className={filterCls} />
        <input type="date" value={since} onChange={(e) => { setSince(e.target.value); setPage(1); }} title="From" className={filterCls} />
        <input type="date" value={until} onChange={(e) => { setUntil(e.target.value); setPage(1); }} title="To" className={filterCls} />
      </div>
      {loading ? <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading...</div> : rows.length === 0 ? <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No records</div> : (
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead><tr style={{ background: 'var(--color-surface-raised)' }}>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('event_time')}>Time{sortIcon('event_time')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('work_order_no')}>Case Number{sortIcon('work_order_no')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('user_upn')}>User{sortIcon('user_upn')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('action')}>Action{sortIcon('action')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('part_no')}>Part No{sortIcon('part_no')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('qty')}>Qty{sortIcon('qty')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('prev_qty')}>Prev{sortIcon('prev_qty')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('new_qty')}>New{sortIcon('new_qty')}</th>
            </tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.event_time ? fmt(r.event_time) : ''}</td>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.work_order_no}</td>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.user_upn}</td>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.action}</td>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.part_no}</td>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.qty}</td>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{['location_change','description_change','rename'].includes(r.action) ? (r.location || '').split(' → ')[0] || '-' : r.prev_qty}</td>
                <td className="px-4 py-3 border-b text-sm" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{['location_change','description_change','rename'].includes(r.action) ? (r.location || '').split(' → ')[1] || '-' : r.new_qty}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>← Prev</button>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Next →</button>
        </div>
      )}
      <div className="flex items-center mt-2" style={{ justifyContent: 'flex-end' }}>
        <label className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>Rows per page:
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="input-themed px-1 py-0.5 rounded text-xs">
            <option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
          </select>
        </label>
      </div>
    </div>
  );
}
