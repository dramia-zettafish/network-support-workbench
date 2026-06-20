'use client';

/**
 * Logistics Technician View — submit pickup/delivery outcomes.
 * @approved-write-client
 */

import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/lib/format-date.js';

const SUB_STATUS_OPTIONS = {
  'Ready For Pickup': ['Pick up Successful', 'Pick Up Failed'],
  'Ready For Delivery': ['Delivery Successful', 'Delivery Failure'],
};

export default function LogisticsTechnicianPage() {
  const { fmt } = useTimezone();
  const [data, setData] = useState(null);
  const [selections, setSelections] = useState({});
  const [escalations, setEscalations] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [escalationPopup, setEscalationPopup] = useState(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [failurePopup, setFailurePopup] = useState(null);
  const [failureReason, setFailureReason] = useState('');
  const [failureReasons, setFailureReasons] = useState({});
  const [notifyRcDone, setNotifyRcDone] = useState(false);
  const [notifyRcPopup, setNotifyRcPopup] = useState(null);
  const [missingCasePopup, setMissingCasePopup] = useState(null);
  const [sortKey, setSortKey] = useState('customerValue');
  const [sortKey2, setSortKey2] = useState('locationValue');
  const [sortDir, setSortDir] = useState(1);

  useEffect(() => {
    fetch('/api/write-safety/status')
      .then((r) => r.json())
      .then((d) => setWritesEnabled(d.enabled === true || d.writesEnabled === true))
      .catch(() => {});
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/logistics/workbook')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); setSelections({}); setEscalations({}); setFailureReasons({}); setNotifyRcDone(false); setMessage(null); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEscalateToggle = (row) => {
    if (escalations[row.workOrderKey]) {
      setEscalations((prev) => { const next = { ...prev }; delete next[row.workOrderKey]; return next; });
    } else {
      setEscalationPopup({ workOrderKey: row.workOrderKey, caseValue: row.caseValue });
      setEscalationReason('');
    }
  };

  const confirmEscalation = () => {
    if (!escalationReason.trim()) return;
    setEscalations((prev) => ({ ...prev, [escalationPopup.workOrderKey]: escalationReason.trim() }));
    setEscalationPopup(null);
    setEscalationReason('');
  };

  const cancelEscalation = () => { setEscalationPopup(null); setEscalationReason(''); };

  if (loading) return <main><div className="max-w-[1200px] mx-auto p-8"><p>Loading...</p></div></main>;
  if (!data?.workbook) {
    return (
      <main>
        <div className="max-w-[1200px] mx-auto px-8">
          <p style={{ color: 'var(--color-text-muted)' }}>No active workbook has been uploaded by the Route Coordinator.</p>
        </div>
      </main>
    );
  }

  const rows = data.rows || [];
  const activeRows = rows.filter((r) => r.editable);

  const grouped = {};
  for (const row of rows) {
    const key = row.statusReason || '(no status)';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const order = ['Ready For Pickup', 'Ready For Delivery'];
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const sortRows = (rows) => [...rows].sort((a, b) => {
    const cmp1 = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), undefined, { sensitivity: 'base' });
    if (cmp1 !== 0) return cmp1 * sortDir;
    return String(a[sortKey2] || '').localeCompare(String(b[sortKey2] || ''), undefined, { sensitivity: 'base' }) * sortDir;
  });
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey2(sortKey); setSortKey(key); setSortDir(1); }
  };
  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '';

  const needsSelection = activeRows.filter((r) => !selections[r.workOrderKey]);
  const needsFailureReason = activeRows.filter((r) => {
    const sel = selections[r.workOrderKey];
    return (sel === 'Pick Up Failed' || sel === 'Delivery Failure') && !failureReasons[r.workOrderKey];
  });
  const notifyRcRows = activeRows.filter((r) => {
    const sel = selections[r.workOrderKey] || '';
    return (sel === 'Pick Up Failed' && r.pickupScheduledAttempts >= 2) || sel === 'Delivery Failure';
  });
  const hasNotifyRc = notifyRcRows.length > 0;
  const cannotSubmit = needsSelection.length > 0 || needsFailureReason.length > 0 || (hasNotifyRc && !notifyRcDone);

  const handleSubmit = async () => {
    if (cannotSubmit) return;
    setSubmitting(true);
    setMessage(null);
    const updates = activeRows.map((r) => {
      const sel = selections[r.workOrderKey] || '';
      const notifyRc = (sel === 'Pick Up Failed' && r.pickupScheduledAttempts >= 2) || sel === 'Delivery Failure';
      return { work_order_value: r.workOrderValue, sub_status: sel, escalate: !!escalations[r.workOrderKey], escalation_reason: escalations[r.workOrderKey] || '', failure_reason: failureReasons[r.workOrderKey] || '', notify_rc: notifyRc };
    }).filter((u) => u.sub_status);
    if (!updates.length) { setMessage({ type: 'error', text: 'No submittable rows.' }); setSubmitting(false); return; }
    try {
      const res = await fetch('/api/logistics/workbook/updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) });
      const result = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: `✅ ${result.updatedRows} row(s) submitted successfully.` }); loadData(); }
      else { setMessage({ type: 'error', text: result.error || 'Submission failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  const latestSub = data.latestSubmission;

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a8e)', color: '#fff' }}>
          <h2 className="text-lg font-bold">Dynamics Integration</h2>
        </div>

        {message && (
          <div className={`px-4 py-3 mb-4 rounded border text-sm ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {rows.length === 0 && data.presentInActiveWorkbook && data.hasSubmitted && (
          <div className="p-4 rounded-md border mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>✅ All rows submitted</p>
          </div>
        )}

        {rows.length === 0 && !data.presentInActiveWorkbook && (
          <p style={{ color: 'var(--color-text-muted)' }}>No rows assigned to you in the active workbook.</p>
        )}

        {sortedKeys.map((statusKey) => (
          <div key={statusKey} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 border-b pb-2" style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
              {statusKey} ({grouped[statusKey].length})
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="text-left px-3 py-2 font-semibold cursor-pointer" style={{ color: 'var(--color-text-secondary)' }} onClick={() => handleSort('customerValue')}>Customer{sortIcon('customerValue')}</th>
                  <th className="text-left px-3 py-2 font-semibold cursor-pointer" style={{ color: 'var(--color-text-secondary)' }} onClick={() => handleSort('locationValue')}>Location{sortIcon('locationValue')}</th>
                  <th className="text-left px-3 py-2 font-semibold cursor-pointer" style={{ color: 'var(--color-text-secondary)' }} onClick={() => handleSort('caseValue')}>Case{sortIcon('caseValue')}</th>
                  <th className="text-left px-3 py-2 font-semibold cursor-pointer" style={{ color: 'var(--color-text-secondary)' }} onClick={() => handleSort('customerAssetValue')}>Customer Asset{sortIcon('customerAssetValue')}</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Outcome</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }} title="Inaccurate serial, customer, location, stage or device not on pickup list">Escalate <span className="cursor-help opacity-60">ℹ️</span></th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Notify RC</th>
                </tr>
              </thead>
              <tbody>
                {sortRows(grouped[statusKey]).map((row) => {
                  const opts = SUB_STATUS_OPTIONS[statusKey] || [];
                  const missing = statusKey === 'Ready For Pickup' && !selections[row.workOrderKey];
                  const isEscalated = !!escalations[row.workOrderKey];
                  return (
                    <tr key={row.workOrderKey} className={`${isEscalated ? 'bg-amber-50' : missing ? 'bg-amber-50/50' : ''}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{row.customerValue}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{row.locationValue}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{row.caseValue}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{row.customerAssetValue}</td>
                      <td className="px-3 py-2">
                        {row.editable ? (
                          <select
                            value={selections[row.workOrderKey] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'Pick Up Failed' || val === 'Delivery Failure') {
                                setFailurePopup({ workOrderKey: row.workOrderKey, caseValue: row.caseValue, subStatus: val });
                                setFailureReason('');
                              } else {
                                setFailureReasons((prev) => { const next = { ...prev }; delete next[row.workOrderKey]; return next; });
                              }
                              setSelections((prev) => ({ ...prev, [row.workOrderKey]: val }));
                            }}
                            className="px-2 py-1 rounded text-xs" style={{ background: 'var(--color-input-bg)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-input-border)', color: 'var(--color-text-primary)' }}
                            aria-label={`Outcome for ${row.caseValue}`}
                          >
                            <option value="">— select —</option>
                            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>{row.currentSubStatus || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.editable && (
                          <label className="flex items-center gap-1 cursor-pointer text-xs">
                            <input type="checkbox" checked={isEscalated} onChange={() => handleEscalateToggle(row)} title="Inaccurate serial, customer, location, stage or device not on pickup list" aria-label={`Escalate ${row.caseValue}`} />
                            {isEscalated && <span className="text-amber-600">⚠️</span>}
                          </label>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.editable && (() => {
                          const sel = selections[row.workOrderKey] || '';
                          const autoNotify = (sel === 'Pick Up Failed' && row.pickupScheduledAttempts >= 2) || sel === 'Delivery Failure';
                          return autoNotify ? <input type="checkbox" checked disabled aria-label={`Notify RC for ${row.caseValue}`} /> : null;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {activeRows.length > 0 && needsSelection.length === 0 && needsFailureReason.length === 0 && (
          <div className="mt-4 p-3 rounded-md border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Missing an assigned case?</p>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>If a case you are expecting is not listed below, notify the Route Coordinator so the record can be added and assigned to you.</p>
            <button
              onClick={() => setMissingCasePopup({ subject: 'Missing Case Report', body: 'Hello Route Coordinators,\n\nI am reporting a missing case that I expected to be assigned to me but is not listed in the current workbook.\n\n[Please describe the missing case details here]\n\nThank you,' })}
              className="px-3 py-1.5 text-xs font-semibold rounded border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-surface)' }}
            >
              Report Missing Case
            </button>
          </div>
        )}

        {activeRows.length > 0 && (
          <div className="mt-4 p-4 rounded-md" style={{ background: 'var(--color-surface-raised)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
            {needsSelection.length > 0 && (
              <p className="text-sm text-amber-800 mb-2">⚠️ {needsSelection.length} row(s) require a selection before submitting.</p>
            )}
            {needsFailureReason.length > 0 && (
              <p className="text-sm text-amber-800 mb-2">⚠️ {needsFailureReason.length} row(s) require a failure reason.</p>
            )}
            {hasNotifyRc && !notifyRcDone && needsSelection.length === 0 && needsFailureReason.length === 0 && (
              <div className="mb-3">
                <p className="text-sm text-blue-800 mb-2">📧 {notifyRcRows.length} row(s) require Route Coordinator notification before submitting.</p>
                <button
                  onClick={() => {
                    const caseCount = notifyRcRows.length;
                    const detailLines = notifyRcRows.map((r) => `• Case: ${r.caseValue} — ${selections[r.workOrderKey]} — Reason: ${failureReasons[r.workOrderKey] || 'N/A'}`).join('\n');
                    const subject = `Logistics Attention Needed - ${caseCount} Case${caseCount > 1 ? 's' : ''}`;
                    const body = `Hello Route Coordinators,\n\nThe following case(s) were marked unsuccessful in Logistics and require attention.\n\n${detailLines}\n\nThank you,`;
                    setNotifyRcPopup({ subject, body });
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Notify RC
                </button>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!writesEnabled || submitting || cannotSubmit}
              className={`px-4 py-2 text-sm font-semibold rounded ${!writesEnabled || cannotSubmit ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'}`}
            >
              {submitting ? 'Submitting...' : `Submit ${activeRows.length} Row(s)`}
            </button>
            {!writesEnabled && <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Write operations are disabled.</p>}
          </div>
        )}

        {latestSub && (
          <div className="mt-8 p-4 rounded-md border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Latest Submission ({latestSub.rowCount} rows) — {latestSub.state}</h2>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Submitted: {fmt(latestSub.createdAt)}
              {latestSub.downloadedAt && ` • Downloaded: ${fmt(latestSub.downloadedAt)}`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-surface)' }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Customer</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Location</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Case</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Customer Asset</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Status Reason</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Outcome</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Escalated</th>
                  </tr>
                </thead>
                <tbody>
                  {latestSub.rows.map((sr) => (
                    <tr key={sr.workOrderValue} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{sr.customerValue}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{sr.locationValue}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{sr.caseValue}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{sr.customerAssetValue}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{sr.statusReason}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{sr.subStatus || '—'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{sr.isEscalated ? '⚠️ Yes' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Escalation Reason Popup */}
      {escalationPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={cancelEscalation}>
          <div className="rounded-lg p-6 w-full max-w-[420px] shadow-2xl" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-amber-800 mb-2">⚠️ Escalation Reason</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>Case: <strong>{escalationPopup.caseValue}</strong></p>
            <textarea value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} placeholder="Enter reason for escalation..." rows={3} autoFocus className="w-full p-2 rounded text-sm mb-4 resize-y" style={{ background: 'var(--color-input-bg)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-input-border)', color: 'var(--color-text-primary)' }} aria-label="Escalation reason" />
            <div className="flex gap-2 justify-end">
              <button onClick={cancelEscalation} className="px-4 py-1.5 rounded text-sm cursor-pointer" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
              <button onClick={confirmEscalation} disabled={!escalationReason.trim()} className={`px-4 py-1.5 rounded text-sm font-semibold ${escalationReason.trim() ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Confirm Escalation</button>
            </div>
          </div>
        </div>
      )}

      {/* Failure Reason Popup */}
      {failurePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={() => { setFailurePopup(null); setSelections((prev) => ({ ...prev, [failurePopup.workOrderKey]: '' })); }}>
          <div className="rounded-lg p-6 w-full max-w-[420px] shadow-2xl" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-600 mb-2">❌ Failure Reason</h3>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Case: <strong>{failurePopup.caseValue}</strong></p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Outcome: {failurePopup.subStatus}</p>
            <textarea value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Enter reason for failure..." rows={3} autoFocus className="w-full p-2 rounded text-sm mb-4 resize-y" style={{ background: 'var(--color-input-bg)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-input-border)', color: 'var(--color-text-primary)' }} aria-label="Failure reason" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setFailurePopup(null); setSelections((prev) => ({ ...prev, [failurePopup.workOrderKey]: '' })); }} className="px-4 py-1.5 rounded text-sm cursor-pointer" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Cancel</button>
              <button onClick={() => { setFailureReasons((prev) => ({ ...prev, [failurePopup.workOrderKey]: failureReason.trim() })); setFailurePopup(null); }} disabled={!failureReason.trim()} className={`px-4 py-1.5 rounded text-sm font-semibold ${failureReason.trim() ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Notify RC Popup */}
      {notifyRcPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="rounded-lg p-6 w-full max-w-[550px] shadow-2xl max-h-[80vh] overflow-auto" style={{ background: 'var(--color-surface)' }}>
            <h3 className="text-lg font-semibold text-blue-800 mb-3">📧 Notify Route Coordinators</h3>
            <div className="mb-3">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Subject:</label>
              <p className="mt-1 p-2 rounded text-sm" style={{ background: 'var(--color-surface-raised)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>{notifyRcPopup.subject}</p>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Body:</label>
              <pre className="mt-1 p-2 rounded text-sm whitespace-pre-wrap font-[inherit]" style={{ background: 'var(--color-surface-raised)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>{notifyRcPopup.body}</pre>
            </div>
            <div className="flex gap-2 justify-end">
              <a href={`mailto:${(data?.route_coordinator_emails || []).map(e => encodeURIComponent(e)).join(',')}?subject=${encodeURIComponent(notifyRcPopup.subject)}&body=${encodeURIComponent(notifyRcPopup.body)}`} onClick={() => { setNotifyRcDone(true); setNotifyRcPopup(null); }} className="inline-block px-4 py-1.5 rounded text-sm font-semibold bg-blue-600 text-white no-underline hover:bg-blue-700">Email</a>
            </div>
          </div>
        </div>
      )}

      {/* Missing Case Popup */}
      {missingCasePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={() => setMissingCasePopup(null)}>
          <div className="rounded-lg p-6 w-full max-w-[550px] shadow-2xl max-h-[80vh] overflow-auto" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-amber-800 mb-3">📋 Report Missing Case</h3>
            <div className="mb-3">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Subject:</label>
              <p className="mt-1 p-2 rounded text-sm" style={{ background: 'var(--color-surface-raised)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>{missingCasePopup.subject}</p>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Body:</label>
              <pre className="mt-1 p-2 rounded text-sm whitespace-pre-wrap font-[inherit]" style={{ background: 'var(--color-surface-raised)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>{missingCasePopup.body}</pre>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMissingCasePopup(null)} className="px-4 py-1.5 rounded text-sm cursor-pointer" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Close</button>
              <a href={`mailto:${(data?.route_coordinator_emails || []).map(e => encodeURIComponent(e)).join(',')}?subject=${encodeURIComponent(missingCasePopup.subject)}&body=${encodeURIComponent(missingCasePopup.body)}`} onClick={() => setMissingCasePopup(null)} className="inline-block px-4 py-1.5 rounded text-sm font-semibold bg-blue-600 text-white no-underline hover:bg-blue-700">Email</a>
            </div>
          </div>
        </div>
      )}

      {/* EU Support Integration */}
      <EuSupportIntegration />
    </main>
  );
}

function EuSupportIntegration() {
  const { fmt } = useTimezone();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [escalations, setEscalations] = useState({});
  const [escalationPopup, setEscalationPopup] = useState(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [euNotifyPopup, setEuNotifyPopup] = useState(null);
  const [euNotifyDone, setEuNotifyDone] = useState(false);
  const [rcEmails, setRcEmails] = useState([]);
  const [missingCasePopup, setMissingCasePopup] = useState(null);
  const [failurePopup, setFailurePopup] = useState(null);
  const [failureReason, setFailureReason] = useState('');
  const [failureReasons, setFailureReasons] = useState({});
  const [intakeCrates, setIntakeCrates] = useState({});
  const [lastSubmission, setLastSubmission] = useState(null);

  useEffect(() => {
    fetch('/api/logistics/refresh-cases')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setCases(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch('/api/cases/catalogs')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data?.membersByTeamKey?.route_coordinators) setRcEmails(d.data.membersByTeamKey.route_coordinators.map(m => m.email).filter(Boolean)); })
      .catch(() => {});
  }, []);

  const SUB_STATUSES = {
    'Pickup Scheduled': ['Pick up Successful', 'Pick Up Failed'],
    'Ready for Pickup': ['Pick up Successful', 'Pick Up Failed'],
    'Delivery Scheduled': ['Delivery Successful', 'Delivery Failure'],
    'Ready for Delivery': ['Delivery Successful', 'Delivery Failure'],
    'Cancelled': ['Delivery Successful', 'Delivery Failure'],
  };

  async function handleSubmit() {
    const updates = Object.entries(selections).filter(([, v]) => v);
    if (!updates.length) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/logistics/refresh-cases/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: updates.map(([caseId, sub_status]) => ({ case_id: caseId, sub_status, escalate: !!escalations[caseId], escalation_reason: escalations[caseId] || '', failure_reason: failureReasons[caseId] || '', notify_rc: sub_status === 'Pick Up Failed' || sub_status === 'Delivery Failure', intake_crate: intakeCrates[caseId] || '' })) }),
      });
      if (res.ok) {
        const d = await res.json();
        setMessage({ type: 'success', text: `✅ ${d.updated} case(s) updated.` });
        // Capture submission summary before clearing
        const submittedRows = Object.entries(selections).filter(([, v]) => v).map(([caseId, sub_status]) => {
          const c = cases.find(x => x.id === caseId);
          return { case_number: c?.case_number, customer_name: c?.customer_name, facility: c?.facility, serial_number: c?.serial_number, stage: c?.stage, sub_status, escalated: !!escalations[caseId] };
        });
        setLastSubmission({ count: d.updated, rows: submittedRows, submittedAt: new Date().toISOString() });
        setSelections({});
        setEscalations({});
        setFailureReasons({});
        setIntakeCrates({});
        // Reload
        const r = await fetch('/api/logistics/refresh-cases');
        if (r.ok) { const rd = await r.json(); setCases(rd.data || []); }
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Submission failed.' });
      }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    finally { setSubmitting(false); }
  }

  if (loading) return null;
  if (!cases.length) return (
    <div className="max-w-[1200px] mx-auto px-8 mt-8">
      <div>
        <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e5a3a, #2d8e5a)', color: '#fff' }}>
          <h2 className="text-lg font-bold">EU Support Integration</h2>
        </div>
        {lastSubmission ? (
          <>
            <div className="p-4 rounded-md border mb-6" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>✅ All rows submitted</p>
            </div>
            <div className="p-4 rounded-md border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
              <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Latest Submission ({lastSubmission.count} cases) — {fmt(lastSubmission.submittedAt)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ background: 'var(--color-surface)' }}>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Customer</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Facility</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Case</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Customer Asset</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Stage</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Outcome</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Escalated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSubmission.rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.customer_name}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.facility || '-'}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.case_number}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.serial_number || '-'}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.stage}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.sub_status}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.escalated ? '⚠️ Yes' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No refresh cases assigned to you.</p>
        )}
      </div>
    </div>
  );

  const activeCount = Object.values(selections).filter(Boolean).length;
  const actionableCases = cases.filter(c => (SUB_STATUSES[c.stage] || []).length > 0);
  const allSelected = actionableCases.length > 0 && actionableCases.every(c => selections[c.id]) && actionableCases.every(c => { const sel = selections[c.id] || ''; return (sel !== 'Pick Up Failed' && sel !== 'Delivery Failure') || failureReasons[c.id]; });
  const hasEscalations = Object.keys(escalations).length > 0;
  const notifyRcCases = actionableCases.filter(c => { const sel = selections[c.id] || ''; return (sel === 'Pick Up Failed' && (c.pickup_failure_count || 0) >= 1) || sel === 'Delivery Failure'; });
  const needsNotifyRc = (hasEscalations || notifyRcCases.length > 0) && !euNotifyDone;

  return (
    <div className="max-w-[1200px] mx-auto px-8 mt-8">
      <div>
        <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e5a3a, #2d8e5a)', color: '#fff' }}>
          <h2 className="text-lg font-bold">EU Support Integration</h2>
        </div>
        {message && <div className={`px-3 py-2 rounded text-sm mb-4 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>{message.text}</div>}

        {(() => {
          const pickupCases = cases.filter(c => c.stage === 'Pickup Scheduled' || c.stage === 'Ready for Pickup');
          const deliveryCases = cases.filter(c => c.stage === 'Delivery Scheduled' || c.stage === 'Ready for Delivery' || c.stage === 'Cancelled');
          const renderTable = (rows, title, isPickup) => (
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>{title}</h3>
              {rows.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No cases</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr style={{ background: 'var(--color-surface-raised)' }}>
                        <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Customer</th>
                        <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Facility</th>
                        <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case</th>
                        <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Customer Asset</th>
                        <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Outcome</th>
                        {isPickup && <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Intake Crate</th>}
                        <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} title="Inaccurate serial, customer, location, stage or device not on pickup list">Escalate <span className="cursor-help opacity-60">ℹ️</span></th>
                        <th className="font-semibold text-left px-3 py-2 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Notify RC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => {
                        const options = SUB_STATUSES[c.stage] || [];
                        return (
                          <tr key={c.id}>
                            <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.customer_name}</td>
                            <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.facility || '-'}</td>
                            <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><a href={`/cases/${c.id}`} className="text-blue-600 underline text-xs">{c.case_number}</a></td>
                            <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.serial_number || '-'}</td>
                            <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                              {options.length > 0 ? (
                                <select value={selections[c.id] || ''} onChange={(e) => {
                                  const val = e.target.value;
                                  setSelections(prev => ({ ...prev, [c.id]: val }));
                                  if (val === 'Pick Up Failed' || val === 'Delivery Failure') {
                                    setFailurePopup({ caseId: c.id, caseNumber: c.case_number, type: val === 'Pick Up Failed' ? 'pickup' : 'delivery' });
                                    setFailureReason('');
                                  } else {
                                    setFailureReasons(prev => { const next = { ...prev }; delete next[c.id]; return next; });
                                  }
                                }} className="px-2 py-1 border border-slate-200 rounded text-xs">
                                  <option value="">Select...</option>
                                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : <span className="text-xs text-gray-400">{c.stage}</span>}
                            </td>
                            {isPickup && <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                              <input type="text" value={intakeCrates[c.id] || ''} onChange={(e) => setIntakeCrates(prev => ({ ...prev, [c.id]: e.target.value.toUpperCase() }))} placeholder="Crate #" className="px-2 py-1 border border-slate-200 rounded text-xs w-24" />
                            </td>}
                            <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                              {options.length > 0 && (
                                <label className="flex items-center gap-1 cursor-pointer text-xs">
                                  <input type="checkbox" checked={!!escalations[c.id]} onChange={() => { if (escalations[c.id]) { setEscalations(prev => { const next = { ...prev }; delete next[c.id]; return next; }); } else { setEscalationPopup(c.id); setEscalationReason(''); } }} />
                                  {escalations[c.id] && <span className="text-amber-600">⚠️</span>}
                                </label>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                              {(() => { const sel = selections[c.id] || ''; return ((sel === 'Pick Up Failed' && (c.pickup_failure_count || 0) >= 1) || sel === 'Delivery Failure') ? <input type="checkbox" checked disabled /> : null; })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
          return <>{renderTable(pickupCases, 'Ready for Pickup', true)}{renderTable(deliveryCases, 'Ready for Delivery', false)}</>;
        })()}

        {escalationPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setEscalationPopup(null); setEscalationReason(''); }}>
            <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-bold mb-3">Escalation Reason</h4>
              <textarea value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} placeholder="Describe the issue..." className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-3" rows={3} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEscalationPopup(null); setEscalationReason(''); }} className="px-3 py-1.5 text-sm rounded border border-slate-200">Cancel</button>
                <button onClick={() => { if (escalationReason.trim()) { setEscalations(prev => ({ ...prev, [escalationPopup]: escalationReason.trim() })); setEscalationPopup(null); setEscalationReason(''); } }} disabled={!escalationReason.trim()} className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {failurePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setFailurePopup(null); setFailureReason(''); }}>
            <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-bold mb-3">{failurePopup.type === 'pickup' ? 'Pickup' : 'Delivery'} Failure Reason — {failurePopup.caseNumber}</h4>
              <textarea value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Reason for failure..." className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-3" rows={3} required />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setSelections(prev => ({ ...prev, [failurePopup.caseId]: '' })); setFailurePopup(null); setFailureReason(''); }} className="px-3 py-1.5 text-sm rounded border border-slate-200">Cancel</button>
                <button onClick={() => { if (failureReason.trim()) { setFailureReasons(prev => ({ ...prev, [failurePopup.caseId]: failureReason.trim() })); setFailurePopup(null); setFailureReason(''); } }} disabled={!failureReason.trim()} className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {actionableCases.length > 0 && allSelected && (
          <div className="mt-4 p-3 rounded-md border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Missing an assigned case?</p>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>If a case you are expecting is not listed, notify the Route Coordinator so the record can be added and assigned to you.</p>
            <button
              onClick={() => setMissingCasePopup({ subject: 'Missing Case Report', body: `Hello Route Coordinators,\n\nI am reporting a missing case that I expected to be assigned to me but is not listed in EU Support Integration.\n\n[Please describe the missing case details here]\n\nThank you,` })}
              className="px-3 py-1.5 text-xs font-semibold rounded border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-surface)' }}
            >
              Report Missing Case
            </button>
          </div>
        )}

        {actionableCases.length > 0 && (
          <div className="mt-4 p-4 rounded-md" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
            {!allSelected && (
              <p className="text-sm text-amber-800 mb-2">⚠️ {actionableCases.filter(c => !selections[c.id] || ((selections[c.id] === 'Pick Up Failed' || selections[c.id] === 'Delivery Failure') && !failureReasons[c.id])).length} row(s) require a selection before submitting.</p>
            )}
            {allSelected && needsNotifyRc && (
              <div className="mb-3">
                <p className="text-sm text-blue-800 mb-2">📧 {notifyRcCases.length + Object.keys(escalations).length} case(s) require Route Coordinator notification before submitting.</p>
                <button
                  onClick={() => {
                    const lines = [];
                    notifyRcCases.forEach(c => { lines.push(`• ${c.case_number} (${c.customer_name}) — ${selections[c.id]}${failureReasons[c.id] ? ' — Reason: ' + failureReasons[c.id] : ''}`); });
                    Object.entries(escalations).forEach(([cid, reason]) => { const c = cases.find(x => x.id === cid); if (c && !notifyRcCases.find(x => x.id === cid)) lines.push(`• ${c.case_number} (${c.customer_name}) — Escalation: ${reason}`); else if (c) { const idx = lines.findIndex(l => l.includes(c.case_number)); if (idx >= 0) lines[idx] += ` — Escalation: ${reason}`; } });
                    const subject = `Logistics Attention Needed - ${lines.length} Case${lines.length > 1 ? 's' : ''}`;
                    const body = `Hello Route Coordinators,\n\nThe following case(s) require attention.\n\n${lines.join('\n')}\n\nThank you,`;
                    setEuNotifyPopup({ subject, body });
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
                >Notify RC</button>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!allSelected || needsNotifyRc || submitting}
              className={`px-4 py-2 text-sm font-semibold rounded ${!allSelected || needsNotifyRc ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'}`}
            >
              {submitting ? 'Submitting...' : `Submit ${activeCount} Update(s)`}
            </button>
          </div>
        )}

        {euNotifyPopup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
            <div className="rounded-lg p-6 w-full max-w-[550px] shadow-2xl max-h-[80vh] overflow-auto" style={{ background: 'var(--color-surface)' }}>
              <h3 className="text-lg font-semibold text-blue-800 mb-3">📧 Notify Route Coordinators</h3>
              <div className="mb-3">
                <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Subject:</label>
                <p className="mt-1 p-2 rounded text-sm" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>{euNotifyPopup.subject}</p>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Body:</label>
                <pre className="mt-1 p-2 rounded text-sm whitespace-pre-wrap font-[inherit]" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>{euNotifyPopup.body}</pre>
              </div>
              <div className="flex gap-2 justify-end">
                <a href={`mailto:${rcEmails.join(',')}?subject=${encodeURIComponent(euNotifyPopup.subject)}&body=${encodeURIComponent(euNotifyPopup.body)}`} onClick={() => { setEuNotifyDone(true); setEuNotifyPopup(null); }} className="inline-block px-4 py-1.5 rounded text-sm font-semibold bg-blue-600 text-white no-underline hover:bg-blue-700">Email</a>
              </div>
            </div>
          </div>
        )}

        {missingCasePopup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={() => setMissingCasePopup(null)}>
            <div className="rounded-lg p-6 w-full max-w-[550px] shadow-2xl max-h-[80vh] overflow-auto" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-amber-800 mb-3">📋 Report Missing Case</h3>
              <div className="mb-3">
                <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Subject:</label>
                <p className="mt-1 p-2 rounded text-sm" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>{missingCasePopup.subject}</p>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Body:</label>
                <pre className="mt-1 p-2 rounded text-sm whitespace-pre-wrap font-[inherit]" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>{missingCasePopup.body}</pre>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setMissingCasePopup(null)} className="px-4 py-1.5 rounded text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>Close</button>
                <a href={`mailto:${rcEmails.join(',')}?subject=${encodeURIComponent(missingCasePopup.subject)}&body=${encodeURIComponent(missingCasePopup.body)}`} onClick={() => setMissingCasePopup(null)} className="inline-block px-4 py-1.5 rounded text-sm font-semibold bg-blue-600 text-white no-underline hover:bg-blue-700">Email</a>
              </div>
            </div>
          </div>
        )}

        {lastSubmission && (
          <div className="mt-8 p-4 rounded-md border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Latest Submission ({lastSubmission.count} cases) — {fmt(lastSubmission.submittedAt)}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-surface)' }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Customer</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Facility</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Case</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Customer Asset</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Stage</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Outcome</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Escalated</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSubmission.rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.customer_name}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.facility || '-'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.case_number}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.serial_number || '-'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.stage}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.sub_status}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>{r.escalated ? '⚠️ Yes' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
