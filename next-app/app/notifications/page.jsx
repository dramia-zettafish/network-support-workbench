import { requireAuth } from '@/lib/auth/require-auth.js';
import NotificationsClient from './notifications-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications - EU Support' };

export default async function NotificationsPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><NotificationsClient /></div>
    </main>
  );
}
