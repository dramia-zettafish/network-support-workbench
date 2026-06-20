'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWorkspace } from '@/app/components/workspace-provider.jsx';

function processListFromResponse(data) {
  return Array.isArray(data) ? data : data?.data || [];
}

export default function RunbookClient() {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeWorkspace } = useWorkspace();

  useEffect(() => {
    setLoading(true);
    const url = activeWorkspace
      ? `/api/runbook/processes?team=${encodeURIComponent(activeWorkspace)}`
      : '/api/runbook/processes';
    fetch(url)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setProcesses(processListFromResponse(d)))
      .finally(() => setLoading(false));
  }, [activeWorkspace]);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  if (processes.length === 0) return <div className="text-center py-8 text-gray-500">No process flows available</div>;

  return (
    <div className="py-8">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {processes.map((p) => (
          <Link key={p.id} href={`/runbook/${p.id}`} className="no-underline text-inherit">
            <div className="rounded-lg p-6 cursor-pointer transition-shadow hover:shadow-md" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <div className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{p.title}</div>
              <p className="text-sm my-2" style={{ color: 'var(--color-text-muted)' }}>{p.description}</p>
              {p.usedWhen && <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>Used when: {p.usedWhen}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
