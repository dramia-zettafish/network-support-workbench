'use client';
// @approved-write-client

/**
 * Logistics Upload Page — upload a new active workbook.
 * Checks write-safety status before allowing upload.
 */

import { useState, useEffect } from 'react';
import { useTimezone } from '@/lib/format-date.js';

export default function LogisticsUploadPage() {
  const { fmt } = useTimezone();
  const [writesEnabled, setWritesEnabled] = useState(true);
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/write-safety/status')
      .then((r) => r.json())
      .then((d) => setWritesEnabled(d.writesEnabled || d.enabled))
      .catch(() => setWritesEnabled(false));

    fetch('/api/logistics/workbook/status')
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const fileInput = e.target.elements.file;
    const file = fileInput?.files?.[0];
    if (!file) { setError('Please select a file'); return; }
    if (!file.name.replace(/['"]/g, '').endsWith('.xlsx')) { setError('Only .xlsx files are accepted'); return; }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/logistics/workbook/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); }
      else { setResult(data); setStatus({ active: true, ...data }); }
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="rounded-lg p-8" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
          {!writesEnabled && (
            <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border border-red-200 rounded-md text-red-800 font-medium">
              <span className="text-xl">⚠️</span>
              Writes are disabled. Set WRITES_ENABLED=true to upload workbooks.
            </div>
          )}

          <form onSubmit={handleUpload} className="mt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Select .xlsx Workbook</h3>
              <p className="mb-3" style={{ color: 'var(--color-text-muted)' }}>Upload the active workbook for Logistics processing. Only the latest workbook is stored.</p>
              <input type="file" id="file" name="file" disabled={!writesEnabled || uploading} className="input-themed text-sm" />
            </div>
            <button
              type="submit"
              disabled={!writesEnabled || uploading}
              className={`px-6 py-2 text-white font-semibold rounded ${writesEnabled ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
            >
              {uploading ? 'Uploading...' : 'Upload Workbook'}
            </button>
          </form>

          {error && (
            <div className="flex items-center gap-3 px-6 py-4 mt-4 bg-red-50 border border-red-200 rounded-md text-red-800 font-medium">
              <span className="text-xl">❌</span> {error}
            </div>
          )}

          {result && (
            <div className="flex items-center gap-3 px-6 py-4 mt-4 bg-green-50 border border-green-200 rounded-md text-green-800 font-medium">
              <span className="text-xl">✅</span>
              Uploaded {result.filename} — {result.rowCount} rows parsed.
              {result.warnings?.length > 0 && ` (${result.warnings.length} warning(s))`}
            </div>
          )}

          {status?.active && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Current Active Workbook</h3>
              <ul className="list-none p-0">
                <li className="py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>File: {status.filename}</li>
                <li className="py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Uploaded: {fmt(status.uploadedAt)}</li>
                <li className="py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Uploaded By: {status.uploadedBy || '-'}</li>
                <li className="py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Rows: {status.rowCount}</li>
              </ul>
            </div>
          )}
        </div>

        {/* Custom Refresh Logistics Teams */}
        <div className="rounded-lg p-8 mt-6" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
          <CustomLogisticsTeams />
        </div>
      </div>
    </main>
  );
}

function CustomLogisticsTeams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logTechs, setLogTechs] = useState([]);
  const [newName, setNewName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function fetchTeams() { const res = await fetch('/api/logistics-teams'); if (res.ok) { const d = await res.json(); setTeams(d.data || []); } setLoading(false); }
  useEffect(() => { fetchTeams(); fetch('/api/cases/catalogs').then(r => r.ok ? r.json() : null).then(d => { if (d?.data?.membersByTeamKey?.logistics_technicians) setLogTechs(d.data.membersByTeamKey.logistics_technicians); }).catch(() => {}); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim() || !selectedMembers.size) return;
    setError(null); setSuccess(null); setCreating(true);
    try {
      const res = await fetch('/api/logistics-teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim(), member_upns: [...selectedMembers] }) });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      setSuccess('Team created'); setNewName(''); setSelectedMembers(new Set());
      await fetchTeams();
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Network error'); }
    finally { setCreating(false); }
  }

  async function handleDelete(id, name) { if (!confirm(`Delete team "${name}"?`)) return; await fetch(`/api/logistics-teams/${id}`, { method: 'DELETE' }); await fetchTeams(); }

  function toggleMember(upn) { setSelectedMembers(prev => { const next = new Set(prev); if (next.has(upn)) next.delete(upn); else next.add(upn); return next; }); }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Custom Refresh Logistics Teams</h3>

      <form onSubmit={handleCreate} className="mb-6 p-4 rounded border" style={{ borderColor: 'var(--color-border)' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Create New Team</h4>
        {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
        {success && <div className="text-xs text-green-600 mb-2">{success}</div>}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Team Name *</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Monday AM Pickup Crew" required className="input-themed w-full max-w-[300px] px-3 py-2 rounded text-sm" />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Assign Logistics Technicians *</label>
          <div className="flex flex-wrap gap-3 mt-1">
            {logTechs.map((m) => (
              <label key={m.upn} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                <input type="checkbox" checked={selectedMembers.has(m.upn)} onChange={() => toggleMember(m.upn)} />
                {m.display_name || m.upn}
              </label>
            ))}
          </div>
          {logTechs.length === 0 && <div className="text-xs text-gray-500">No logistics technicians found</div>}
        </div>
        <button type="submit" disabled={creating || !newName.trim() || !selectedMembers.size} className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{creating ? 'Creating...' : 'Create Team'}</button>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Teams expire automatically after 7 days.</p>
      </form>

      {loading && <div className="text-sm text-gray-500">Loading teams...</div>}
      {!loading && teams.length === 0 && <div className="text-sm text-gray-500">No active custom teams</div>}
      {!loading && teams.length > 0 && (
        <div className="space-y-3">
          {teams.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded border" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t.name}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {t.members.map(m => m.display_name || m.user_upn).join(', ')}
                  {' · Expires: '}{new Date(t.expires_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => handleDelete(t.id, t.name)} className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
