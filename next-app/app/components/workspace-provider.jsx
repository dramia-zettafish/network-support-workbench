'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const WorkspaceContext = createContext({ activeWorkspace: null, setActiveWorkspace: () => {}, loaded: false, timezone: 'America/Chicago', setTimezone: () => {} });

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export default function WorkspaceProvider({ children }) {
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [timezone, setTimezone] = useState('America/Chicago');

  useEffect(() => {
    const saved = localStorage.getItem('eus_workspace');
    if (saved) setActiveWorkspace(saved);
    setLoaded(true);
  }, []);

  function setWorkspace(ws) { setActiveWorkspace(ws); localStorage.setItem('eus_workspace', ws || ''); }

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, setActiveWorkspace: setWorkspace, loaded, timezone, setTimezone }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
