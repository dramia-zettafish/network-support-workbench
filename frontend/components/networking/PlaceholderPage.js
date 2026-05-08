import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';

export default function PlaceholderPage({ title, description }) {
  return (
    <>
      <PageHeader eyebrow="Networking" title={title} description={description} />
      <SectionCard>
        <EmptyState title={`${title} workspace coming soon`} description="Workflow logic will be rebuilt after the app shell and shared UI system are stable." />
      </SectionCard>
    </>
  );
}
