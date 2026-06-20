'use client';

import { useEffect, useState } from 'react';

export function useNetworkWriteSafety() {
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/write-safety/status', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => {
        if (cancelled) return;
        setWritesEnabled(status?.enabled === true || status?.writesEnabled === true);
      })
      .catch(() => {
        if (!cancelled) setWritesEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loaded,
    writesEnabled,
    writeDisabled: loaded && !writesEnabled,
  };
}

export function WriteDisabledNotice() {
  return (
    <div className="cardSurface" role="status">
      <strong>Write operations are disabled.</strong>
      <p className="mutedText">
        Network Workbench is in read-only mode. Create, update, delete, schedule,
        and rollback actions are unavailable until writes are enabled.
      </p>
    </div>
  );
}
