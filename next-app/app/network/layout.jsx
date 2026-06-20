import { requireTeamAccess } from '@/lib/auth/require-team-access.js';
import { ToastProvider } from '@/network-workbench/components/ui/ToastProvider';

export const metadata = {
  title: 'Network Workbench - EU Support',
};

export const dynamic = 'force-dynamic';

export default async function NetworkLayout({ children }) {
  await requireTeamAccess('network_technicians');

  return (
    <div className="networkWorkbench">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
