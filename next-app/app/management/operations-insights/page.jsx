import { requireAuth } from '@/lib/auth/require-auth.js';
import OperationsInsightsClient from './operations-insights-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operations Insights - Management' };

export default async function OperationsInsightsPage() {
  await requireAuth();
  return (
    <main>
      <div className="mx-auto px-8"><OperationsInsightsClient /></div>
    </main>
  );
}
