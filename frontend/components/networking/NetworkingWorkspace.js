'use client';

import { useState } from 'react';
import TabNavigation from '../ui/TabNavigation';
import OperationsPage from './OperationsPage';
import PlaceholderPage from './PlaceholderPage';
import RmaPage from './RmaPage';
import TicketsPage from './TicketsPage';
import UpsPage from './UpsPage';
import styles from './NetworkingWorkspace.module.css';

const tabs = [
  { id: 'operations', label: 'Operations' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'ups', label: 'UPS' },
  { id: 'rma', label: 'RMA' }
];

export default function NetworkingWorkspace() {
  const [activeTab, setActiveTab] = useState('operations');

  return (
    <section className={styles.workspace}>
      <TabNavigation tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Networking workflows" />
      <div className={styles.panel}>
        {activeTab === 'operations' && <OperationsPage onNavigate={setActiveTab} />}
        {activeTab === 'tickets' && <TicketsPage />}
        {activeTab === 'ups' && <UpsPage />}
        {activeTab === 'rma' && <RmaPage />}
      </div>
    </section>
  );
}
