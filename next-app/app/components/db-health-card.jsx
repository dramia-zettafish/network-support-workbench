'use client';

import { useState, useEffect } from 'react';

/**
 * DbHealthCard — Displays live database connectivity status.
 *
 * Fetches GET /api/db-health on mount and shows a green/red indicator.
 * Strictly read-only — no writes, no mutations.
 */
export default function DbHealthCard() {
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      setLoading(true);
      try {
        const res = await fetch('/api/db-health');
        const data = await res.json();
        if (!cancelled) {
          setStatus(data.status === 'ok' ? 'ok' : 'error');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkHealth();
    return () => { cancelled = true; };
  }, []);

  const dotColor = loading || status === null
    ? 'bg-gray-400'
    : status === 'ok' ? 'bg-green-500' : 'bg-red-500';

  const label = loading ? 'Checking...' : status === 'ok' ? 'Connected' : 'Disconnected';

  return (
    <div className="flex flex-col rounded-lg p-6" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
      <span className="text-3xl mb-3">🗄️</span>
      <span className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Database Health</span>
      <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        PostgreSQL connectivity status
      </span>
      <div className="flex items-center gap-2 mt-3">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className={`text-sm font-medium ${loading ? 'italic' : ''}`} style={{ color: loading ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}
