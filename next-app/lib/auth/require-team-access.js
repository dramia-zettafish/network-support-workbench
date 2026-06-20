/**
 * requireTeamAccess — server-side helper to enforce team-based access.
 *
 * Use this to restrict pages/API routes to users who belong to a specific
 * team or set of teams.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN NOTE:
 * Teams represent organizational units (e.g., 'platform', 'support-ops',
 * 'logistics'). A user can belong to multiple teams. Team membership is an
 * authorization concept separate from authentication — it doesn't matter
 * HOW the user logged in, only WHICH teams they belong to.
 *
 * FUTURE: Team membership may be derived from Duo group mappings or from an
 * internal team-management service. The interface remains the same.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { requireAuth } from './require-auth.js';

/**
 * Ensures the authenticated user belongs to at least one of the required teams.
 *
 * @param {string|string[]} requiredTeams - Team(s) that grant access
 * @param {Request|null} [request=null] - The incoming request
 * @returns {Promise<object>} The authenticated user if team check passes
 * @throws {{ forbidden: true, requiredTeams: string[] }} If user not in any required team
 */
export async function requireTeamAccess(requiredTeams, request = null) {
  const user = await requireAuth(request);

  const teams = Array.isArray(requiredTeams) ? requiredTeams : [requiredTeams];
  const userTeams = user.teams || [];

  const hasAccess = teams.some((team) => userTeams.includes(team));

  if (!hasAccess) {
    const error = new Error(
      `Forbidden: user teams [${userTeams.join(', ')}] do not include any of [${teams.join(', ')}]`
    );
    error.forbidden = true;
    error.requiredTeams = teams;
    throw error;
  }

  return user;
}
