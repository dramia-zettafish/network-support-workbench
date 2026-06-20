import { requireAuth } from '@/lib/auth/require-auth.js';
import LogisticsLogClient from './log-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logistics Log - EU Support' };

export default async function LogisticsLogPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><LogisticsLogClient /></div>
    </main>
  );
}
