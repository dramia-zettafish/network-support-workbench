import { requireAuth } from '@/lib/auth/require-auth.js';
import RunbookDetailClient from './detail-client.jsx';

export const dynamic = 'force-dynamic';

export default async function RunbookDetailPage({ params }) {
  await requireAuth();
  return (
    <main>
      <RunbookDetailClient processId={params.id} />
    </main>
  );
}
