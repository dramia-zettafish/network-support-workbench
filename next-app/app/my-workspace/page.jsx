'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTimezone } from '@/lib/format-date.js';
import { TEAM_WORKSPACES } from '@/lib/workspace-config.js';

export default function MyWorkspacePage() {
  const { fmt } = useTimezone();
  const [assigned, setAssigned] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userTeams, setUserTeams] = useState([]);
  const [statsDays, setStatsDays] = useState(30);
  const [statsTeam, setStatsTeam] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartMode, setChartMode] = useState('workflow');
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [showReadMessages, setShowReadMessages] = useState(false);
  const [msgPage, setMsgPage] = useState(0);
  const MSG_PAGE_SIZE = 10;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackFiles, setFeedbackFiles] = useState([]);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackListOpen, setFeedbackListOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [userRole, setUserRole] = useState('');

  const FEEDBACK_CATEGORIES = ['Bug Report', 'Feature Request', 'Workflow Improvement', 'Access/Permissions Request', 'Reporting/Dashboard Request', 'Training/Documentation Request', 'General Questions'];

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) return;
        const { user } = await meRes.json();
        if (!user) return;
        setUserTeams(user.teams || []);
        setUserRole(user.role || '');

        const [assignedRes, recentRes] = await Promise.all([
          fetch(`/api/cases?assigned_to=${encodeURIComponent(user.username)}&limit=50&sort_by=last_activity_at&sort_dir=desc`),
          fetch(`/api/cases?activity_by=${encodeURIComponent(user.username)}&limit=20&sort_by=last_activity_at&sort_dir=desc`),
        ]);

        if (assignedRes.ok) { const d = await assignedRes.json(); setAssigned(d.data || []); }
        if (recentRes.ok) { const d = await recentRes.json(); setRecent(d.data || []); }
        fetch('/api/user-messages').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setMessages(d.data); }).catch(() => {}).finally(() => setMessagesLoading(false));
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  useEffect(() => {
    if (userTeams.length > 1 && !statsTeam) { setStatsLoading(false); return; }
    setStatsLoading(true);
    const params = new URLSearchParams({ days: String(statsDays) });
    if (statsTeam) params.set('team', statsTeam);
    fetch(`/api/my-workspace/stats?${params}`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setStats(d.data); }).catch(() => {}).finally(() => setStatsLoading(false));
  }, [statsDays, statsTeam, userTeams]);

  const thCls = "font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm";
  const tdCls = "px-4 py-3 border-b text-sm";

  function CaseTable({ cases, title, emptyMsg }) {
    return (
      <div className="mb-8">
        <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>{title} {cases.length > 0 && <span className="font-normal text-sm" style={{ color: 'var(--color-text-muted)' }}>({cases.length})</span>}</h2>
        {cases.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{emptyMsg}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr style={{ background: 'var(--color-surface-raised)' }}>
                <th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case Number</th>
                <th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Customer</th>
                <th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Workflow</th>
                <th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Stage</th>
                <th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Status</th>
                <th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Last Activity</th>
              </tr></thead>
              <tbody>{cases.map(c => (
                <tr key={c.id}>
                  <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><Link href={`/cases/${c.id}`} onClick={() => { try { sessionStorage.setItem('caseNavBack', '/my-workspace'); } catch {} }} className="text-blue-600 underline">{c.case_number}</Link></td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.customer_name || '-'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.workflow_key === 'rma' ? 'RMA' : c.workflow_key ? c.workflow_key.charAt(0).toUpperCase() + c.workflow_key.slice(1) : '-'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.stage || '-'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.status || '-'}</td>
                  <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.last_activity_at ? fmt(c.last_activity_at) : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>;

  return (
    <div className="py-6 max-w-[1200px] mx-auto px-4">
      {/* Stats Section */}
      <div className="mb-8 p-5 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>My Stats</h2>
          <select value={statsDays} onChange={e => setStatsDays(Number(e.target.value))} className="input-themed px-2 py-1 rounded text-xs">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          {userTeams.length > 1 && (
            <select value={statsTeam} onChange={e => setStatsTeam(e.target.value)} className="input-themed px-2 py-1 rounded text-xs">
              <option value="">Select Workspace...</option>
              {userTeams.map(t => <option key={t} value={t}>{TEAM_WORKSPACES[t]?.label || t}</option>)}
            </select>
          )}
        </div>
        {statsLoading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading stats...</p>}
        {!statsLoading && userTeams.length > 1 && !statsTeam && <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Select Workspace to View Stats</p>}
        {!statsLoading && stats && (userTeams.length <= 1 || statsTeam) && (
          <>
            {statsTeam === 'route_coordinators' && stats.rc_stats ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{stats.rc_stats.pickups_scheduled}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Pickups Scheduled</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.rc_stats.deliveries_scheduled}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Deliveries Scheduled</div>
                  </div>
                </div>
                {(() => {
                  const allDays = [];
                  const end = new Date(); end.setHours(0,0,0,0);
                  const start = new Date(end); start.setDate(start.getDate() - statsDays + 1);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { allDays.push(d.toISOString().slice(0, 10)); }
                  const pickupMap = Object.fromEntries((stats.rc_stats.daily_pickups || []).map(d => [d.day?.slice(0, 10), d.count]));
                  const deliveryMap = Object.fromEntries((stats.rc_stats.daily_deliveries || []).map(d => [d.day?.slice(0, 10), d.count]));
                  const dayData = allDays.map(day => ({ day, pickup: pickupMap[day] || 0, delivery: deliveryMap[day] || 0 }));
                  const max = Math.max(...dayData.map(d => d.pickup + d.delivery), 1);
                  const labelCount = 5;
                  const labelIndices = Array.from({ length: labelCount + 1 }, (_, i) => Math.min(Math.round(i * (allDays.length - 1) / labelCount), allDays.length - 1));
                  return (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Pickups & Deliveries Scheduled</h3>
                      <div className="flex">
                        <div className="flex flex-col justify-between h-28 mr-1 text-right">
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{max}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{Math.round(max / 2)}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>0</span>
                        </div>
                        <div className="flex items-end gap-1 h-28 flex-1">
                          {dayData.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.pickup} pickups, ${d.delivery} deliveries`}>
                              {d.delivery > 0 && <div style={{ height: `${(d.delivery / max) * 100}%`, minHeight: '3px', background: '#10b981' }} className="w-full"></div>}
                              {d.pickup > 0 && <div style={{ height: `${(d.pickup / max) * 100}%`, minHeight: '3px', background: '#3b82f6' }} className="w-full rounded-t"></div>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between mt-1" style={{ marginLeft: '20px' }}>
                        {labelIndices.map(i => <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{allDays[i]?.slice(5)}</span>)}
                      </div>
                      <div className="flex gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}><span className="inline-block w-3 h-3 rounded" style={{ background: '#3b82f6' }}></span>Pickups</span>
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}><span className="inline-block w-3 h-3 rounded" style={{ background: '#10b981' }}></span>Deliveries</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : statsTeam === 'logistics_technicians' && stats.lt_stats ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.lt_stats.successful_pickups}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Successful Pickups</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{stats.lt_stats.pickup_failures}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Pickup Failures</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.lt_stats.successful_deliveries}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Successful Deliveries</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{stats.lt_stats.delivery_failures}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Delivery Failures</div>
                  </div>
                </div>
                {/* Logistics stacked chart */}
                {(() => {
                  const COLORS = { 'Logistics update: Pick up Successful': '#10b981', 'Logistics update: Pick Up Failed': '#ef4444', 'Logistics update: Delivery Successful': '#3b82f6', 'Logistics update: Delivery Failure': '#f59e0b' };
                  const LABELS = { 'Logistics update: Pick up Successful': 'Pickup Success', 'Logistics update: Pick Up Failed': 'Pickup Failed', 'Logistics update: Delivery Successful': 'Delivery Success', 'Logistics update: Delivery Failure': 'Delivery Failed' };
                  const allDays = [];
                  const end = new Date(); end.setHours(0,0,0,0);
                  const start = new Date(end); start.setDate(start.getDate() - statsDays + 1);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { allDays.push(d.toISOString().slice(0, 10)); }
                  const events = Object.keys(COLORS);
                  const dayData = allDays.map(day => {
                    const entries = (stats.lt_stats.daily || []).filter(d => d.day?.slice(0, 10) === day);
                    const total = entries.reduce((s, e) => s + e.count, 0);
                    return { day, entries, total };
                  });
                  const max = Math.max(...dayData.map(d => d.total), 1);
                  const labelCount = 5;
                  const labelIndices = Array.from({ length: labelCount + 1 }, (_, i) => Math.min(Math.round(i * (allDays.length - 1) / labelCount), allDays.length - 1));
                  return (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Daily Activity</h3>
                      <div className="flex">
                        <div className="flex flex-col justify-between h-28 mr-1 text-right">
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{max}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{Math.round(max / 2)}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>0</span>
                        </div>
                        <div className="flex items-end gap-1 h-28 flex-1">
                          {dayData.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.total}`}>
                              {d.entries.map(e => (
                                <div key={e.event} style={{ height: `${(e.count / max) * 100}%`, minHeight: e.count > 0 ? '3px' : '0', background: COLORS[e.event] || '#6b7280' }} className="w-full first:rounded-t"></div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between mt-1" style={{ marginLeft: '20px' }}>
                        {labelIndices.map(i => <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{allDays[i]?.slice(5)}</span>)}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {events.map(e => <span key={e} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}><span className="inline-block w-3 h-3 rounded" style={{ background: COLORS[e] }}></span>{LABELS[e]}</span>)}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : statsTeam === 'computer_technicians' && stats.ct_stats ? (
              <>
                <div className="grid grid-cols-5 gap-3 mb-5">
                  <div className="p-3 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{stats.ct_stats.diagnosed}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Diagnosed</div>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{stats.ct_stats.part_requests}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Additional Part Requests</div>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{stats.ct_stats.defective_parts}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Defective Parts</div>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{stats.ct_stats.damaged_parts}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Damaged Parts</div>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.ct_stats.repairs}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Repairs</div>
                  </div>
                </div>
                {/* CT stacked chart */}
                {(() => {
                  const COLORS = { 'Diagnostic': '#3b82f6', 'Additional Part Request': '#f59e0b', 'Repair': '#10b981' };
                  const allDays = [];
                  const end = new Date(); end.setHours(0,0,0,0);
                  const start = new Date(end); start.setDate(start.getDate() - statsDays + 1);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { allDays.push(d.toISOString().slice(0, 10)); }
                  const dayData = allDays.map(day => {
                    const entries = (stats.ct_stats.daily || []).filter(d => d.day?.slice(0, 10) === day);
                    const total = entries.reduce((s, e) => s + e.count, 0);
                    return { day, entries, total };
                  });
                  const max = Math.max(...dayData.map(d => d.total), 1);
                  const labelCount = 5;
                  const labelIndices = Array.from({ length: labelCount + 1 }, (_, i) => Math.min(Math.round(i * (allDays.length - 1) / labelCount), allDays.length - 1));
                  return (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Daily Activity</h3>
                      <div className="flex">
                        <div className="flex flex-col justify-between h-28 mr-1 text-right">
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{max}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{Math.round(max / 2)}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>0</span>
                        </div>
                        <div className="flex items-end gap-1 h-28 flex-1">
                          {dayData.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.total}`}>
                              {d.entries.map(e => (
                                <div key={e.note_type} style={{ height: `${(e.count / max) * 100}%`, minHeight: e.count > 0 ? '3px' : '0', background: COLORS[e.note_type] || '#6b7280' }} className="w-full first:rounded-t"></div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between mt-1" style={{ marginLeft: '20px' }}>
                        {labelIndices.map(i => <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{allDays[i]?.slice(5)}</span>)}
                      </div>
                      <div className="flex gap-3 mt-2">
                        {Object.entries(COLORS).map(([k, c]) => <span key={k} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}><span className="inline-block w-3 h-3 rounded" style={{ background: c }}></span>{k === 'Additional Part Request' ? 'Additional Part Requests' : k}</span>)}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : statsTeam === 'parts_administrators' && stats.pa_stats ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{stats.pa_stats.parts_issued}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Parts Issued</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.pa_stats.parts_received}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Parts Received</div>
                  </div>
                </div>
                {(() => {
                  const COLORS = { issue: '#3b82f6', checkin: '#10b981' };
                  const LABELS = { issue: 'Parts Issued', checkin: 'Parts Received' };
                  const allDays = [];
                  const end = new Date(); end.setHours(0,0,0,0);
                  const start = new Date(end); start.setDate(start.getDate() - statsDays + 1);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { allDays.push(d.toISOString().slice(0, 10)); }
                  const dayData = allDays.map(day => {
                    const entries = (stats.pa_stats.daily || []).filter(d => d.day?.slice(0, 10) === day);
                    const total = entries.reduce((s, e) => s + e.count, 0);
                    return { day, entries, total };
                  });
                  const max = Math.max(...dayData.map(d => d.total), 1);
                  const labelCount = 5;
                  const labelIndices = Array.from({ length: labelCount + 1 }, (_, i) => Math.min(Math.round(i * (allDays.length - 1) / labelCount), allDays.length - 1));
                  return (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Daily Activity</h3>
                      <div className="flex">
                        <div className="flex flex-col justify-between h-28 mr-1 text-right">
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{max}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{Math.round(max / 2)}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>0</span>
                        </div>
                        <div className="flex items-end gap-1 h-28 flex-1">
                          {dayData.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.total}`}>
                              {d.entries.map(e => (
                                <div key={e.action} style={{ height: `${(e.count / max) * 100}%`, minHeight: e.count > 0 ? '3px' : '0', background: COLORS[e.action] || '#6b7280' }} className="w-full first:rounded-t"></div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between mt-1" style={{ marginLeft: '20px' }}>
                        {labelIndices.map(i => <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{allDays[i]?.slice(5)}</span>)}
                      </div>
                      <div className="flex gap-3 mt-2">
                        {Object.entries(LABELS).map(([k, l]) => <span key={k} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}><span className="inline-block w-3 h-3 rounded" style={{ background: COLORS[k] }}></span>{l}</span>)}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
            <>
            <div className={`grid gap-4 mb-5 ${statsTeam === 'intake_administrators' ? 'grid-cols-1 max-w-[200px]' : 'grid-cols-3'}`}>
              <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{stats.cases_created}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Cases Created</div>
              </div>
              {statsTeam !== 'intake_administrators' && <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.notes_added}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Notes Added</div>
              </div>}
              {statsTeam !== 'intake_administrators' && <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-surface-raised)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{stats.stage_changes}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Stage Changes</div>
              </div>}
            </div>
            {/* Daily Activity Chart */}
            {stats.daily_activity?.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Daily Activity</h3>
                {(() => {
                  const allDays = [];
                  const end = new Date(); end.setHours(0,0,0,0);
                  const start = new Date(end); start.setDate(start.getDate() - statsDays + 1);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { allDays.push(d.toISOString().slice(0, 10)); }
                  const dayMap = Object.fromEntries(stats.daily_activity.map(d => [d.day?.slice(0, 10), d.count]));
                  const filled = allDays.map(day => ({ day, count: dayMap[day] || 0 }));
                  const max = Math.max(...filled.map(d => d.count), 1);
                  const labelCount = 5;
                  const labelIndices = Array.from({ length: labelCount + 1 }, (_, i) => Math.min(Math.round(i * (allDays.length - 1) / labelCount), allDays.length - 1));
                  return (
                    <>
                      <div className="flex">
                        <div className="flex flex-col justify-between h-24 mr-1 text-right">
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{max}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{Math.round(max / 2)}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>0</span>
                        </div>
                        <div className="flex items-end gap-1 h-24 flex-1">
                          {filled.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.day}: ${d.count}`}>
                              <div className="w-full rounded-t" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '0', background: 'var(--color-accent)' }}></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between mt-1" style={{ marginLeft: '20px' }}>
                        {labelIndices.map(i => <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{allDays[i]?.slice(5)}</span>)}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {/* Stacked column chart: cases created per day (intake) */}
            {(stats.daily_cases_by_workflow?.length > 0 || stats.daily_cases_by_customer?.length > 0) && (() => {
              const WORKFLOW_COLORS = { refresh: '#3b82f6', rma: '#f59e0b', other: '#6b7280' };
              const CUSTOMER_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#84cc16'];
              const source = chartMode === 'workflow' ? stats.daily_cases_by_workflow : stats.daily_cases_by_customer;
              const groupKey = chartMode === 'workflow' ? 'workflow_key' : 'customer_name';
              const groups = [...new Set((source || []).map(d => d[groupKey]))];
              const colorMap = chartMode === 'workflow' ? WORKFLOW_COLORS : Object.fromEntries(groups.map((g, i) => [g, CUSTOMER_COLORS[i % CUSTOMER_COLORS.length]]));
              const allDays = [];
              const end = new Date(); end.setHours(0,0,0,0);
              const start = new Date(end); start.setDate(start.getDate() - statsDays + 1);
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { allDays.push(d.toISOString().slice(0, 10)); }
              const dayData = allDays.map(day => {
                const entries = (source || []).filter(d => d.day?.slice(0, 10) === day);
                const total = entries.reduce((s, e) => s + e.count, 0);
                return { day, entries, total };
              });
              const max = Math.max(...dayData.map(d => d.total), 1);
              return (
                <div className="mb-5">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cases Created</h3>
                    <select value={chartMode} onChange={e => setChartMode(e.target.value)} className="input-themed px-2 py-0.5 rounded text-xs">
                      <option value="workflow">By Workflow</option>
                      <option value="customer">By Customer</option>
                    </select>
                  </div>
                  <div className="flex">
                    <div className="flex flex-col justify-between h-28 mr-1 text-right">
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{max}</span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{Math.round(max / 2)}</span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>0</span>
                    </div>
                    <div className="flex items-end gap-1 h-28 flex-1">
                      {dayData.map(d => (
                        <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.total} cases`}>
                          {d.entries.map(e => (
                            <div key={e[groupKey]} style={{ height: `${(e.count / max) * 100}%`, minHeight: e.count > 0 ? '3px' : '0', background: colorMap[e[groupKey]] || '#6b7280' }} className="w-full first:rounded-t"></div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between mt-1" style={{ marginLeft: '20px' }}>
                    {(() => {
                      const labelCount = 5;
                      const labelIndices = Array.from({ length: labelCount + 1 }, (_, i) => Math.min(Math.round(i * (allDays.length - 1) / labelCount), allDays.length - 1));
                      return labelIndices.map(i => <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{allDays[i]?.slice(5)}</span>);
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {groups.map(g => <span key={g} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}><span className="inline-block w-3 h-3 rounded" style={{ background: colorMap[g] || '#6b7280' }}></span>{chartMode === 'workflow' ? (g === 'rma' ? 'RMA' : g ? g.charAt(0).toUpperCase() + g.slice(1) : 'Other') : (g || 'Unknown')}</span>)}
                  </div>
                </div>
              );
            })()}
          </>
            )}
          </>
        )}
      </div>

      {/* Message Center */}
      {!messagesLoading && (
        <div className="mb-8 p-5 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Message Center <span className="font-normal text-sm" style={{ color: 'var(--color-text-muted)' }}>({messages.filter(m => !m.is_read).length} unread)</span></h2>
            <div className="flex gap-2">
              <button onClick={() => { setFeedbackOpen(true); setFeedbackResult(null); setFeedbackCategory(''); setFeedbackMessage(''); setFeedbackFiles([]); }} className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">System Feedback</button>
            </div>
          </div>
          {messages.length === 0 ? (
            <div className="text-center py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>No messages</div>
          ) : (
          <>
          <div className="space-y-2">
            {(() => { const filtered = messages.filter(m => showReadMessages || !m.is_read); const paged = filtered.slice(msgPage * MSG_PAGE_SIZE, (msgPage + 1) * MSG_PAGE_SIZE); return paged.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded text-sm" style={{ background: m.is_read ? 'var(--color-bg)' : 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                {!m.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>}
                <span style={{ color: 'var(--color-text-primary)' }}>{m.message}</span>
                {m.link && <Link href={m.link} onClick={() => { try { sessionStorage.setItem('caseNavBack', '/my-workspace'); } catch {} if (!m.is_read) { fetch('/api/user-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [m.id] }) }); setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, is_read: true } : msg)); } }} className="text-blue-600 underline text-xs whitespace-nowrap ml-auto">View Case</Link>}
                <span className="text-xs whitespace-nowrap ml-2" style={{ color: 'var(--color-text-muted)' }}>{m.created_at ? fmt(m.created_at) : ''}</span>
                {!m.link && !m.is_read && <button onClick={() => { fetch('/api/user-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [m.id] }) }); setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, is_read: true } : msg)); }} className="text-xs whitespace-nowrap ml-auto px-2 py-0.5 rounded" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>Mark Read</button>}
              </div>
            )); })()}
            {!showReadMessages && messages.every(m => m.is_read) && <div className="text-center py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>No unread messages</div>}
          </div>
          {(() => { const filtered = messages.filter(m => showReadMessages || !m.is_read); const totalPages = Math.ceil(filtered.length / MSG_PAGE_SIZE); return totalPages > 1 && (
            <div className="flex gap-2 items-center mt-3">
              <button disabled={msgPage === 0} onClick={() => setMsgPage(msgPage - 1)} className="px-2 py-0.5 text-xs rounded border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Prev</button>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{msgPage + 1} / {totalPages}</span>
              <button disabled={msgPage >= totalPages - 1} onClick={() => setMsgPage(msgPage + 1)} className="px-2 py-0.5 text-xs rounded border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Next</button>
            </div>
          ); })()}
          <div className="flex gap-2 mt-3">
            {messages.some(m => !m.is_read) && (
              <button onClick={async () => { const unread = messages.filter(m => !m.is_read).map(m => m.id); await fetch('/api/user-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: unread }) }); setMessages(messages.map(m => ({ ...m, is_read: true }))); }} className="px-3 py-1 text-xs font-medium rounded" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>Mark All Read</button>
            )}
            {messages.some(m => m.is_read) && (
              <button onClick={() => { setShowReadMessages(!showReadMessages); setMsgPage(0); }} className="px-3 py-1 text-xs font-medium rounded" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>{showReadMessages ? 'Hide Read' : 'Show Read'}</button>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {/* System Feedback Modal */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">System Feedback</h3>
            {feedbackResult ? (
              <div className="text-center py-4">
                <div className="text-green-600 text-2xl mb-2">✓</div>
                <p className="text-sm text-gray-700">Feedback submitted. Thank you!</p>
                <button onClick={() => setFeedbackOpen(false)} className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Close</button>
              </div>
            ) : (
              <>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category *</label>
                <select value={feedbackCategory} onChange={(e) => setFeedbackCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-3">
                  <option value="">Select category...</option>
                  {FEEDBACK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Message *</label>
                <textarea value={feedbackMessage} onChange={(e) => setFeedbackMessage(e.target.value)} placeholder="Describe your feedback..." className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-3" rows={4} />
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Attachments</label>
                <input type="file" multiple onChange={(e) => setFeedbackFiles(Array.from(e.target.files || []))} className="text-sm mb-4" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setFeedbackOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                  <button disabled={!feedbackCategory || !feedbackMessage.trim() || feedbackSubmitting} onClick={async () => {
                    setFeedbackSubmitting(true);
                    try {
                      const attachments = feedbackFiles.map(f => ({ name: f.name, size: f.size }));
                      const res = await fetch('/api/system-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: feedbackCategory, message: feedbackMessage, attachments }) });
                      if (res.ok) setFeedbackResult(true);
                    } catch {} finally { setFeedbackSubmitting(false); }
                  }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <CaseTable cases={assigned} title="Cases Assigned to Me" emptyMsg="No cases currently assigned to you." />
      <CaseTable cases={recent} title="Recently Worked Cases" emptyMsg="No recent cases found." />
    </div>
  );
}
