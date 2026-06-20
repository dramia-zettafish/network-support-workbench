'use client';
// @approved-write-client
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTimezone } from '@/lib/format-date.js';

const SUB_STATUS_OPTIONS = { 'Ready For Pickup': ['Pick up Successful', 'Pick Up Failed'], 'Ready For Delivery': ['Delivery Successful', 'Delivery Failure'] };

export default function LogisticsTechnicianPage() {
  const { fmt } = useTimezone();
  const [owners, setOwners] = useState([]);
  const [rows, setRows] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [chamberCleared, setChamberCleared] = useState(false);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(null);
  const [message, setMessage] = useState(null);
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [correctionWOs, setCorrectionWOs] = useState([]);
  const [correctionExplanation, setCorrectionExplanation] = useState('');
  const [correctionPreview, setCorrectionPreview] = useState(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState('');

  useEffect(() => { fetch('/api/write-safety/status').then((r) => r.json()).then((d) => setWritesEnabled(d.enabled === true)).catch(() => {}); }, []);
  useEffect(() => {
    fetch('/api/logistics/owners').then((r) => r.json()).then((d) => {
      setOwners(d.owners || []);
      const params = new URLSearchParams(window.location.search);
      const ownerParam = params.get('owner');
      if (ownerParam) setSelectedOwner(ownerParam);
      else if (d.owners?.length > 0) setSelectedOwner(d.owners[0].name);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = useCallback(() => {
    if (!selectedOwner) return;
    Promise.all([
      fetch(`/api/logistics/rows?owner=${encodeURIComponent(selectedOwner)}`).then((r) => r.json()),
      fetch('/api/logistics/submissions/status').then((r) => r.json()),
    ]).then(([rowData, statusData]) => {
      setRows(rowData.rows || []);
      if (statusData.active) setChamberCleared(!!statusData.lastClearedAt);
      fetch('/api/logistics/submissions').then((r) => r.json()).then((subData) => setSubmissions(subData.submissions || []));
      setSelections({}); setMessage(null); setCorrectionPreview(null);
    }).catch(() => {});
  }, [selectedOwner]);

  useEffect(() => { loadData(); }, [loadData]);

  const submittedWOs = new Set(submissions.map((s) => s.work_order_number));
  const ownerSubmissions = submissions.filter((s) => s.owner.toLowerCase() === selectedOwner.toLowerCase());
  const activeRows = rows.filter((r) => !submittedWOs.has(r.work_order_number));
  const grouped = {};
  for (const row of activeRows) { const key = row.status_reason || '(no status)'; if (!grouped[key]) grouped[key] = []; grouped[key].push(row); }
  const sortedKeys = Object.keys(grouped).sort((a, b) => { const order = ['Ready For Pickup', 'Ready For Delivery']; const ai = order.indexOf(a), bi = order.indexOf(b); if (ai !== -1 && bi !== -1) return ai - bi; if (ai !== -1) return -1; if (bi !== -1) return 1; return a.localeCompare(b); });
  const needsSelection = activeRows.filter((r) => { const opts = SUB_STATUS_OPTIONS[r.status_reason]; if (!opts) return false; if (r.status_reason === 'Ready For Delivery') return false; return !selections[r.work_order_number]; });

  const handleSubmit = async () => {
    if (needsSelection.length > 0) return;
    setSubmitting(true); setMessage(null);
    const updates = activeRows.filter((r) => SUB_STATUS_OPTIONS[r.status_reason]).map((r) => ({ work_order_number: r.work_order_number, sub_status: selections[r.work_order_number] || '' }));
    if (!updates.length) { setMessage({ type: 'error', text: 'No submittable rows.' }); setSubmitting(false); return; }
    try { const res = await fetch('/api/logistics/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: selectedOwner, updates }) }); const data = await res.json(); if (res.ok) { setMessage({ type: 'success', text: `✅ ${data.submitted} row(s) submitted.` }); loadData(); } else setMessage({ type: 'error', text: data.error || 'Failed.' }); } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  const handleUndo = async (wo) => {
    setUndoing(wo); setMessage(null);
    try { const res = await fetch('/api/logistics/submissions/undo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: selectedOwner, work_order_numbers: [wo] }) }); const data = await res.json(); if (res.ok) { setMessage({ type: 'success', text: `✅ Submission for ${wo} withdrawn.` }); loadData(); } else setMessage({ type: 'error', text: data.error || 'Undo failed.' }); } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setUndoing(null);
  };

  const handleCorrectionPreview = async () => {
    if (correctionWOs.length === 0 || !correctionExplanation.trim()) return;
    setGeneratingPreview(true);
    try { const res = await fetch('/api/logistics/corrections/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: selectedOwner, work_order_numbers: correctionWOs, explanation: correctionExplanation }) }); const data = await res.json(); if (res.ok) setCorrectionPreview(data); else setMessage({ type: 'error', text: data.error || 'Preview failed.' }); } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setGeneratingPreview(false);
  };

  const toggleCorrectionWO = (wo) => setCorrectionWOs((prev) => prev.includes(wo) ? prev.filter((w) => w !== wo) : [...prev, wo]);

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        <p className="mb-4"><Link href="/logistics" className="text-blue-600">← Back to Logistics</Link></p>
        <div className="mb-6">
          <label htmlFor="owner-select" className="font-semibold mr-2">Owner:</label>
          <select id="owner-select" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)} className="px-3 py-1.5 rounded border border-gray-300 text-sm">
            <option value="">Select owner...</option>
            {owners.map((o) => <option key={o.name} value={o.name}>{o.name} ({o.count})</option>)}
          </select>
        </div>
        {loading && <p>Loading...</p>}
        {message && <div className={`px-4 py-3 mb-4 rounded border text-sm ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>{message.text}</div>}
        {!loading && activeRows.length === 0 && selectedOwner && ownerSubmissions.length === 0 && <p className="text-gray-500">No rows found for {selectedOwner}.</p>}
        {!loading && activeRows.length === 0 && selectedOwner && ownerSubmissions.length > 0 && <div className="p-4 bg-green-50 border border-green-200 rounded-md mb-6"><p className="font-semibold text-green-800">✅ All rows submitted for {selectedOwner}</p></div>}

        {sortedKeys.map((statusKey) => (
          <div key={statusKey} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b border-slate-200 pb-2">{statusKey} ({grouped[statusKey].length})</h2>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-slate-50"><th className="text-left px-3 py-2 font-semibold text-gray-700">Case</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Customer</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Location</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Outcome</th></tr></thead>
              <tbody>{grouped[statusKey].map((row) => {
                const opts = SUB_STATUS_OPTIONS[statusKey] || [];
                const missing = statusKey === 'Ready For Pickup' && !selections[row.work_order_number];
                return (
                  <tr key={row.work_order_number} className={`border-b border-slate-200 ${missing ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-3 py-2 text-gray-600">{row.case_number}</td>
                    <td className="px-3 py-2 text-gray-600">{row.customer}</td>
                    <td className="px-3 py-2 text-gray-600">{row.location}</td>
                    <td className="px-3 py-2">
                      <select value={selections[row.work_order_number] || ''} onChange={(e) => setSelections((prev) => ({ ...prev, [row.work_order_number]: e.target.value }))} className="px-2 py-1 rounded border border-gray-300 text-xs" aria-label={`Outcome for ${row.case_number}`}>
                        <option value="">{statusKey === 'Ready For Delivery' ? '(no update)' : '— select —'}</option>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ))}

        {activeRows.length > 0 && (
          <div className="mt-4 p-4 bg-slate-50 rounded-md border border-slate-200">
            {needsSelection.length > 0 && <p className="text-sm text-amber-800 mb-2">⚠️ {needsSelection.length} row(s) require a selection.</p>}
            <button onClick={handleSubmit} disabled={!writesEnabled || submitting || needsSelection.length > 0} className={`px-4 py-2 text-sm font-semibold rounded ${!writesEnabled || needsSelection.length > 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {submitting ? 'Submitting...' : `Submit ${activeRows.filter((r) => SUB_STATUS_OPTIONS[r.status_reason]).length} Row(s)`}
            </button>
            {!writesEnabled && <p className="text-xs text-gray-400 mt-2">Write operations are disabled.</p>}
          </div>
        )}

        {ownerSubmissions.length > 0 && (
          <div className="mt-8 p-4 bg-sky-50 rounded-md border border-sky-200">
            <h2 className="text-lg font-semibold text-sky-900 mb-3">Submitted Rows ({ownerSubmissions.length})</h2>
            {!chamberCleared && <p className="text-xs text-sky-700 mb-3">ℹ️ Undo is available — chamber has not been cleared yet.</p>}
            {chamberCleared && <p className="text-xs text-amber-800 mb-3">⚠️ Chamber cleared. Use correction request below.</p>}
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-sky-100"><th className="text-left px-3 py-2 font-semibold text-gray-700">WO</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Sub-Status</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Submitted</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Action</th></tr></thead>
              <tbody>{ownerSubmissions.map((s) => (
                <tr key={s.work_order_number} className="border-b border-sky-200">
                  <td className="px-3 py-2 text-gray-600">{s.work_order_number}</td>
                  <td className="px-3 py-2 text-gray-600">{s.sub_status || '(blank)'}</td>
                  <td className="px-3 py-2 text-gray-600">{s.submittedAt ? fmt(s.submittedAt) : '—'}</td>
                  <td className="px-3 py-2">
                    {!chamberCleared ? (
                      <button onClick={() => handleUndo(s.work_order_number)} disabled={!writesEnabled || undoing === s.work_order_number} className={`px-2 py-0.5 text-xs font-semibold rounded ${writesEnabled ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-200 text-gray-400'}`}>{undoing === s.work_order_number ? '...' : 'Undo'}</button>
                    ) : (
                      <label className="text-xs cursor-pointer"><input type="checkbox" checked={correctionWOs.includes(s.work_order_number)} onChange={() => toggleCorrectionWO(s.work_order_number)} className="mr-1" />Select</label>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {chamberCleared && (
              <div className="mt-4 p-4 bg-amber-50 rounded-md border border-amber-200">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">Correction Request Preview</h3>
                <p className="text-xs text-amber-900 mb-3">Select affected rows above, provide an explanation, then generate a preview.</p>
                <textarea value={correctionExplanation} onChange={(e) => setCorrectionExplanation(e.target.value)} placeholder="Explain what needs to be corrected..." rows={3} className="w-full p-2 rounded border border-gray-300 text-sm mb-2 resize-y" aria-label="Correction explanation" />
                <button onClick={handleCorrectionPreview} disabled={correctionWOs.length === 0 || !correctionExplanation.trim() || generatingPreview} className={`px-4 py-2 text-sm font-semibold rounded ${correctionWOs.length > 0 && correctionExplanation.trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  {generatingPreview ? 'Generating...' : `Generate Preview (${correctionWOs.length} row(s))`}
                </button>
                {correctionPreview && (
                  <div className="mt-4 p-4 bg-white rounded border border-gray-300">
                    <p className="text-xs text-red-600 font-semibold mb-2">⚠️ Correction Request Preview – Not Sent</p>
                    <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-slate-50 p-3 rounded border border-slate-200 font-mono">{correctionPreview.message}</pre>
                    <button onClick={() => { navigator.clipboard?.writeText(correctionPreview.message); setMessage({ type: 'success', text: 'Copied to clipboard.' }); }} className="mt-2 px-3 py-1 text-xs font-semibold rounded bg-green-600 text-white hover:bg-green-700">📋 Copy to Clipboard</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
