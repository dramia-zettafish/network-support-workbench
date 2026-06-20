'use client';
import { useState, useEffect } from 'react';

export default function OperationsInsightsClient() {
  const [view, setView] = useState('netsync');
  const [workflow, setWorkflow] = useState('');
  const [program, setProgram] = useState('');
  const [programs, setPrograms] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerWorkflows, setCustomerWorkflows] = useState([]);
  const [customerWorkflow, setCustomerWorkflow] = useState('');
  const [customerPrograms, setCustomerPrograms] = useState([]);
  const [customerProgram, setCustomerProgram] = useState('');
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/programs').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setPrograms(d.data.filter(p => p.is_active)); }).catch(() => {});
    fetch('/api/cases/insights?customers=1').then(r => r.ok ? r.json() : null).then(d => { if (d?.customers) setCustomers(d.customers); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCustomer) { setCustomerWorkflows([]); setCustomerWorkflow(''); setCustomerPrograms([]); setCustomerProgram(''); return; }
    fetch(`/api/cases/insights?customer_workflows=${encodeURIComponent(selectedCustomer)}`).then(r => r.ok ? r.json() : null).then(d => {
      const wfs = d?.workflows || [];
      setCustomerWorkflows(wfs);
      setCustomerWorkflow(wfs.length === 1 ? wfs[0].workflow_key : '');
    }).catch(() => {});
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer || !customerWorkflow) { setCustomerPrograms([]); setCustomerProgram(''); return; }
    fetch(`/api/cases/insights?customer_programs=${encodeURIComponent(selectedCustomer)}&workflow=${encodeURIComponent(customerWorkflow)}`).then(r => r.ok ? r.json() : null).then(d => {
      setCustomerPrograms(d?.programs || []);
    }).catch(() => {});
  }, [selectedCustomer, customerWorkflow]);

  useEffect(() => {
    if (!selectedCustomer || !customerWorkflow) { setReport(null); return; }
    setReportLoading(true);
    const params = new URLSearchParams({ customer_report: selectedCustomer, workflow: customerWorkflow });
    if (customerProgram) params.set('program', customerProgram);
    fetch(`/api/cases/insights?${params}`).then(r => r.ok ? r.json() : null).then(d => setReport(d)).catch(() => {}).finally(() => setReportLoading(false));
  }, [selectedCustomer, customerWorkflow, customerProgram]);

  useEffect(() => {
    if (!workflow) { setData(null); return; }
    setLoading(true);
    const params = new URLSearchParams({ workflow });
    if (program) params.set('program', program);
    fetch(`/api/cases/insights?${params}`).then(r => r.ok ? r.json() : null).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, [workflow, program]);

  const weekMax = data?.by_week?.length ? Math.max(...data.by_week.map(r => r.count)) : 1;
  const teamMax = data?.by_team?.length ? Math.max(...data.by_team.map(r => r.count)) : 1;

  return (
    <div className="pb-8">
      <div className="flex gap-2 mb-4 items-center">
        <button onClick={() => setView('netsync')} className={`px-4 py-2 text-sm font-medium rounded ${view === 'netsync' ? 'bg-blue-600 text-white' : ''}`} style={view !== 'netsync' ? { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } : undefined}>Service Center</button>
        <button onClick={() => setView('customer')} className={`px-4 py-2 text-sm font-medium rounded ${view === 'customer' ? 'bg-blue-600 text-white' : ''}`} style={view !== 'customer' ? { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } : undefined}>Customer</button>
        {view === 'customer' && report && <button onClick={() => { const el = document.getElementById('customer-report'); const w = window.open('', '_blank'); w.document.write(`<html><head><title>Customer Report</title><style>body{font-family:Arial,sans-serif;padding:20px}h4,h5{margin:12px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}</style></head><body>`); w.document.write(el.innerHTML); w.document.write('</body></html>'); w.document.close(); setTimeout(() => { w.print(); w.close(); }, 300); }} className="ml-auto px-4 py-2 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700">Export PDF</button>}
      </div>

      {view === 'netsync' && <>
      <div className="flex gap-3 mb-8 flex-wrap">
        <select value={workflow} onChange={(e) => { setWorkflow(e.target.value); setProgram(''); }} className="input-themed px-3 py-2 rounded-md text-sm">
          <option value="">Select Workflow</option>
          <option value="rma">RMA</option>
          <option value="refresh">Refresh</option>
        </select>
        {workflow === 'refresh' && (
          <select value={program} onChange={(e) => setProgram(e.target.value)} className="input-themed px-3 py-2 rounded-md text-sm">
            <option value="">All Programs</option>
            {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        )}
      </div>

      {!workflow && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Select a workflow to view insights.</p>}
      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8 max-sm:grid-cols-1">
            <div className="rounded-lg p-4 border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
              <div className="text-xs uppercase font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Total Cases</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{data.total}</div>
            </div>
            <div className="rounded-lg p-4 border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
              <div className="text-xs uppercase font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Open Cases</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{data.open}</div>
            </div>
            <div className="rounded-lg p-4 border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
              <div className="text-xs uppercase font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Avg Age (Open)</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{data.avg_age_days} days</div>
            </div>
          </div>

          {/* Cases by Stage + Cases by Owning Team side by side */}
          <div className="grid grid-cols-2 gap-4 mb-6 max-sm:grid-cols-1">
          <div className="rounded-lg border p-5" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cases by Stage</h2>
            <div className="flex items-center gap-8 flex-wrap">
              <svg viewBox="-1 -1 2 2" width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
                {(() => {
                  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#e11d48'];
                  const total = data.by_stage.reduce((s, r) => s + r.count, 0);
                  let cum = 0;
                  return data.by_stage.map((r, i) => {
                    const frac = r.count / total;
                    const start = cum;
                    cum += frac;
                    const x1 = Math.cos(2 * Math.PI * start), y1 = Math.sin(2 * Math.PI * start);
                    const x2 = Math.cos(2 * Math.PI * cum), y2 = Math.sin(2 * Math.PI * cum);
                    const large = frac > 0.5 ? 1 : 0;
                    return <path key={r.stage} d={frac >= 1 ? 'M 1 0 A 1 1 0 1 1 -1 0 A 1 1 0 1 1 1 0' : `M ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} L 0 0`} fill={colors[i % colors.length]} />;
                  });
                })()}
              </svg>
              <div className="grid gap-1.5">
                {data.by_stage.map((r, i) => {
                  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#e11d48'];
                  return (
                    <div key={r.stage} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: colors[i % colors.length] }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.stage || 'Unknown'} ({r.count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-5" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cases by Owning Team</h2>
            <div className="space-y-2">
              {data.by_team.map(r => (
                <div key={r.team} className="flex items-center gap-3">
                  <span className="text-xs w-40 truncate" style={{ color: 'var(--color-text-secondary)' }}>{r.team}</span>
                  <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'var(--color-border)' }}>
                    <div className="h-full rounded" style={{ width: `${(r.count / teamMax) * 100}%`, background: '#10b981' }} />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right" style={{ color: 'var(--color-text-primary)' }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>
          </div>

          {/* Weekly Case Creation */}
          <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cases Created (Last 12 Weeks)</h2>
            <div className="flex" style={{ height: '180px' }}>
              {/* Y axis */}
              <div className="flex flex-col justify-between items-end pr-2" style={{ width: '30px' }}>
                {[weekMax, Math.round(weekMax * 0.75), Math.round(weekMax * 0.5), Math.round(weekMax * 0.25), 0].map(v => (
                  <span key={v} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{v}</span>
                ))}
              </div>
              {/* Bars */}
              <div className="flex-1 flex items-end gap-1 border-l border-b" style={{ borderColor: 'var(--color-border)' }}>
                {data.by_week.map((r, i) => (
                  <div key={r.week} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div className="w-full max-w-[32px] mx-auto rounded-t" style={{ height: `${(r.count / weekMax) * 100}%`, minHeight: r.count ? '4px' : '0', background: '#3b82f6' }} title={`${r.week}: ${r.count} cases`} />
                  </div>
                ))}
              </div>
            </div>
            {/* X axis labels */}
            <div className="flex" style={{ paddingLeft: '30px' }}>
              {data.by_week.map((r, i) => (
                <div key={r.week} className="flex-1 text-center">
                  {i === 0 || i === Math.floor(data.by_week.length / 2) || i === data.by_week.length - 1 ? (
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{r.week.slice(5)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostics Performed (Stacked by Tech) */}
          {data.diagnostics?.length > 0 && (() => {
            const techs = [...new Set(data.diagnostics.map(r => r.tech))];
            const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
            const techColor = Object.fromEntries(techs.map((t, i) => [t, colors[i % colors.length]]));
            const allDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
            const dayData = allDays.map(d => ({ day: d, techs: data.diagnostics.filter(r => r.day === d) }));
            const maxCount = Math.max(...dayData.map(d => d.techs.reduce((s, t) => s + t.count, 0)), 1);
            return (
              <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Diagnostics Performed (Last 30 Days)</h2>
                <div className="flex" style={{ height: '180px' }}>
                  <div className="flex flex-col justify-between items-end pr-2" style={{ width: '30px' }}>
                    {[maxCount, Math.round(maxCount * 0.5), 0].map(v => (
                      <span key={v} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{v}</span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end gap-[1px] border-l border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {dayData.map(d => (
                      <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={d.techs.length ? `${d.day}: ${d.techs.reduce((s, t) => s + t.count, 0)}` : d.day}>
                        {d.techs.map(t => (
                          <div key={t.tech} style={{ height: `${(t.count / maxCount) * 100}%`, background: techColor[t.tech], minHeight: '2px' }} title={`${t.tech}: ${t.count}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex" style={{ paddingLeft: '30px' }}>
                  {dayData.map((d, i) => (
                    <div key={d.day} className="flex-1 text-center">
                      {i === 0 || i === 14 || i === 29 ? (
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.day.slice(5)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {techs.map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: techColor[t] }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Repairs Performed (Stacked by Tech) */}
          {data.repairs?.length > 0 && (() => {
            const techs = [...new Set(data.repairs.map(r => r.tech))];
            const colors = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
            const techColor = Object.fromEntries(techs.map((t, i) => [t, colors[i % colors.length]]));
            const allDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
            const dayData = allDays.map(d => ({ day: d, techs: data.repairs.filter(r => r.day === d) }));
            const maxCount = Math.max(...dayData.map(d => d.techs.reduce((s, t) => s + t.count, 0)), 1);
            return (
              <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Repairs Performed (Last 30 Days)</h2>
                <div className="flex" style={{ height: '180px' }}>
                  <div className="flex flex-col justify-between items-end pr-2" style={{ width: '30px' }}>
                    {[maxCount, Math.round(maxCount * 0.5), 0].map(v => (
                      <span key={v} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{v}</span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end gap-[1px] border-l border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {dayData.map(d => (
                      <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={d.techs.length ? `${d.day}: ${d.techs.reduce((s, t) => s + t.count, 0)}` : d.day}>
                        {d.techs.map(t => (
                          <div key={t.tech} style={{ height: `${(t.count / maxCount) * 100}%`, background: techColor[t.tech], minHeight: '2px' }} title={`${t.tech}: ${t.count}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex" style={{ paddingLeft: '30px' }}>
                  {dayData.map((d, i) => (
                    <div key={d.day} className="flex-1 text-center">
                      {i === 0 || i === 14 || i === 29 ? (
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.day.slice(5)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {techs.map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: techColor[t] }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Parts Checked In */}
          {workflow === 'refresh' && data.checkins?.length > 0 && (() => {
            const techs = [...new Set(data.checkins.map(r => r.tech))];
            const colors = ['#06b6d4','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#84cc16','#f97316','#6366f1'];
            const techColor = Object.fromEntries(techs.map((t, i) => [t, colors[i % colors.length]]));
            const allDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
            const dayData = allDays.map(d => ({ day: d, techs: data.checkins.filter(r => r.day === d) }));
            const maxCount = Math.max(...dayData.map(d => d.techs.reduce((s, t) => s + t.count, 0)), 1);
            return (
              <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Parts Checked In (Last 30 Days)</h2>
                <div className="flex" style={{ height: '180px' }}>
                  <div className="flex flex-col justify-between items-end pr-2" style={{ width: '30px' }}>
                    {[maxCount, Math.round(maxCount * 0.5), 0].map(v => (
                      <span key={v} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{v}</span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end gap-[1px] border-l border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {dayData.map(d => (
                      <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={d.techs.length ? `${d.day}: ${d.techs.reduce((s, t) => s + t.count, 0)} parts` : d.day}>
                        {d.techs.map(t => (
                          <div key={t.tech} style={{ height: `${(t.count / maxCount) * 100}%`, background: techColor[t.tech], minHeight: '2px' }} title={`${t.tech}: ${t.count}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex" style={{ paddingLeft: '30px' }}>
                  {dayData.map((d, i) => (
                    <div key={d.day} className="flex-1 text-center">
                      {i === 0 || i === 14 || i === 29 ? <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.day.slice(5)}</span> : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {techs.map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: techColor[t] }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Parts Issued */}
          {workflow === 'refresh' && data.checkouts?.length > 0 && (() => {
            const techs = [...new Set(data.checkouts.map(r => r.tech))];
            const colors = ['#f97316','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#6366f1'];
            const techColor = Object.fromEntries(techs.map((t, i) => [t, colors[i % colors.length]]));
            const allDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
            const dayData = allDays.map(d => ({ day: d, techs: data.checkouts.filter(r => r.day === d) }));
            const maxCount = Math.max(...dayData.map(d => d.techs.reduce((s, t) => s + t.count, 0)), 1);
            return (
              <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Parts Issued (Last 30 Days)</h2>
                <div className="flex" style={{ height: '180px' }}>
                  <div className="flex flex-col justify-between items-end pr-2" style={{ width: '30px' }}>
                    {[maxCount, Math.round(maxCount * 0.5), 0].map(v => (
                      <span key={v} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{v}</span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end gap-[1px] border-l border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {dayData.map(d => (
                      <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={d.techs.length ? `${d.day}: ${d.techs.reduce((s, t) => s + t.count, 0)} parts` : d.day}>
                        {d.techs.map(t => (
                          <div key={t.tech} style={{ height: `${(t.count / maxCount) * 100}%`, background: techColor[t.tech], minHeight: '2px' }} title={`${t.tech}: ${t.count}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex" style={{ paddingLeft: '30px' }}>
                  {dayData.map((d, i) => (
                    <div key={d.day} className="flex-1 text-center">
                      {i === 0 || i === 14 || i === 29 ? <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.day.slice(5)}</span> : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {techs.map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: techColor[t] }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Collections by Date & Resource */}
          {data.pickups?.length > 0 && (() => {
            const techs = [...new Set(data.pickups.map(r => r.tech))];
            const colors = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
            const techColor = Object.fromEntries(techs.map((t, i) => [t, colors[i % colors.length]]));
            const allDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
            const dayData = allDays.map(d => ({ day: d, techs: data.pickups.filter(r => r.day === d) }));
            const maxCount = Math.max(...dayData.map(d => d.techs.reduce((s, t) => s + t.count, 0)), 1);
            return (
              <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Collections (Last 30 Days)</h2>
                <div className="flex" style={{ height: '180px' }}>
                  <div className="flex flex-col justify-between items-end pr-2" style={{ width: '30px' }}>
                    {[maxCount, Math.round(maxCount * 0.5), 0].map(v => (
                      <span key={v} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{v}</span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end gap-[1px] border-l border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {dayData.map(d => (
                      <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={d.techs.length ? `${d.day}: ${d.techs.reduce((s, t) => s + t.count, 0)} collections` : d.day}>
                        {d.techs.map(t => (
                          <div key={t.tech} style={{ height: `${(t.count / maxCount) * 100}%`, background: techColor[t.tech], minHeight: '2px' }} title={`${t.tech}: ${t.count}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex" style={{ paddingLeft: '30px' }}>
                  {dayData.map((d, i) => (
                    <div key={d.day} className="flex-1 text-center">
                      {i === 0 || i === 14 || i === 29 ? <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.day.slice(5)}</span> : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {techs.map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: techColor[t] }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Deliveries by Date & Resource */}
          {data.deliveries?.length > 0 && (() => {
            const techs = [...new Set(data.deliveries.map(r => r.tech))];
            const colors = ['#14b8a6','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316'];
            const techColor = Object.fromEntries(techs.map((t, i) => [t, colors[i % colors.length]]));
            const allDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
            const dayData = allDays.map(d => ({ day: d, techs: data.deliveries.filter(r => r.day === d) }));
            const maxCount = Math.max(...dayData.map(d => d.techs.reduce((s, t) => s + t.count, 0)), 1);
            return (
              <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Deliveries (Last 30 Days)</h2>
                <div className="flex" style={{ height: '180px' }}>
                  <div className="flex flex-col justify-between items-end pr-2" style={{ width: '30px' }}>
                    {[maxCount, Math.round(maxCount * 0.5), 0].map(v => (
                      <span key={v} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{v}</span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end gap-[1px] border-l border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {dayData.map(d => (
                      <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={d.techs.length ? `${d.day}: ${d.techs.reduce((s, t) => s + t.count, 0)} deliveries` : d.day}>
                        {d.techs.map(t => (
                          <div key={t.tech} style={{ height: `${(t.count / maxCount) * 100}%`, background: techColor[t.tech], minHeight: '2px' }} title={`${t.tech}: ${t.count}`} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex" style={{ paddingLeft: '30px' }}>
                  {dayData.map((d, i) => (
                    <div key={d.day} className="flex-1 text-center">
                      {i === 0 || i === 14 || i === 29 ? <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.day.slice(5)}</span> : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {techs.map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: techColor[t] }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      </>}

      {view === 'customer' && (
        <div>
          <div className="flex gap-3 flex-wrap mb-4 items-center">
            <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="input-themed px-3 py-2 rounded-md text-sm">
              <option value="">Select Customer</option>
              {customers.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
            {selectedCustomer && customerWorkflows.length > 0 && (
              <select value={customerWorkflow} onChange={e => { setCustomerWorkflow(e.target.value); setCustomerProgram(''); }} className="input-themed px-3 py-2 rounded-md text-sm">
                <option value="">Select Workflow</option>
                {customerWorkflows.map(w => <option key={w.workflow_key} value={w.workflow_key}>{w.workflow_key.charAt(0).toUpperCase() + w.workflow_key.slice(1)} ({w.count})</option>)}
              </select>
            )}
            {selectedCustomer && customerWorkflow && customerPrograms.length > 0 && (
              <select value={customerProgram} onChange={e => setCustomerProgram(e.target.value)} className="input-themed px-3 py-2 rounded-md text-sm">
                <option value="">All Programs</option>
                {customerPrograms.map(p => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
              </select>
            )}
          </div>
          {!selectedCustomer && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Select a customer to view insights.</p>}
          {reportLoading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading report...</p>}
          {report && !reportLoading && <CustomerReport report={report} />}
        </div>
      )}
    </div>
  );
}

const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#e11d48'];

function PieChart({ data, title, size = 220 }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return null;
  let cum = 0;
  const slices = data.map((d, i) => {
    const start = cum / total;
    cum += d.count;
    const end = cum / total;
    const large = end - start > 0.5 ? 1 : 0;
    const x1 = Math.cos(2 * Math.PI * start), y1 = Math.sin(2 * Math.PI * start);
    const x2 = Math.cos(2 * Math.PI * end), y2 = Math.sin(2 * Math.PI * end);
    return <path key={i} d={`M ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} L 0 0`} fill={COLORS[i % COLORS.length]} />;
  });
  return (
    <div>
      {title && <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{title}</h4>}
      <div className="flex gap-4 items-start">
        <svg viewBox="-1 -1 2 2" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>{slices}</svg>
        <div className="flex flex-col flex-wrap gap-x-4 gap-y-1" style={{ maxHeight: `${8 * 1.5}rem` }}>
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span style={{ color: 'var(--color-text-primary)' }}>{d.label} ({d.count})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedColumn({ data, title, onFacilityClick, selectedFacility }) {
  if (!data.length) return null;
  const facilities = [...new Set(data.map(d => d.facility))];
  const stages = [...new Set(data.map(d => d.stage))];
  const facilityData = facilities.map(f => {
    const rows = data.filter(d => d.facility === f);
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { facility: f, total, stages: rows };
  });
  const maxTotal = Math.max(...facilityData.map(f => f.total));
  return (
    <div>
      {title && <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{title}</h4>}
      <div className="flex items-end gap-2" style={{ height: '200px' }}>
        {facilityData.map((f, fi) => (
          <div key={fi} className="flex flex-col justify-end items-center flex-1 cursor-pointer" style={{ height: '100%' }} onClick={() => onFacilityClick?.(f.facility === selectedFacility ? null : f.facility)}>
            <div className="w-full flex flex-col justify-end" style={{ height: `${(f.total / maxTotal) * 100}%`, opacity: selectedFacility && selectedFacility !== f.facility ? 0.4 : 1 }}>
              {f.stages.map((s, si) => (
                <div key={si} style={{ height: `${(s.count / f.total) * 100}%`, background: COLORS[stages.indexOf(s.stage) % COLORS.length], minHeight: '2px' }} title={`${s.stage}: ${s.count}`} />
              ))}
            </div>
            <span className={`text-[0.6rem] mt-1 text-center truncate w-full ${selectedFacility === f.facility ? 'font-bold' : ''}`} style={{ color: selectedFacility === f.facility ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{f.facility}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
            <span style={{ color: 'var(--color-text-primary)' }}>{s}</span>
          </div>
        ))}
      </div>
      {selectedFacility && <button onClick={() => onFacilityClick?.(null)} className="mt-2 text-xs text-blue-600 hover:underline">Clear filter</button>}
    </div>
  );
}

function CustomerReport({ report }) {
  const { byStage, byFacility, inventory, partsCancelled, partsActive, bulkOrders } = report;
  const [selectedFacility, setSelectedFacility] = useState(null);

  const filteredCancelled = selectedFacility ? (partsCancelled || []).filter(r => r.facility === selectedFacility) : (partsCancelled || []);
  const filteredActive = selectedFacility ? (partsActive || []).filter(r => r.facility === selectedFacility) : (partsActive || []);

  const cancelledByModel = {};
  filteredCancelled.forEach(r => {
    const key = r.manufacturer && r.model_name ? `${r.manufacturer} ${r.model_name}` : r.model_name || r.manufacturer || 'Unknown';
    if (!cancelledByModel[key]) cancelledByModel[key] = [];
    cancelledByModel[key].push({ label: r.part_name, count: r.count });
  });

  const activeByModel = {};
  filteredActive.forEach(r => {
    const key = r.manufacturer && r.model_name ? `${r.manufacturer} ${r.model_name}` : r.model_name || r.manufacturer || 'Unknown';
    if (!activeByModel[key]) activeByModel[key] = [];
    activeByModel[key].push({ label: r.part_name, count: r.count });
  });

  return (
    <div className="space-y-8 mt-6">
      <div id="customer-report">
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <div className="flex gap-4">
          <div className="w-[30%] rounded-lg p-4 flex flex-col items-center justify-center" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
            <div className="text-xs uppercase font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Total Cases</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{(byStage || []).reduce((s, r) => s + r.count, 0)}</div>
          </div>
          <div className="ml-auto">
            <PieChart data={(byStage || []).map(r => ({ label: r.stage, count: r.count }))} title="Cases by Stage" />
          </div>
        </div>
        <StackedColumn data={byFacility || []} title="Case Stages by Facility" onFacilityClick={setSelectedFacility} selectedFacility={selectedFacility} />
      </div>

      {(Object.keys(activeByModel).length > 0 || Object.keys(cancelledByModel).length > 0) && (
        <div>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Diagnosed Parts by Model</h4>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="text-xs font-semibold text-center pb-3 mb-3 border-b" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>Active Cases</div>
              <div className="space-y-6">
                {[...new Set([...Object.keys(activeByModel), ...Object.keys(cancelledByModel)])].sort().map(model => (
                  <div key={model}>
                    <h5 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{model}</h5>
                    {activeByModel[model] ? <PieChart data={activeByModel[model]} size={200} /> : <div className="flex items-center justify-center" style={{ height: '200px', color: 'var(--color-text-muted)' }}><span className="text-xs">No data</span></div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="text-xs font-semibold text-center pb-3 mb-3 border-b" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>Cancelled Cases</div>
              <div className="space-y-6">
                {[...new Set([...Object.keys(activeByModel), ...Object.keys(cancelledByModel)])].sort().map(model => (
                  <div key={model}>
                    <h5 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{model}</h5>
                    {cancelledByModel[model] ? <PieChart data={cancelledByModel[model]} size={200} /> : <div className="flex items-center justify-center" style={{ height: '200px', color: 'var(--color-text-muted)' }}><span className="text-xs">No data</span></div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(inventory?.length > 0 || bulkOrders?.length > 0) && (
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          {inventory && inventory.length > 0 && (
            <div className="rounded-lg p-5 border-l-4" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(16,185,129,0.04))', borderLeftColor: '#3b82f6', border: '1px solid var(--color-border)', borderLeftWidth: '4px' }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Spare Parts Inventory</h4>
              <div className="rounded border" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-xs">
                  <thead><tr style={{ background: 'rgba(59,130,246,0.08)' }}><th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Part #</th><th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Description</th><th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Qty on Hand</th></tr></thead>
                  <tbody>{inventory.map((p, i) => <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{p.part_no}</td><td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{p.description}</td><td className="px-3 py-2 text-right font-medium" style={{ color: p.qty_on_hand > 0 ? '#10b981' : '#ef4444' }}>{p.qty_on_hand}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {bulkOrders && bulkOrders.length > 0 && (
            <div className="rounded-lg p-5 border-l-4" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(236,72,153,0.04))', borderLeftColor: '#8b5cf6', border: '1px solid var(--color-border)', borderLeftWidth: '4px' }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Bulk Orders</h4>
              <div className="rounded border" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-xs">
                  <thead><tr style={{ background: 'rgba(139,92,246,0.08)' }}><th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Part #</th><th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Description</th><th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Qty Ordered</th><th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Unit Price</th><th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Total Price</th></tr></thead>
                  <tbody>{bulkOrders.map((o, i) => <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{o.part_number || '-'}</td><td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{o.part_name || '-'}</td><td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>{o.total_qty}</td><td className="px-3 py-2 text-right" style={{ color: 'var(--color-text-primary)' }}>{o.unit_price ? `$${o.unit_price}` : '-'}</td><td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>{o.unit_price && o.total_qty ? `$${(parseFloat(o.unit_price) * parseInt(o.total_qty)).toFixed(2)}` : '-'}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
}
