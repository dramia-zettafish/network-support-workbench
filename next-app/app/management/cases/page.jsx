import { requireAuth } from '@/lib/auth/require-auth.js';
import ManagementCasesClient from './management-cases-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'All Cases - Management' };

export default async function ManagementCasesPage() {
  await requireAuth();
  return (
    <main>
      <div className="mx-auto px-8"><ManagementCasesClient /></div>
    </main>
  );
}
