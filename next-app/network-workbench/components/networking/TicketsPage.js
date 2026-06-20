'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '../ui/PageHeader';
import TicketsTab from '../TicketsTab';
import { moduleHref } from '../../lib/networkRoutes';

export default function TicketsPage({ onNavigate, navigationContext }) {
  const router = useRouter();
  const [initialTicketNumber, setInitialTicketNumber] = useState(null);

  useEffect(() => {
    setInitialTicketNumber(new URLSearchParams(window.location.search).get('ticket'));
  }, []);

  function handleDashboardClick() {
    if (onNavigate) {
      onNavigate('operations');
      return;
    }
    router.push(moduleHref('dashboard'));
  }

  return (
    <>
      <PageHeader
        eyebrow="Networking"
        title="Tickets"
        description="Create and manage network support tickets. This preserves the migrated ticket workflow and API integration."
        actions={<button type="button" className="secondaryButton" onClick={handleDashboardClick}>Dashboard</button>}
      />
      <TicketsTab initialOpenTicket={navigationContext?.openTicket || null} initialOpenTicketNumber={initialTicketNumber} />
    </>
  );
}
