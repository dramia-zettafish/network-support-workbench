import { requireAuth } from '@/lib/auth/require-auth.js';
import LedgerClient from './ledger-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ledger - EU Support' };

export default async function LedgerPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><LedgerClient /></div>
    </main>
  );
}
