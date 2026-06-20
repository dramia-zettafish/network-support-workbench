import { requireAuth } from '@/lib/auth/require-auth.js';
import BulkOrdersClient from './bulk-orders-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bulk Orders - EU Support' };

export default async function BulkOrdersPage() {
  await requireAuth();
  return <main><div className="mx-auto px-8 py-8"><BulkOrdersClient /></div></main>;
}
