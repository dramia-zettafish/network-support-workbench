'use client';

import { useCallback, useEffect, useState } from 'react';

const ACTIVE_USER_ENDPOINT = '/api/system-metrics';
const USER_ACTIVE_HEARTBEAT_MS = 3 * 1000;
const USER_BACKGROUND_HEARTBEAT_MS = 30 * 1000;
const USER_CLIENT_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function currentUserState() {
  if (typeof document === 'undefined') return 'active';
  return document.visibilityState === 'hidden' ? 'background' : 'active';
}

function sendUserActivity(state) {
  const body = JSON.stringify({
    clientId: USER_CLIENT_ID,
    state,
    active: state !== 'closed',
  });

  if (state === 'closed' && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const payload = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(ACTIVE_USER_ENDPOINT, payload)) {
      return Promise.resolve();
    }
  }

  return fetch(ACTIVE_USER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
    keepalive: state === 'closed',
  }).catch(() => {});
}

export default function UserActivityHeartbeat() {
  const [pageVisible, setPageVisible] = useState(true);

  const markOpen = useCallback(() => {
    sendUserActivity(currentUserState());
  }, []);

  const markClosed = useCallback(() => {
    sendUserActivity('closed');
  }, []);

  useEffect(() => {
    markOpen();
    setPageVisible(currentUserState() === 'active');

    const handlePageClosed = () => markClosed();
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setPageVisible(visible);
      sendUserActivity(visible ? 'active' : 'background');
    };

    window.addEventListener('pagehide', handlePageClosed);
    window.addEventListener('beforeunload', handlePageClosed);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageClosed);
      window.removeEventListener('beforeunload', handlePageClosed);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      markClosed();
    };
  }, [markOpen, markClosed]);

  useEffect(() => {
    const timer = setInterval(
      markOpen,
      pageVisible ? USER_ACTIVE_HEARTBEAT_MS : USER_BACKGROUND_HEARTBEAT_MS
    );
    return () => clearInterval(timer);
  }, [markOpen, pageVisible]);

  return null;
}
