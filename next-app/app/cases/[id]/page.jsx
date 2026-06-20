import { requireAuth } from '@/lib/auth/require-auth.js';
import CaseDetailClient from './case-detail-client.jsx';

export const metadata = { title: 'Case Detail - EU Support', description: 'Read-only case detail view' };

export default async function CaseDetailPage({ params }) {
  await requireAuth();
  const { id } = await params;
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><CaseDetailClient id={id} /></div>
    </main>
  );
}
