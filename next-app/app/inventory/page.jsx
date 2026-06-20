import { requireAuth } from '@/lib/auth/require-auth.js';
import InventoryClient from './inventory-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inventory - EU Support', description: 'Read-only inventory and parts catalog view' };

export default async function InventoryPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><InventoryClient /></div>
    </main>
  );
}
