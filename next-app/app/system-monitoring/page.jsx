import { requireRole } from '@/lib/auth/require-role.js';
import SystemMonitoringClient from './system-monitoring-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System Monitoring - EU Support' };

export default async function SystemMonitoringPage() {
  await requireRole(['manager', 'admin']);

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        <SystemMonitoringClient />
      </div>
    </main>
  );
}
