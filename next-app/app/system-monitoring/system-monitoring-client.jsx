'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTimezone } from '@/lib/format-date.js';

const METRICS = {
  cpu: { label: 'CPU', unit: '%', color: '#2563eb' },
  memory: { label: 'RAM', unit: '%', color: '#16a34a' },
  storage: { label: 'Storage', unit: '%', color: '#d97706' },
  users: { label: 'Users', unit: 'count', color: '#7c3aed' },
};

const RANGES = {
  current: { label: 'Last 3m', slots: 60, axis: ['3m ago', '90s', 'Now'] },
  day: { label: 'Last 24h', slots: 48, axis: ['24h ago', '12h', 'Now'] },
  week: { label: 'Last 7d', slots: 84, axis: ['7d ago', '3.5d', 'Now'] },
};

function emptyHistory() {
  return { current: { cpu: [], memory: [], storage: [], users: [] }, day: { cpu: [], memory: [], storage: [], users: [] }, week: { cpu: [], memory: [], storage: [], users: [] } };
}

function clampPercent(value) { const n = Number(value); if (!Number.isFinite(n)) return 0; return Math.max(0, Math.min(100, n)); }
function nonNegativeNumber(value) { const n = Number(value); if (!Number.isFinite(n)) return 0; return Math.max(0, n); }

function formatBytes(bytes) { const v = Number(bytes); if (!Number.isFinite(v) || v < 0) return 'Unavailable'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; let size = v, unit = 0; while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; } return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`; }
function formatRamGb(bytes) { const v = Number(bytes); if (!Number.isFinite(v) || v < 0) return 'Unavailable'; return `${(v / (1024 ** 3)).toFixed(1)} GB`; }
function formatRamUsedTotal(usedBytes, totalBytes) { const total = Number(totalBytes), used = Number(usedBytes); if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(used)) return 'RAM unavailable'; return `${formatRamGb(Math.max(0, used))} / ${formatRamGb(total)}`; }
function formatStorageBytes(bytes) { return formatBytes(bytes); }
function formatPercent(value) { return `${clampPercent(value).toFixed(0)}%`; }
function formatRawPercent(value) { return `${nonNegativeNumber(value).toFixed(1)}%`; }
function formatCount(value, digits = 0) { const n = nonNegativeNumber(value); if (digits <= 0) return String(Math.round(n)); return n.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }
function maxPointValue(points, selector) { const values = (Array.isArray(points) ? points : []).map(selector).filter(Number.isFinite); return values.length ? Math.max(...values) : 0; }

function formatPointTimestamp(point, rangeKey, tz) { const date = new Date(point?.time); if (Number.isNaN(date.getTime())) return 'Timestamp unavailable'; if (rangeKey === 'week') return date.toLocaleString([], { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); return date.toLocaleTimeString([], { timeZone: tz, hour: 'numeric', minute: '2-digit', second: rangeKey === 'current' ? '2-digit' : undefined }); }
function comparisonTooltip(point, rangeKey, tz) { return [formatPointTimestamp(point, rangeKey, tz), `System ${formatPercent(pointSystemValue(point))}`, `Container ${formatPercent(pointContainerShareValue(point))}`].join('\n'); }
function singleMetricTooltip(point, rangeKey, tz) { return [formatPointTimestamp(point, rangeKey, tz), `Usage ${formatPercent(point?.value)}`].join('\n'); }

function pointUserValue(point) { const value = point?.value; if (value && typeof value === 'object') { const active = nonNegativeNumber(value.active), background = nonNegativeNumber(value.background), total = Math.max(nonNegativeNumber(value.total), active + background); return { active, background, total }; } const total = nonNegativeNumber(value); return { active: total, background: 0, total }; }
function userTooltip(point, rangeKey, tz) { const users = pointUserValue(point); const digits = rangeKey === 'current' ? 0 : 1; const prefix = rangeKey === 'current' ? '' : 'Avg '; return [formatPointTimestamp(point, rangeKey, tz), `${prefix}Total ${formatCount(users.total, digits)}`, `${prefix}Active ${formatCount(users.active, digits)}`, `${prefix}Background ${formatCount(users.background, digits)}`].join('\n'); }

function sampleToPoint(sample, key) {
  if (key === 'cpu') return { time: sample.timestamp, value: sample.cpu || { system: 0, container: 0, containerShare: 0 } };
  if (key === 'memory') return { time: sample.timestamp, value: sample.memory || { system: 0, container: 0, containerShare: 0 } };
  if (key === 'users') { const active = nonNegativeNumber(sample.users?.active ?? sample.users?.count), background = nonNegativeNumber(sample.users?.background), total = Math.max(nonNegativeNumber(sample.users?.total ?? sample.users?.count), active + background); return { time: sample.timestamp, value: { active, background, total } }; }
  return { time: sample.timestamp, value: clampPercent(sample.storage?.used) };
}

function normalizeHistory(apiHistory) { const next = emptyHistory(); Object.keys(RANGES).forEach((rangeKey) => { const samples = Array.isArray(apiHistory?.[rangeKey]) ? apiHistory[rangeKey] : []; Object.keys(METRICS).forEach((metricKey) => { next[rangeKey][metricKey] = samples.map((sample) => sampleToPoint(sample, metricKey)); }); }); return next; }

function sparkPath(points, width = 220, height = 58, scaleMax = 100) { if (!points.length) return ''; const values = points.map((p) => Number(p.value?.system ?? p.value?.total ?? p.value ?? 0)); const max = Math.max(1, Number(scaleMax) || 1); if (points.length === 1) { const y = height - (Math.min(values[0], max) / max) * height; return `M 0 ${y.toFixed(2)} L ${width} ${y.toFixed(2)}`; } return values.map((v, i) => { const x = (i / (points.length - 1)) * width; const y = height - (Math.min(v, max) / max) * height; return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`; }).join(' '); }

function fixedSlotHistory(points, rangeKey) { const slotCount = RANGES[rangeKey]?.slots || 60; const measured = Array.isArray(points) ? points.slice(-slotCount) : []; const blankCount = Math.max(0, slotCount - measured.length); return [...Array(blankCount).fill(null), ...measured]; }
function measuredPoints(points) { return Array.isArray(points) ? points.filter(Boolean) : []; }
function pointSystemValue(point) { return Number(point?.value?.system ?? point?.value?.total ?? point?.value ?? 0); }
function pointContainerShareValue(point) { return Number(point?.value?.containerShare ?? point?.value?.container ?? 0); }

function MetricCard({ metricKey, metrics, history, active, onSelect }) {
  const config = METRICS[metricKey];
  const cpu = metrics?.cpu || {}, memory = metrics?.memory || {}, storage = metrics?.storage || {}, users = metrics?.users || {};
  let value = 0, primary = '', primaryDetail = '', secondary = '', meta = '';

  if (metricKey === 'cpu') { value = clampPercent(cpu.systemUsagePercent ?? cpu.usagePercent); const containerValue = nonNegativeNumber(cpu.containerUsagePercent ?? metrics?.container?.cpu?.usagePercent); const containerShare = clampPercent(containerValue / Math.max(1, Number(cpu.logicalCores || 1))); primary = formatPercent(value); secondary = `Container share ${formatPercent(containerShare)}`; meta = `Docker CPU ${formatRawPercent(containerValue)} - ${cpu.logicalCores || 0} logical processors`; }
  else if (metricKey === 'memory') { const sysMem = memory.system || memory; const contMem = memory.container || metrics?.container?.memory || {}; const containerShare = Number(sysMem.totalBytes) > 0 ? clampPercent((Number(contMem.usedBytes || 0) / Number(sysMem.totalBytes)) * 100) : 0; value = clampPercent(sysMem.usedPercent); primary = formatPercent(value); primaryDetail = formatRamUsedTotal(sysMem.usedBytes, sysMem.totalBytes); secondary = `Container share ${formatPercent(containerShare)}`; meta = Number(contMem.totalBytes) > 0 ? `${formatBytes(contMem.usedBytes)} / ${formatBytes(contMem.totalBytes)} container` : `${formatBytes(contMem.usedBytes)} container`; }
  else if (metricKey === 'users') { const activeUsers = nonNegativeNumber(users.active), backgroundUsers = nonNegativeNumber(users.background); value = nonNegativeNumber(users.total ?? activeUsers + backgroundUsers); primary = formatCount(value); secondary = `${formatCount(activeUsers)} active - ${formatCount(backgroundUsers)} background`; meta = ''; }
  else { value = clampPercent(storage.usedPercent); primary = `${formatStorageBytes(storage.freeBytes)} free`; secondary = metrics?.database?.sizeBytes ? `Database usage ${formatStorageBytes(metrics.database.sizeBytes)}` : 'Database usage unavailable'; meta = `${formatStorageBytes(storage.usedBytes)} used of ${formatStorageBytes(storage.totalBytes)}`; }

  return (
    <button type="button" className={`flex flex-col min-h-[218px] p-4 text-left border rounded-lg shadow-sm cursor-pointer transition-all ${active ? 'border-blue-500 shadow-[0_10px_24px_rgba(37,99,235,0.12)] -translate-y-px' : 'border-[var(--color-border)] hover:border-blue-500 hover:shadow-[0_10px_24px_rgba(37,99,235,0.12)] hover:-translate-y-px'}`} style={{ background: 'var(--color-surface)' }} onClick={() => onSelect(metricKey)} aria-pressed={active}>
      <div className="flex justify-between items-baseline gap-3 mb-3">
        <span className="text-[var(--color-text-secondary)] text-xs font-extrabold uppercase">{config.label}</span>
        <span className="flex flex-wrap items-baseline gap-2 justify-end min-w-0">
          {primaryDetail && <span className="text-[var(--color-text-secondary)] text-sm font-bold whitespace-nowrap">{primaryDetail}</span>}
          <span className={`text-[var(--color-text-primary)] font-bold leading-none ${metricKey === 'storage' ? 'text-lg max-w-[9.5rem]' : 'text-2xl'}`}>{primary}</span>
        </span>
      </div>
      <div className="bg-[var(--color-border)] rounded-full h-2 overflow-hidden">
        <span className="block h-full min-w-[2px]" style={{ width: metricKey === 'users' ? `${Math.min(100, (value / Math.max(1, maxPointValue(history, (p) => pointUserValue(p).total))) * 100)}%` : `${value}%`, backgroundColor: config.color }} />
      </div>
      <svg className="w-full h-[58px] my-4" viewBox="0 0 220 58" preserveAspectRatio="none" aria-hidden="true">
        <path d={sparkPath(history, 220, 58, metricKey === 'users' ? maxPointValue(history, (p) => pointUserValue(p).total) : 100)} fill="none" stroke={config.color} strokeWidth="3" />
      </svg>
      <div className="text-[var(--color-text-primary)] text-sm font-bold overflow-hidden text-ellipsis whitespace-nowrap">{secondary}</div>
      <div className="text-[var(--color-text-muted)] text-xs leading-snug mt-0.5 min-h-[2.2em] overflow-hidden">{meta}</div>
      <div className="border-t border-[var(--color-border)] text-blue-700 text-xs font-bold mt-auto pt-3">Open chart</div>
    </button>
  );
}

function ComparisonBars({ history, rangeKey }) {
  const { timezone } = useTimezone();
  const samples = fixedSlotHistory(history, rangeKey);
  return (
    <div className="flex items-end gap-1 h-[240px] w-full px-1 bg-[length:100%_25%,10%_100%] bg-[linear-gradient(to_top,#dbe3ef_1px,transparent_1px),linear-gradient(to_right,#eef2f7_1px,transparent_1px)]" aria-hidden="true">
      {samples.map((point, index) => {
        if (!point) return <div className="flex-1 h-full min-w-[2px]" key={`empty-${index}`} />;
        const system = clampPercent(pointSystemValue(point));
        const container = clampPercent(pointContainerShareValue(point));
        const total = Math.max(system, container);
        const otherSystem = Math.max(0, total - container);
        return (
          <div className="flex-1 flex items-end h-full min-w-[2px]" key={`${point.time}-${index}`} title={comparisonTooltip(point, rangeKey, timezone)}>
            <span className="flex flex-col justify-end w-full rounded-t-[5px] overflow-hidden shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]" style={{ height: `${Math.max(2, total)}%` }}>
              <span className="block w-full bg-blue-600" style={{ height: total > 0 ? `${(otherSystem / total) * 100}%` : '0%' }} />
              <span className="block w-full bg-teal-500" style={{ height: total > 0 ? `${(container / total) * 100}%` : '0%' }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SingleMetricBars({ history, rangeKey, color, metricKey, scaleMax = 100 }) {
  const { timezone } = useTimezone();
  const samples = fixedSlotHistory(history, rangeKey);
  const max = Math.max(1, Number(scaleMax) || 1);
  return (
    <div className="flex items-end gap-1 h-[240px] w-full px-1 bg-[length:100%_25%,10%_100%] bg-[linear-gradient(to_top,#dbe3ef_1px,transparent_1px),linear-gradient(to_right,#eef2f7_1px,transparent_1px)]" aria-hidden="true">
      {samples.map((point, index) => {
        if (!point) return <div className="flex-1 h-full min-w-[2px]" key={`empty-${index}`} />;
        const users = pointUserValue(point);
        const value = clampPercent(point.value);
        const rawValue = metricKey === 'users' ? users.total : nonNegativeNumber(point.value);
        const height = metricKey === 'users' ? Math.min(100, (rawValue / max) * 100) : value;
        const userSegmentTotal = Math.max(users.total, users.active + users.background);
        const activeHeight = userSegmentTotal > 0 ? (users.active / userSegmentTotal) * 100 : 0;
        const backgroundHeight = userSegmentTotal > 0 ? (users.background / userSegmentTotal) * 100 : 0;
        return (
          <div className="flex-1 flex items-end h-full min-w-[2px]" key={`${point.time}-${index}`} title={metricKey === 'users' ? userTooltip(point, rangeKey, timezone) : singleMetricTooltip(point, rangeKey, timezone)}>
            {metricKey === 'users' ? (
              <span className="flex flex-col justify-end w-full rounded-t-[5px] overflow-hidden shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]" style={{ height: `${Math.max(2, height)}%` }}>
                <span className="block w-full bg-purple-400" style={{ height: `${backgroundHeight}%` }} />
                <span className="block w-full bg-purple-600" style={{ height: `${activeHeight}%` }} />
              </span>
            ) : (
              <span className="block w-full rounded-t-[5px] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]" style={{ height: `${Math.max(2, height)}%`, backgroundColor: color }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChartAxis({ rangeKey }) {
  const labels = RANGES[rangeKey]?.axis || [];
  return (
    <div className="flex justify-between text-[var(--color-text-muted)] text-xs font-bold pt-2 pr-11 pl-4">
      {labels.map((label) => <span key={label}>{label}</span>)}
    </div>
  );
}

function RangeControls({ activeRange, onRangeChange }) {
  return (
    <div className="flex gap-0.5 p-0.5 border border-[var(--color-border)] rounded-lg" style={{ background: 'var(--color-border)' }} aria-label="History range">
      {Object.entries(RANGES).map(([rangeKey, range]) => (
        <button key={rangeKey} type="button" onClick={() => onRangeChange(rangeKey)} className={`px-3 py-2 text-sm font-bold rounded-md border border-transparent cursor-pointer ${activeRange === rangeKey ? 'shadow-sm text-[var(--color-text-primary)] !border-[var(--color-border)]' : 'bg-transparent text-[var(--color-text-secondary)]'}`} style={activeRange === rangeKey ? { background: 'var(--color-surface)' } : undefined}>
          {range.label}
        </button>
      ))}
    </div>
  );
}

function DetailChart({ metricKey, history, metrics, rangeKey, onRangeChange }) {
  const { timezone } = useTimezone();
  const config = METRICS[metricKey];
  const isCompared = metricKey === 'cpu' || metricKey === 'memory';
  const isUsers = metricKey === 'users';
  const points = measuredPoints(history);
  const latestPointValue = points.length ? pointSystemValue(points[points.length - 1]) : 0;
  const current = isUsers ? nonNegativeNumber(metrics?.users?.total ?? latestPointValue) : latestPointValue;
  const peak = points.length ? Math.max(...points.map(pointSystemValue)) : 0;
  const containerSharePeak = points.length ? Math.max(...points.map(pointContainerShareValue)) : 0;
  const average = points.length ? points.reduce((sum, p) => sum + pointSystemValue(p), 0) / points.length : 0;
  const containerShareAverage = points.length ? points.reduce((sum, p) => sum + pointContainerShareValue(p), 0) / points.length : 0;
  const activeUserAverage = points.length ? points.reduce((sum, p) => sum + pointUserValue(p).active, 0) / points.length : 0;
  const backgroundUserAverage = points.length ? points.reduce((sum, p) => sum + pointUserValue(p).background, 0) / points.length : 0;

  const subtitle = metricKey === 'cpu' ? `System CPU with ${metrics?.container?.name || 'container'} share`
    : metricKey === 'memory' ? `System RAM with ${metrics?.container?.name || 'container'} share`
    : metricKey === 'users' ? `Open users by recent heartbeat`
    : `${formatStorageBytes(metrics?.storage?.freeBytes)} free on ${metrics?.storage?.mount || metrics?.storage?.path || 'disk'}${metrics?.database?.name ? ` - ${metrics.database.name} ${formatStorageBytes(metrics.database.sizeBytes)}` : ''}`;
  const singleScaleMax = isUsers ? Math.max(1, Math.ceil(peak)) : 100;
  const formatDetailValue = (v, avg = false) => isUsers ? formatCount(v, avg || rangeKey !== 'current' ? 1 : 0) : formatPercent(v);
  const formatAxisValue = (v) => isUsers ? formatCount(v, Number.isInteger(nonNegativeNumber(v)) ? 0 : 1) : null;

  return (
    <section className="border border-[var(--color-border)] rounded-lg shadow-sm p-5" style={{ background: 'var(--color-surface)' }} aria-label={`${config.label} utilization chart`}>
      <div className="flex justify-between items-start gap-4 mb-4 max-sm:flex-col max-sm:items-stretch">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-0.5">{config.label}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-3 ml-auto max-sm:items-stretch max-sm:ml-0">
          <RangeControls activeRange={rangeKey} onRangeChange={onRangeChange} />
          {!isCompared && (
            <div className="text-right max-sm:text-left">
              <span className="block text-3xl font-bold text-[var(--color-text-primary)] leading-none">{formatDetailValue(current)}</span>
              <small className="text-[var(--color-text-muted)] text-xs font-bold uppercase">current</small>
            </div>
          )}
        </div>
      </div>

      {isCompared && (
        <div className="flex gap-4 justify-end -mt-1 mb-3">
          <span className="inline-flex items-center text-[var(--color-text-secondary)] text-xs font-bold gap-1.5"><i className="inline-block w-[18px] h-2.5 rounded-sm bg-blue-600" />System remainder</span>
          <span className="inline-flex items-center text-[var(--color-text-secondary)] text-xs font-bold gap-1.5"><i className="inline-block w-[18px] h-2.5 rounded-sm bg-teal-500" />Container portion</span>
        </div>
      )}
      {isUsers && (
        <div className="flex gap-4 justify-end -mt-1 mb-3">
          <span className="inline-flex items-center text-[var(--color-text-secondary)] text-xs font-bold gap-1.5"><i className="inline-block w-[18px] h-2.5 rounded-sm bg-purple-600" />Active</span>
          <span className="inline-flex items-center text-[var(--color-text-secondary)] text-xs font-bold gap-1.5"><i className="inline-block w-[18px] h-2.5 rounded-sm bg-purple-400" />Background</span>
        </div>
      )}

      <div className="relative min-h-[280px] p-4 pr-11 border border-[var(--color-border)] rounded-md" style={{ background: 'var(--color-surface-raised)' }}>
        {isCompared ? <ComparisonBars history={history} rangeKey={rangeKey} /> : <SingleMetricBars history={history} rangeKey={rangeKey} color={config.color} metricKey={metricKey} scaleMax={singleScaleMax} />}
        <div className="absolute right-3 top-3 bottom-3 flex flex-col justify-between text-[var(--color-text-muted)] text-[0.72rem] font-bold">
          <span>{isUsers ? formatAxisValue(singleScaleMax) : '100%'}</span>
          <span>{isUsers ? formatAxisValue(singleScaleMax / 2) : '50%'}</span>
          <span>{isUsers ? '0' : '0%'}</span>
        </div>
      </div>
      <ChartAxis rangeKey={rangeKey} />

      <div className="grid grid-cols-4 gap-3 mt-4 max-sm:grid-cols-1">
        <div className="border border-[var(--color-border)] rounded-md p-3" style={{ background: 'var(--color-surface-raised)' }}><span className="block text-[var(--color-text-muted)] text-xs font-bold uppercase mb-0.5">{isCompared ? 'System Avg' : isUsers ? 'Total Avg' : 'Average'}</span><strong className="text-[var(--color-text-primary)]">{formatDetailValue(average, true)}</strong></div>
        <div className="border border-[var(--color-border)] rounded-md p-3" style={{ background: 'var(--color-surface-raised)' }}><span className="block text-[var(--color-text-muted)] text-xs font-bold uppercase mb-0.5">{isCompared ? 'System Max' : isUsers ? 'Total Max' : 'Peak'}</span><strong className="text-[var(--color-text-primary)]">{formatDetailValue(peak)}</strong></div>
        <div className="border border-[var(--color-border)] rounded-md p-3" style={{ background: 'var(--color-surface-raised)' }}><span className="block text-[var(--color-text-muted)] text-xs font-bold uppercase mb-0.5">{isCompared ? 'Container Avg' : isUsers ? 'Active Avg' : 'Samples'}</span><strong className="text-[var(--color-text-primary)]">{isCompared ? formatPercent(containerShareAverage) : isUsers ? formatCount(activeUserAverage, 1) : points.length}</strong></div>
        <div className="border border-[var(--color-border)] rounded-md p-3" style={{ background: 'var(--color-surface-raised)' }}><span className="block text-[var(--color-text-muted)] text-xs font-bold uppercase mb-0.5">{isCompared ? 'Container Max' : isUsers ? 'Background Avg' : 'Updated'}</span><strong className="text-[var(--color-text-primary)]">{isCompared ? formatPercent(containerSharePeak) : isUsers ? formatCount(backgroundUserAverage, 1) : (metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString([], { timeZone: timezone }) : 'Waiting')}</strong></div>
      </div>
    </section>
  );
}

function StatusPill({ label, ok, detail, meta }) {
  return (
    <div className="flex items-center gap-3 border border-[var(--color-border)] rounded-lg min-h-[74px] px-4 py-3" style={{ background: 'var(--color-surface)' }}>
      <span className={`block w-3 h-3 rounded-full shrink-0 ${ok ? 'bg-green-600 shadow-[0_0_0_4px_rgba(22,163,74,0.12)]' : 'bg-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.12)]'}`} />
      <div>
        <strong className="block text-[var(--color-text-primary)] text-sm">{label}</strong>
        <span className="block text-[var(--color-text-muted)] text-xs leading-snug mt-0.5">{detail}</span>
        {meta && <small className="block text-[var(--color-text-muted)] text-[0.74rem] leading-tight mt-0.5">{meta}</small>}
      </div>
    </div>
  );
}

export default function SystemMonitoringClient() {
  const { timezone } = useTimezone();
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState(emptyHistory);
  const [activeMetric, setActiveMetric] = useState('cpu');
  const [activeRange, setActiveRange] = useState('current');
  const [pageVisible, setPageVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshMetrics = useCallback(async () => {
    try {
      const metricRes = await fetch(`/api/system-metrics?range=${activeRange}`, { cache: 'no-store' });
      if (!metricRes.ok) { const errorBody = await metricRes.json().catch(() => ({})); throw new Error(errorBody.detail || errorBody.error || 'System metrics unavailable'); }
      const nextMetrics = await metricRes.json();
      setMetrics(nextMetrics);
      setHistory(normalizeHistory(nextMetrics.history));
      setError('');
    } catch (err) { setError(err.message || 'Unable to refresh system metrics'); }
    finally { setLoading(false); }
  }, [activeRange]);

  const refreshHealth = useCallback(async () => {
    try {
      const [dbRes, writeRes] = await Promise.all([fetch('/api/db-health', { cache: 'no-store' }), fetch('/api/write-safety/status', { cache: 'no-store' })]);
      const db = dbRes.ok ? await dbRes.json() : { status: 'error' };
      const writes = writeRes.ok ? await writeRes.json() : {};
      setHealth({ db, writes });
    } catch { setHealth({ db: { status: 'error' }, writes: {} }); }
  }, []);

  useEffect(() => { const h = () => setPageVisible(document.visibilityState === 'visible'); h(); document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h); }, []);
  useEffect(() => { refreshMetrics(); if (!pageVisible) return; const t = setInterval(refreshMetrics, 4000); return () => clearInterval(t); }, [refreshMetrics, pageVisible]);
  useEffect(() => { refreshHealth(); if (!pageVisible) return; const t = setInterval(refreshHealth, 45000); return () => clearInterval(t); }, [refreshHealth, pageVisible]);

  const status = useMemo(() => ({ dbOk: health?.db?.status === 'ok' || health?.db?.connected, writesEnabled: Boolean(health?.writes?.writesEnabled || health?.writes?.enabled) }), [health]);
  const databaseName = metrics?.database?.name || health?.db?.database || 'Unavailable';
  const environmentLabel = metrics?.environment?.label || 'development';
  const environmentBranch = metrics?.environment?.branch || 'local';

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="border rounded-md text-sm px-4 py-3" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>{error}</div>}

      <section className="grid grid-cols-4 gap-4 max-sm:grid-cols-1" aria-label="Application status">
        <StatusPill label="Database" ok={status.dbOk} detail={status.dbOk ? databaseName : 'Unavailable'} meta={metrics?.database?.sizeBytes ? `${formatStorageBytes(metrics.database.sizeBytes)} stored` : 'Size unavailable'} />
        <StatusPill label="Environment" ok detail={environmentLabel} meta={`Branch ${environmentBranch}`} />
        <StatusPill label="Application" ok detail="Next.js service running" />
      </section>

      <div className="grid grid-cols-4 gap-3.5 max-sm:grid-cols-1">
        {Object.keys(METRICS).map((metricKey) => (
          <MetricCard key={metricKey} metricKey={metricKey} metrics={metrics} history={history.current[metricKey]} active={activeMetric === metricKey} onSelect={setActiveMetric} />
        ))}
      </div>

      <p className="text-[var(--color-text-muted)] text-sm text-right -mt-1 -mb-1">System totals already include Docker. The teal segment is the container portion inside that total; it is never added on top of system usage.</p>

      <DetailChart metricKey={activeMetric} history={history[activeRange][activeMetric]} metrics={metrics} rangeKey={activeRange} onRangeChange={setActiveRange} />
    </div>
  );
}
