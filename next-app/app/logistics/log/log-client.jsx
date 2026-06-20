'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTimezone } from '@/lib/format-date.js';

const LIMIT = 100;
const TIMEFRAME_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function LogisticsLogClient() {
  const { fmt } = useTimezone();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [timeframe, setTimeframe] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [caseSearch, setCaseSearch] = useState('');
  const [caseInput, setCaseInput] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState(-1);
  const [filterOptions, setFilterOptions] = useState({ eventTypes: [], users: [] });

  const fetchData = useCallback(async (newOffset = 0) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: LIMIT, offset: newOffset });
    if (timeframe) params.set('timeframe_days', timeframe);
    if (eventFilter) params.set('event_type', eventFilter);
    if (userFilter) params.set('user_id', userFilter);
    if (caseSearch) params.set('case_search', caseSearch);
    const res = await fetch(`/api/logistics/log?${params}`);
    if (res.ok) {
      const d = await res.json();
      setRows(d.data || []);
      setTotal(d.total || 0);
      if (d.filterOptions) setFilterOptions(d.filterOptions);
    }
    setLoading(false);
  }, [timeframe, eventFilter, userFilter, caseSearch]);

  useEffect(() => { setOffset(0); fetchData(0); }, [fetchData]);
  const handlePageChange = (newOffset) => { setOffset(newOffset); fetchData(newOffset); };

  // Debounced case search
  useEffect(() => {
    const timer = setTimeout(() => setCaseSearch(caseInput), 400);
    return () => clearTimeout(timer);
  }, [caseInput]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = String(a[sortKey] || ''), bv = String(b[sortKey] || '');
      return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * sortDir;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  };
  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '';

  const filterCls = "input-themed px-2 py-1.5 text-xs rounded";
  const thCls = "text-left px-2.5 py-2 font-semibold text-xs cursor-pointer whitespace-nowrap border-b-2";
  const tdCls = "px-2.5 py-2 text-xs border-b";

  return (
    <div className="px-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className={filterCls} aria-label="Timeframe filter">
          {TIMEFRAME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className={filterCls} aria-label="Event type filter">
          <option value="">All events</option>
          {filterOptions.eventTypes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        {filterOptions.users.length > 1 && (
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className={filterCls} aria-label="User filter">
            <option value="">All users</option>
            {filterOptions.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <input type="text" placeholder="Search case…" value={caseInput} onChange={(e) => setCaseInput(e.target.value)} className={`${filterCls} w-[140px]`} aria-label="Case search" />
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>{total} total records</span>
      </div>

      {/* Table */}
      {loading ? (
        <p className="py-8" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-8" style={{ color: 'var(--color-text-muted)' }}>{timeframe || eventFilter || userFilter || caseSearch ? 'No records match the current filters.' : 'No log entries yet.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('created_at')}>Time{sortIcon('created_at')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('display_name')}>User{sortIcon('display_name')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('event_type')}>Event{sortIcon('event_type')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('case_value')}>Case{sortIcon('case_value')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('customer_value')}>Customer{sortIcon('customer_value')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('location_value')}>Location{sortIcon('location_value')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('customer_asset_value')}>Asset{sortIcon('customer_asset_value')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('stage_value')}>Stage{sortIcon('stage_value')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('new_sub_status')}>Sub-Status{sortIcon('new_sub_status')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('escalation_state')}>Escalated{sortIcon('escalation_state')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('notify_rc_state')}>Notify RC{sortIcon('notify_rc_state')}</th>
                <th className={thCls} style={{ borderColor: 'var(--color-border)' }} onClick={() => toggleSort('reason_notes')}>Notes{sortIcon('reason_notes')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                  <td className={`${tdCls} whitespace-nowrap`} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.created_at ? fmt(r.created_at) : '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.display_name || r.username || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.event_type || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.case_value || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.customer_value || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.location_value || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.customer_asset_value || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.stage_value || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.new_sub_status || '—'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.escalation_state == null ? '—' : r.escalation_state ? 'Yes' : 'No'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.notify_rc_state == null ? '—' : r.notify_rc_state ? 'Yes' : 'No'}</td>
                  <td className={`${tdCls} max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap`} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} title={r.reason_notes || ''}>{r.reason_notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex gap-2 items-center mt-4 pb-4">
        <button disabled={offset === 0} onClick={() => handlePageChange(Math.max(0, offset - LIMIT))} className="btn-neutral px-3 py-1.5 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed">← Previous</button>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{total > 0 ? `${offset + 1}–${Math.min(offset + rows.length, total)} of ${total}` : 'No records'}</span>
        <button disabled={offset + LIMIT >= total} onClick={() => handlePageChange(offset + LIMIT)} className="btn-neutral px-3 py-1.5 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed">Next →</button>
      </div>
    </div>
  );
}
