/**
 * Mock user data for local development.
 *
 * This file provides a simulated authenticated user so that developers can
 * build and test protected routes without a real authentication backend.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FUTURE: When Cisco Duo MFA integration replaces the temporary custom auth,
 * this mock will only be used in local dev/test environments. The real user
 * will come from the active auth provider (see providers/).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @typedef {Object} MockUser
 * @property {string} id - Unique user identifier
 * @property {string} username - Display username
 * @property {string} email - User email address
 * @property {string} role - User role (e.g., 'admin', 'technician', 'viewer')
 * @property {string[]} teams - Teams the user belongs to
 * @property {string[]} modules - Modules the user has access to
 */

/** Default mock user for development */
export const MOCK_USER = {
  id: 'dev-user-001',
  username: 'dev.user',
  email: 'dev.user@example.com',
  role: 'admin',
  teams: ['platform', 'support-ops'],
  modules: ['dashboard', 'inventory', 'rma', 'logistics', 'reports', 'admin'],
};

export const MOCK_PERSONAS = {
  ntech: {
    id: 'network-tech-001',
    username: 'NTech',
    email: 'ntech@example.com',
    role: 'technician',
    teams: ['network_technicians'],
    modules: ['dashboard'],
    timezone: 'America/Chicago',
  },
  'dev user': {
    id: 'dev-user-001',
    username: 'dev.user',
    email: 'dev.user@example.com',
    role: 'admin',
    teams: [
      'computer_technicians',
      'intake_administrators',
      'internal_support_technicians',
      'logistics_technicians',
      'network_technicians',
      'order_administrators',
      'parts_administrators',
      'quote_administrators',
      'rma_administrators',
      'reporting_administrators',
      'route_coordinators',
    ],
    modules: ['dashboard', 'inventory', 'rma', 'logistics', 'reports', 'admin'],
    timezone: 'America/Chicago',
  },
  'dev.user': {
    id: 'dev-user-001',
    username: 'dev.user',
    email: 'dev.user@example.com',
    role: 'admin',
    teams: [
      'computer_technicians',
      'intake_administrators',
      'internal_support_technicians',
      'logistics_technicians',
      'network_technicians',
      'order_administrators',
      'parts_administrators',
      'quote_administrators',
      'rma_administrators',
      'reporting_administrators',
      'route_coordinators',
    ],
    modules: ['dashboard', 'inventory', 'rma', 'logistics', 'reports', 'admin'],
    timezone: 'America/Chicago',
  },
};

/**
 * Returns the mock user for development.
 * In the future this could be extended to support multiple mock personas
 * for testing different permission levels.
 *
 * @returns {MockUser}
 */
export function getMockUser() {
  return { ...MOCK_USER };
}

export function getMockUserForUsername(username) {
  const key = String(username || '').trim().toLowerCase();
  const persona = MOCK_PERSONAS[key] || MOCK_USER;
  return cloneMockUser(persona);
}

export function getMockUserFromSession(session) {
  if (!session?.username) return getMockUser();
  const persona = getMockUserForUsername(session.username);
  return {
    ...persona,
    id: session.uid || persona.id,
    username: session.username || persona.username,
    role: session.role || persona.role,
    teams: Array.isArray(session.teams) ? session.teams : persona.teams,
  };
}

function cloneMockUser(user) {
  return {
    ...user,
    teams: [...(user.teams || [])],
    modules: [...(user.modules || [])],
  };
}
