/**
 * Legacy database authentication provider — interim production auth.
 *
 * Authenticates against the existing auth_users table using bcrypt password
 * hashes. Resolves user identity from session cookies.
 *
 * This provider is temporary and will be replaced by Cisco Duo MFA.
 */

import 'server-only';
import { query } from '@/lib/db.js';
import bcrypt from 'bcryptjs';
import { getSession, getSessionFromCookieHeader } from '../session.js';

/**
 * Authenticate a user by username and password.
 * @returns {object|null} User object if valid, null otherwise.
 */
export async function authenticate(username, password) {
  if (!username || !password) return null;

  const rows = await query(
    'SELECT id, username, password_hash, role, is_active FROM auth_users WHERE username = $1',
    [username]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.is_active !== 1) return null;

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;

  // Resolve effective role from users table (matches main branch _role_from_db)
  const effectiveRole = await resolveEffectiveRole(row.username, row.role);

  // Resolve user ID and teams from the business users table
  const { userId, teams, timezone } = await resolveUserIdAndTeams(row.username, row.id);

  return {
    id: userId,
    username: row.username,
    role: effectiveRole,
    teams,
    timezone,
    modules: deriveModules(effectiveRole),
  };
}

/**
 * Resolve the current user from request session cookie.
 */
export async function resolveUser(request = null) {
  let session = null;

  if (request) {
    const cookieHeader = request.headers?.get?.('cookie') || '';
    session = getSessionFromCookieHeader(cookieHeader);
  } else {
    session = await getSession();
  }

  if (!session) return null;

  // Look up by username (session.uid comes from users table, not auth_users,
  // so IDs may not match between tables)
  const rows = await query(
    'SELECT id, username, role, is_active FROM auth_users WHERE username = $1',
    [session.username]
  );

  if (rows.length === 0 || rows[0].is_active !== 1) return null;

  const row = rows[0];

  // Resolve effective role from users table (matches main branch _role_from_db)
  const effectiveRole = await resolveEffectiveRole(row.username, row.role);

  // Resolve user ID and teams from the business users table
  const { userId, teams, timezone } = await resolveUserIdAndTeams(row.username, row.id);

  return {
    id: userId,
    username: row.username,
    role: effectiveRole,
    teams,
    timezone,
    modules: deriveModules(effectiveRole),
  };
}

/**
 * Resolve effective role: check users table first (by upn or username), fall back to auth_users role.
 * This matches the main branch's _role_from_db behavior.
 */
async function resolveEffectiveRole(username, fallbackRole) {
  try {
    // The users table may use 'upn' or 'username' column
    let rows = await query('SELECT role FROM users WHERE upn = $1 LIMIT 1', [username]);
    if (rows.length === 0) {
      rows = await query('SELECT role FROM users WHERE username = $1 LIMIT 1', [username]).catch(() => []);
    }
    if (rows.length > 0 && rows[0].role) {
      return rows[0].role;
    }
  } catch {
    // users table may not have the expected columns
  }
  return fallbackRole;
}

/**
 * Resolve the business user ID, team memberships, and timezone from the users table.
 */
async function resolveUserIdAndTeams(username, authUserId) {
  let userId = authUserId;
  let timezone = 'America/Chicago';
  try {
    let userRows = await query('SELECT id, timezone FROM users WHERE upn = $1 LIMIT 1', [username]);
    if (userRows.length === 0) {
      userRows = await query('SELECT id, timezone FROM users WHERE username = $1 LIMIT 1', [username]).catch(() => []);
    }
    if (userRows.length > 0) {
      userId = userRows[0].id;
      if (userRows[0].timezone) timezone = userRows[0].timezone;
    }
  } catch {
    // fall back to auth_users id
  }

  let teams = [];
  try {
    const teamRows = await query(
      `SELECT t.key FROM user_teams ut JOIN teams t ON t.id = ut.team_id WHERE ut.user_id = $1`,
      [userId]
    );
    teams = teamRows.map((t) => t.key);
  } catch {
    // teams may not be set up
  }

  return { userId, teams, timezone };
}

export async function isProviderReady() {
  try {
    const rows = await query('SELECT 1 FROM auth_users LIMIT 1');
    return rows.length > 0;
  } catch {
    return false;
  }
}

export const providerInfo = {
  name: 'legacy',
  description: 'Legacy database provider — bcrypt password auth against auth_users table',
  temporary: true,
};

/** Derive module access from role. */
function deriveModules(role) {
  switch (role) {
    case 'manager':
      return ['dashboard', 'inventory', 'rma', 'logistics', 'reports', 'admin'];
    case 'supervisor':
      return ['dashboard', 'inventory', 'rma', 'logistics', 'reports', 'admin'];
    case 'admin':
      return ['dashboard', 'inventory', 'rma', 'logistics', 'reports'];
    case 'technician':
    case 'tech':
      return ['dashboard', 'inventory', 'rma', 'logistics'];
    default:
      return ['dashboard'];
  }
}
