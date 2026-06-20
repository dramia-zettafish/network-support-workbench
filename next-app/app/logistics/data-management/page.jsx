'use client';
// @approved-write-client
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTimezone } from '@/lib/format-date.js';

export default function LogisticsDataManagementPage() {
  const { fmt } = useTimezone();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');

  useEffect(() => { fetch('/api/write-safety/status').then((r) => r.json()).then((d) => setWritesEnabled(d.enabled === true)).catch(() => {}); }, []);
  useEffect(() => { fetch('/api/data-management/refresh-team-export').then(r => r.json()).then(d => { if (d.teams?.length) { setTeams(d.teams); setSelectedTeam(d.teams[0].id); } }).catch(() => {}); }, []);
  const loadStatus = useCallback(() => { fetch('/api/logistics/submissions/status').then((r) => r.json()).then((d) => { setStatus(d); setLoading(false); }).catch(() => setLoading(false)); }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleDownload = () => { window.location.href = '/api/logistics/download/current'; };
  const handleClear = async () => {
    setClearing(true); setMessage(null);
    try { const res = await fetch('/api/logistics/submissions/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) }); const data = await res.json(); if (res.ok) { setMessage({ type: 'success', text: '✅ Chamber cleared.' }); setShowConfirm(false); loadStatus(); } else setMessage({ type: 'error', text: data.error || 'Clear failed.' }); } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setClearing(false);
  };

  const allComplete = status?.owners?.length > 0 && status.owners.every((o) => o.complete);

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        <p className="mb-4"><Link href="/logistics" className="text-blue-600">← Back to Logistics</Link></p>
        {loading && <p>Loading...</p>}
        {!loading && !status?.active && <p className="text-gray-500">No active workbook. <Link href="/logistics/upload" className="text-blue-600">Upload one</Link>.</p>}
        {!loading && status?.active && (
          <>
            {message && <div className={`px-4 py-3 mb-4 rounded border text-sm ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>{message.text}</div>}

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Workbook Status</h2>
              <ul className="list-none p-0">
                <li className="py-1 text-sm">📄 <strong>File:</strong> {status.filename}</li>
                <li className="py-1 text-sm">🕐 <strong>Uploaded:</strong> {fmt(status.uploadedAt)}</li>
                <li className="py-1 text-sm">📊 <strong>Total Rows:</strong> {status.totalRows}</li>
                <li className="py-1 text-sm">📝 <strong>Submissions:</strong> {status.totalSubmissions} / {status.totalRows}</li>
                {status.lastDownloadedAt && <li className="py-1 text-sm">⬇️ <strong>Last Download:</strong> {fmt(status.lastDownloadedAt)}</li>}
                {status.lastClearedAt && <li className="py-1 text-sm">🗑️ <strong>Last Cleared:</strong> {fmt(status.lastClearedAt)}</li>}
              </ul>
            </div>

            <div className={`mb-6 px-4 py-3 rounded-md border ${status.lastClearedAt ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-sm font-semibold ${status.lastClearedAt ? 'text-amber-800' : 'text-green-800'}`}>
                {status.lastClearedAt ? '⚠️ Chamber cleared — corrections require a correction request.' : '✅ Chamber active — technicians can undo directly.'}
              </p>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Submission Progress by Owner</h2>
              {status.owners?.length > 0 ? (
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-slate-50"><th className="text-left px-3 py-2 font-semibold text-gray-700">Owner</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Assigned</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Submitted</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Remaining</th><th className="text-left px-3 py-2 font-semibold text-gray-700">Status</th></tr></thead>
                  <tbody>{status.owners.map((o) => (
                    <tr key={o.name} className="border-b border-slate-200">
                      <td className="px-3 py-2 text-gray-600">{o.name}</td><td className="px-3 py-2 text-gray-600">{o.totalRows}</td><td className="px-3 py-2 text-gray-600">{o.submittedRows}</td><td className="px-3 py-2 text-gray-600">{o.remainingRows}</td>
                      <td className="px-3 py-2">{o.complete ? <span className="text-green-600 font-semibold">✅ Complete</span> : <span className="text-amber-600">⏳ Pending</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="text-gray-500">No owners found.</p>}
              {allComplete && <p className="mt-3 text-green-600 font-semibold">✅ All owners complete. Ready for download.</p>}
            </div>

            <div className="mb-6 p-4 bg-slate-50 rounded-md border border-slate-200">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Actions</h2>
              <div className="flex gap-3 flex-wrap items-center">
                <button onClick={handleDownload} disabled={status.totalSubmissions === 0} className={`px-4 py-2 text-sm font-semibold rounded ${status.totalSubmissions > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>⬇️ Download Current Output</button>
                {!showConfirm ? (
                  <button onClick={() => setShowConfirm(true)} disabled={!writesEnabled || status.totalSubmissions === 0} className={`px-4 py-2 text-sm font-semibold rounded ${writesEnabled && status.totalSubmissions > 0 ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>🗑️ Clear Chamber</button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <span className="text-red-800 text-sm font-semibold">Confirm clear?</span>
                    <button onClick={handleClear} disabled={clearing} className="px-4 py-2 text-sm font-semibold rounded bg-red-600 text-white hover:bg-red-700">{clearing ? 'Clearing...' : 'Yes, Clear'}</button>
                    <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm font-semibold rounded bg-gray-500 text-white hover:bg-gray-600">Cancel</button>
                  </div>
                )}
              </div>
              {!writesEnabled && <p className="text-xs text-gray-400 mt-2">Write operations disabled. Download available but clearing requires writes enabled.</p>}
              <p className="text-xs text-gray-500 mt-2">ℹ️ Clearing does NOT delete the workbook. It resets submission state and ends direct undo.</p>
            </div>
          </>
        )}

        {teams.length > 0 && (
          <div className="mt-8 p-4 bg-slate-50 rounded-md border border-slate-200">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Refresh Logistics Team Assignments</h2>
            <div className="flex gap-3 items-center flex-wrap">
              <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-md text-sm">
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={() => { window.location.href = `/api/data-management/refresh-team-export?team_id=${encodeURIComponent(selectedTeam)}`; }} disabled={!selectedTeam} className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">⬇️ Download CSV</button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Exports pickup scheduled cases assigned to the selected team for today's date.</p>
          </div>
        )}
      </div>
    </main>
  );
}
