import { requireAuth } from '@/lib/auth/require-auth.js';
import CheckInClient from './checkin-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check In - EU Support' };

export default async function CheckInPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><CheckInClient /></div>
    </main>
  );
}
