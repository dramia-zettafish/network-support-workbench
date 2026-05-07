'use client';

import { useState } from 'react';
import TabNavigation from '../ui/TabNavigation';
import OperationsPage from './OperationsPage';
import PlaceholderPage from './PlaceholderPage';
import TicketsPage from './TicketsPage';
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
        {activeTab === 'ups' && (
          <PlaceholderPage
            title="UPS"
            description="UPS intake, scheduling, warehouse email, and fulfillment workflows will be rebuilt here after the shell is stable."
          />
        )}
        {activeTab === 'rma' && (
          <PlaceholderPage
            title="RMA"
            description="RMA tracking will return here after the shared workspace patterns are finished."
          />
        )}
      </div>
    </section>
  );
}
