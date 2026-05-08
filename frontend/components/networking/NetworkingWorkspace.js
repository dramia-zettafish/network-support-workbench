'use client';

import { useState } from 'react';
import TabNavigation from '../ui/TabNavigation';
import OperationsPage from './OperationsPage';
import TicketsPage from './TicketsPage';
import UpsPage from './UpsPage';
import styles from './NetworkingWorkspace.module.css';

const tabs = [
  { id: 'operations', label: 'Operations' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'ups', label: 'UPS' }
];

export default function NetworkingWorkspace() {
  const [activeTab, setActiveTab] = useState('operations');

  return (
    <section className={styles.workspace}>
      <TabNavigation tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Networking workflows" />
      <div className={styles.panel}>
        {activeTab === 'operations' && <OperationsPage onNavigate={setActiveTab} />}
        {activeTab === 'tickets' && <TicketsPage onNavigate={setActiveTab} />}
        {activeTab === 'ups' && <UpsPage onNavigate={setActiveTab} />}
      </div>
    </section>
  );
}
