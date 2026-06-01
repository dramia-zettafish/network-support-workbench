'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '../ui/PageHeader';
import TicketsTab from '../TicketsTab';
import { moduleHref } from '../../lib/networkRoutes';

export default function NocResponsesPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        eyebrow="Networking"
        title="NOC Responses"
        description="Prepare device replacement responses from the open network ticket queue."
        actions={
          <button type="button" className="secondaryButton" onClick={() => router.push(moduleHref('tickets'))}>
            Tickets
          </button>
        }
      />
      <TicketsTab showCreate={false} />
    </>
  );
}
