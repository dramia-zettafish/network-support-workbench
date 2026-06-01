'use client';

import { useState } from 'react';
import TabNavigation from '../ui/TabNavigation';
import OperationsPage from './OperationsPage';
import TicketsPage from './TicketsPage';
import UpsPage from './UpsPage';
import NocResponsesPage from './NocResponsesPage';
import styles from './NetworkingWorkspace.module.css';

const tabs = [
  { id: 'operations', label: 'Dashboard' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'ups', label: 'UPS' },
  { id: 'noc-responses', label: 'NOC Responses' }
];

export default function NetworkingWorkspace() {
  const [activeTab, setActiveTab] = useState('operations');
  const [navigationContext, setNavigationContext] = useState(null);

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    setNavigationContext(null);
  }

  function handleNavigate(tabId, context = null) {
    setActiveTab(tabId);
    setNavigationContext(context);
  }

  return (
    <section className={styles.workspace}>
      <TabNavigation tabs={tabs} activeTab={activeTab} onChange={handleTabChange} label="Networking workflows" />
      <div className={styles.panel}>
        {activeTab === 'operations' && <OperationsPage onNavigate={handleNavigate} />}
        {activeTab === 'tickets' && <TicketsPage onNavigate={handleNavigate} navigationContext={navigationContext} />}
        {activeTab === 'ups' && <UpsPage onNavigate={handleNavigate} />}
        {activeTab === 'noc-responses' && <NocResponsesPage />}
      </div>
    </section>
  );
}
