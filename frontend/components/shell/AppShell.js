'use client';

import { useEffect, useState } from 'react';
import SidebarNavigation from './SidebarNavigation';
import styles from './AppShell.module.css';

const sidebarItems = [
  { id: 'networking', label: 'Networking', meta: 'Active' }
];

export default function AppShell({ children, activeWorkspace, onWorkspaceChange }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.dataset.theme = 'light';
      setTheme('light');
      return;
    }

    document.documentElement.removeAttribute('data-theme');
    setTheme('dark');
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    if (nextTheme === 'light') {
      document.documentElement.dataset.theme = 'light';
      window.localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      window.localStorage.setItem('theme', 'dark');
    }
    setTheme(nextTheme);
  }

  return (
    <div className={styles.shell}>
      <SidebarNavigation items={sidebarItems} activeItem={activeWorkspace} onChange={onWorkspaceChange} />
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p>End User Operations Network Team</p>
            <strong>Internal workflow control center</strong>
          </div>
          <button type="button" onClick={toggleTheme}>
            {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
