import { requireRole } from '@/lib/auth/require-role.js';
import AdminClient from './admin-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin - EU Support' };

export default async function AdminPage() {
  await requireRole(['manager']);
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><AdminClient /></div>
    </main>
  );
}
