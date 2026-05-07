import PageHeader from '../ui/PageHeader';
import TicketsTab from '../TicketsTab';

export default function TicketsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Networking"
        title="Tickets"
        description="Create and manage network support tickets. This preserves the migrated ticket workflow and API integration."
      />
      <TicketsTab />
    </>
  );
}
