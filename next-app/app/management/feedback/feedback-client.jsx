'use client';
import { useState, useEffect } from 'react';
import { useTimezone } from '@/lib/format-date.js';

const CATEGORY_COLORS = {
  'Bug Report': 'text-red-700 bg-red-50',
  'Feature Request': 'text-purple-700 bg-purple-50',
  'Workflow Improvement': 'text-blue-700 bg-blue-50',
  'Access/Permissions Request': 'text-amber-700 bg-amber-50',
  'Reporting/Dashboard Request': 'text-teal-700 bg-teal-50',
  'Training/Documentation Request': 'text-indigo-700 bg-indigo-50',
  'General Questions': 'text-gray-700 bg-gray-100',
};

export default function FeedbackClient() {
  const { fmt } = useTimezone();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetch('/api/system-feedback').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setFeedback(d.data); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? feedback : filter === 'pending' ? feedback.filter(f => !f.reply) : feedback.filter(f => f.category === filter);
  const pendingCount = feedback.filter(f => !f.reply).length;

  return (
    <div className="py-6">
      <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>System Feedback</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('pending')} className={`px-3 py-1 text-xs rounded ${filter === 'pending' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Pending ({pendingCount})</button>
        <button onClick={() => setFilter('all')} className={`px-3 py-1 text-xs rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>All</button>
        {[...new Set(feedback.map(f => f.category))].sort().map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1 text-xs rounded ${filter === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{c}</button>
        ))}
      </div>

      {loading ? <p className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>Loading...</p> : filtered.length === 0 ? <p className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>No feedback found.</p> : (
        <div className="space-y-3">
          {filtered.map(fb => {
            const attachments = typeof fb.attachments === 'string' ? JSON.parse(fb.attachments || '[]') : (fb.attachments || []);
            const catCls = CATEGORY_COLORS[fb.category] || 'text-gray-700 bg-gray-100';
            return (
              <div key={fb.id} className="p-4 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${catCls}`}>{fb.category}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmt(fb.created_at)}</span>
                </div>
                <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>From: <strong style={{ color: 'var(--color-text-primary)' }}>{fb.username}</strong></p>
                <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>{fb.message}</p>
                {attachments.length > 0 && <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>📎 {attachments.map(a => a.name).join(', ')}</p>}
                {fb.reply ? (
                  <div className="mt-3 p-3 rounded" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Reply from {fb.replied_by_name} — {fmt(fb.replied_at)}</span>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-primary)' }}>{fb.reply}</p>
                  </div>
                ) : (
                  <div className="mt-2">
                    {replyTarget === fb.id ? (
                      <div className="flex gap-2">
                        <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type reply..." className="flex-1 px-3 py-1.5 border rounded text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-input-bg)', color: 'var(--color-text-primary)' }} />
                        <button disabled={!replyText.trim() || replySubmitting} onClick={async () => {
                          setReplySubmitting(true);
                          const res = await fetch('/api/system-feedback', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: fb.id, reply: replyText }) });
                          if (res.ok) { setFeedback(prev => prev.map(f => f.id === fb.id ? { ...f, reply: replyText, replied_by_name: 'You', replied_at: new Date().toISOString() } : f)); setReplyTarget(null); setReplyText(''); }
                          setReplySubmitting(false);
                        }} className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{replySubmitting ? '...' : 'Send Reply'}</button>
                        <button onClick={() => { setReplyTarget(null); setReplyText(''); }} className="px-2 py-1.5 text-xs rounded" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-3 items-center">
                        <button onClick={() => { setReplyTarget(fb.id); setReplyText(''); }} className="text-xs font-semibold text-blue-600 hover:underline">Reply</button>
                        {!fb.is_read && <button onClick={async () => { const res = await fetch('/api/system-feedback', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: fb.id }) }); if (res.ok) setFeedback(prev => prev.map(f => f.id === fb.id ? { ...f, is_read: true } : f)); }} className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline">Mark Read</button>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
