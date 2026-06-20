'use client';

import Link from 'next/link';
import { useWorkspace } from './workspace-provider.jsx';
import { TEAM_WORKSPACES, ROLE_WORKSPACES } from '@/lib/workspace-config.js';

const MODULE_META = {
  '/cases': { icon: '📋', label: 'Cases', description: 'Case management and tracking. View case details, status, and activity.' },
  '/inventory': { icon: '📦', label: 'Inventory', description: 'Parts catalog and stock levels. View on-hand quantities and warehouse locations.' },
  '/issue': { icon: '🏷️', label: 'Issue', description: 'Check out parts from inventory to work orders.' },
  '/checkin': { icon: '📥', label: 'Check In', description: 'Receive and return parts to inventory.' },
  '/ledger': { icon: '📒', label: 'Ledger', description: 'Audit trail of all inventory transactions.' },
  '/logistics': { icon: '🚚', label: 'Logistics', description: 'Technician sub-status updates for logistics work orders.' },
  '/logistics/log': { icon: '📜', label: 'Logistics Log', description: 'Activity history for logistics operations.' },
  '/route-coordination': { icon: '🗺️', label: 'Route Coordination', description: 'Upload and manage logistics workbooks.' },
  '/service-tags': { icon: '🏷️', label: 'Service Tags', description: 'Generate and print Avery service tag labels for pickup scheduled cases.' },
  '/data-management': { icon: '📊', label: 'Data Management', description: 'Download compiled workbooks and reports.' },
  '/employee-assets': { icon: '💻', label: 'Employee Assets', description: 'Track and manage employee-assigned assets and equipment.' },
  '/runbook': { icon: '📖', label: 'Runbook', description: 'Process flow diagrams and operational procedures.' },
  '/notifications': { icon: '🔔', label: 'Notifications', description: 'Pending approval requests and alerts.' },
  '/management/cases': { icon: '📋', label: 'Cases', description: 'All cases across teams. Monitor workflow progress and assignments.' },
  '/management/operations-insights': { icon: '📊', label: 'Operations Insights', description: 'Operational metrics, trends, and team performance analytics.' },
  '/management/feedback': { icon: '💬', label: 'Feedback', description: 'Review and respond to system feedback from team members.' },
  '/management/message-center': { icon: '📨', label: 'Message Center', description: 'Send messages to individual users, teams, or all users.' },
  '/admin': { icon: '⚙️', label: 'Admin', description: 'User management, inventory tools, and system configuration.' },
  '/system-monitoring': { icon: '📡', label: 'System Monitoring', description: 'System health and performance metrics.' },
  '/bulk-orders': { icon: '📦', label: 'Bulk Orders', description: 'Manage and track bulk order requests and fulfillment.' },
  '/alto-inventory': { icon: '🔧', label: 'Alto Inventory', description: 'Track Alto device inventory and RMA replacement stock.' },
  '/program-tracking': { icon: '📈', label: 'Program Tracking', description: 'Track program milestones, quotes, and order status.' },
};

export default function DashboardModules() {
  const { activeWorkspace } = useWorkspace();

  const ws = TEAM_WORKSPACES[activeWorkspace] || ROLE_WORKSPACES[activeWorkspace?.replace('role_', '')];
  const modules = ws?.modules?.filter((m) => m.href !== '/') || [];

  if (!modules.length) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 mt-6">
      {modules.map((mod) => {
        const meta = MODULE_META[mod.href] || { icon: '📄', label: mod.label, description: '' };
        return (
          <Link key={mod.href} href={mod.href} className="flex flex-col rounded-lg p-6 transition-all hover:border-blue-600 hover:shadow-[0_4px_12px_rgba(0,102,204,0.1)] no-underline" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', color: 'inherit' }}>
            <span className="text-3xl mb-3">{meta.icon}</span>
            <span className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{meta.label}</span>
            <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{meta.description}</span>
          </Link>
        );
      })}
    </div>
  );
}
