import { requireAuth } from '@/lib/auth/require-auth.js';
import IssueClient from './issue-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Issue - EU Support' };

export default async function IssuePage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><IssueClient /></div>
    </main>
  );
}
