/**
 * Workspace configuration — maps teams and roles to navigation modules.
 * Centralized config for the dual-level navigation bar.
 */

export const TEAM_WORKSPACES = {
  computer_technicians: {
    label: 'Computer Technician',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  intake_administrators: {
    label: 'Intake Administrator',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  internal_support_technicians: {
    label: 'Internal Support Technician',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/employee-assets', label: 'Employee Assets' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  logistics_technicians: {
    label: 'Logistics Technician',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/logistics', label: 'Logistics' },
      { href: '/logistics/log', label: 'Logistics Log' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  network_technicians: {
    label: 'Network Technician',
    modules: [
      { href: '/network', label: 'Network' },
      { href: '/network/tickets', label: 'Tickets' },
      { href: '/network/ups', label: 'UPS' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  order_administrators: {
    label: 'Order Administrator',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  parts_administrators: {
    label: 'Parts Administrator',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/issue', label: 'Issue' },
      { href: '/checkin', label: 'Check In' },
      { href: '/inventory', label: 'Break/Fix Inventory' },
      { href: '/ledger', label: 'Ledger' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  quote_administrators: {
    label: 'Quote Administrator',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/bulk-orders', label: 'Bulk Orders' },
      { href: '/program-tracking', label: 'Program Tracking' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  rma_administrators: {
    label: 'RMA Administrator',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/alto-inventory', label: 'Alto Inventory' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  reporting_administrators: {
    label: 'Reporting Administrator',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/data-management', label: 'Data Management' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
  route_coordinators: {
    label: 'Route Coordinator',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/cases', label: 'Cases' },
      { href: '/route-coordination', label: 'Route Coordination' },
      { href: '/service-tags', label: 'Service Tags' },
      { href: '/runbook', label: 'Runbook' },
    ],
  },
};

export const ROLE_WORKSPACES = {
  supervisor: {
    label: 'Management',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/notifications', label: 'Notifications' },
      { href: '/management/cases', label: 'Cases' },
      { href: '/management/operations-insights', label: 'Operations Insights' },
      { href: '/management/message-center', label: 'Message Center' },
    ],
  },
  manager: {
    label: 'Management',
    modules: [
      { href: '/', label: 'Dashboard' },
      { href: '/notifications', label: 'Notifications' },
      { href: '/management/cases', label: 'Cases' },
      { href: '/management/operations-insights', label: 'Operations Insights' },
      { href: '/management/message-center', label: 'Message Center' },
      { href: '/system-monitoring', label: 'System Monitoring' },
      { href: '/admin', label: 'Admin' },
    ],
  },
};

/**
 * Build the list of available workspaces for a user.
 * @param {object} user - { role, teams: string[] }
 * @returns {{ key: string, label: string, modules: { href: string, label: string }[] }[]}
 */
export function getWorkspacesForUser(user) {
  if (!user) return [];
  const workspaces = [
    { key: 'my_workspace', label: 'My Workspace', modules: [{ href: '/my-workspace', label: 'My Cases' }] },
  ];

  // Add team workspaces the user belongs to
  const userTeams = user.teams || [];
  for (const teamKey of userTeams) {
    const ws = TEAM_WORKSPACES[teamKey];
    if (ws) workspaces.push({ key: teamKey, ...ws });
  }

  // Add management workspace if role qualifies
  const roleWs = ROLE_WORKSPACES[user.role];
  if (roleWs) {
    workspaces.push({ key: `role_${user.role}`, ...roleWs });
  }

  return workspaces;
}
