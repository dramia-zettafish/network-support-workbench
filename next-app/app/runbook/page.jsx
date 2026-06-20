import { requireAuth } from '@/lib/auth/require-auth.js';
import RunbookClient from './runbook-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operations Runbook - EU Support' };

export default async function RunbookPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><RunbookClient /></div>
    </main>
  );
}
