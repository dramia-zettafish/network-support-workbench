import { requireAuth } from '@/lib/auth/require-auth.js';
import EmployeeAssetsClient from './employee-assets-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Employee Assets - EU Support' };

export default async function EmployeeAssetsPage() {
  await requireAuth();
  return (
    <main>
      <div className="max-w-[1400px] mx-auto px-8"><EmployeeAssetsClient /></div>
    </main>
  );
}
