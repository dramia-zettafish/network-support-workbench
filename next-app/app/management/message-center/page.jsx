'use client';
import { useState, useEffect } from 'react';
import FeedbackClient from '@/app/management/feedback/feedback-client.jsx';

export default function MessageCenterPage() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [target, setTarget] = useState('all');
  const [teamKey, setTeamKey] = useState('');
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetch('/api/message-center').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setUsers(d.users || []); setTeams(d.teams || []); }
    });
    loadHistory(0);
  }, []);

  function loadHistory(offset) {
    fetch(`/api/message-center?history=1&limit=${PAGE_SIZE}&offset=${offset}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setHistory(d.data || []); setHistoryTotal(d.total || 0); setHistoryOffset(offset); }
    });
  }

  async function handleSend(e) {
    e.preventDefault();
    setSending(true); setResult(null);
    const body = { message, target, attachments };
    if (target === 'team') body.team_key = teamKey;
    if (target === 'user') body.user_id = parseInt(userId);
    const res = await fetch('/api/message-center', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    setSending(false);
    if (res.ok) { setResult({ ok: true, count: d.recipients }); setMessage(''); setAttachments([]); loadHistory(0); }
    else setResult({ ok: false, error: d.error });
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setAttachments(prev => [...prev, { name: file.name, type: file.type, data: reader.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  const valid = message.trim() && (target === 'all' || (target === 'team' && teamKey) || (target === 'user' && userId));

  return (
    <div className="py-6 px-8 flex gap-6">
      {/* Left side - compose + feedback */}
      <div className="w-[70%] space-y-6">
      <form onSubmit={handleSend} className="rounded-lg p-6 space-y-5 self-start" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Send To</label>
          <div className="flex gap-2">
            {['all', 'team', 'user'].map(t => (
              <button key={t} type="button" onClick={() => setTarget(t)} className={`px-4 py-2 text-sm rounded ${target === t ? 'bg-blue-600 text-white' : ''}`} style={target !== t ? { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } : undefined}>
                {t === 'all' ? 'All Users' : t === 'team' ? 'Team' : 'User'}
              </button>
            ))}
          </div>
        </div>

        {target === 'team' && (
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Team</label>
            <select value={teamKey} onChange={e => setTeamKey(e.target.value)} className="w-full px-3 py-2 text-sm rounded" style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              <option value="">Select team...</option>
              {teams.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        )}

        {target === 'user' && (
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>User</label>
            <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full px-3 py-2 text-sm rounded" style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              <option value="">Select user...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="w-full px-3 py-2 text-sm rounded" style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} placeholder="Type your message..." />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Attachments</label>
          <input type="file" multiple onChange={handleFiles} className="text-sm" />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                  📎 {a.name}
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 ml-1">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={!valid || sending} className="px-6 py-2.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {sending ? 'Sending...' : 'Send Message'}
        </button>

        {result && (
          <div className={`text-sm ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
            {result.ok ? `Sent to ${result.count} recipient(s).` : result.error}
          </div>
        )}
      </form>

      <FeedbackClient />
      </div>

      {/* Sent messages - right side */}
      <div className="w-[30%] shrink-0 rounded-lg p-4 self-start max-h-[calc(100vh-140px)] overflow-y-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Sent Messages</h3>
        {history.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No sent messages.</p>
        ) : (
          <>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="p-2.5 rounded" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[0.7rem] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{h.sent_by_name}</span>
                    <span className="text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>{h.recipient_count} recip.</span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-primary)' }}>{h.message}</p>
                  <span className="text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
            {historyTotal > PAGE_SIZE && (
              <div className="flex gap-2 mt-3 items-center justify-center">
                <button disabled={historyOffset === 0} onClick={() => loadHistory(historyOffset - PAGE_SIZE)} className="px-2 py-0.5 text-xs rounded border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Prev</button>
                <span className="text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>{historyOffset + 1}–{Math.min(historyOffset + PAGE_SIZE, historyTotal)} of {historyTotal}</span>
                <button disabled={historyOffset + PAGE_SIZE >= historyTotal} onClick={() => loadHistory(historyOffset + PAGE_SIZE)} className="px-2 py-0.5 text-xs rounded border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
