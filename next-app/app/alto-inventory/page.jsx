import { requireAuth } from '@/lib/auth/require-auth.js';
import AltoInventoryClient from './alto-inventory-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Alto Inventory - EU Support', description: 'Alto device inventory tracking' };

export default async function AltoInventoryPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8"><AltoInventoryClient /></div>
    </main>
  );
}
