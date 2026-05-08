'use client';

import { useState } from 'react';
import AppShell from '../components/shell/AppShell';
import NetworkingWorkspace from '../components/networking/NetworkingWorkspace';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

const workspaceCopy = {
  dashboard: {
    title: 'Dashboard',
    description: 'A future operations landing page for cross-workspace health and daily priorities.'
  },
  inventory: {
    title: 'Inventory',
    description: 'Placeholder for inventory visibility and device lookup workflows.'
  },
  reports: {
    title: 'Reports',
    description: 'Placeholder for operational exports and recurring reporting views.'
  },
  settings: {
    title: 'Settings',
    description: 'Placeholder for user preferences and workspace configuration.'
  }
};

function PlaceholderWorkspace({ workspace }) {
  const copy = workspaceCopy[workspace] || workspaceCopy.dashboard;

  return (
    <>
      <PageHeader eyebrow="Workspace" title={copy.title} description={copy.description} />
      <SectionCard>
        <EmptyState title={`${copy.title} coming soon`} description="This shell is ready for future workspace content." />
      </SectionCard>
    </>
  );
}

export default function Home() {
  const [activeWorkspace, setActiveWorkspace] = useState('networking');

  return (
    <AppShell activeWorkspace={activeWorkspace} onWorkspaceChange={setActiveWorkspace}>
      {activeWorkspace === 'networking' ? (
        <NetworkingWorkspace />
      ) : (
        <PlaceholderWorkspace workspace={activeWorkspace} />
      )}
    </AppShell>
  );
}
