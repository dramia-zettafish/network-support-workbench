import { requireAuth } from '@/lib/auth/require-auth.js';
import CasesClient from './cases-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cases - EU Support', description: 'Read-only case list view' };

export default async function CasesPage() {
  await requireAuth();
  return (
    <main>
      <div className="mx-auto px-8"><CasesClient /></div>
    </main>
  );
}
