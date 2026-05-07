'use client';

import { useEffect, useState } from 'react';
import TicketsTab from '../components/TicketsTab';
import RmaTab from '../components/RmaTab';
import UpsTab from '../components/UpsTab';
import styles from './page.module.css';

const tabs = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'rma', label: 'RMA' },
  { id: 'ups', label: 'UPS' }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('tickets');
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
    <div className={styles.appShell}>
      <header className={styles.header}>
        <div>
          <h1>End User Operations Network Team</h1>
          <p>Network workflow tracker</p>
        </div>
        <button type="button" onClick={toggleTheme}>
          {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </header>

      <main className={styles.main}>
        <nav className={styles.tabbar} aria-label="Workflow tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={styles.tab}
              data-tab={tab.id}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className={styles.panel} aria-hidden={activeTab !== 'tickets'}>
          {activeTab === 'tickets' && <TicketsTab />}
        </section>
        <section className={styles.panel} aria-hidden={activeTab !== 'rma'}>
          {activeTab === 'rma' && <RmaTab />}
        </section>
        <section className={styles.panel} aria-hidden={activeTab !== 'ups'}>
          {activeTab === 'ups' && <UpsTab />}
        </section>
      </main>
    </div>
  );
}
