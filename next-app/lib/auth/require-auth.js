/**
 * requireAuth — server-side helper to enforce authentication.
 *
 * Use this in server components and API route handlers to gate access
 * behind authentication. If no user is resolved, it throws/redirects.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PATTERN:
 *   In a server component or API route:
 *     const user = await requireAuth();
 *     // If we reach here, user is guaranteed to be authenticated
 *
 * FUTURE: When Cisco Duo replaces mock auth, this function's behavior is
 * unchanged — only the underlying provider changes. The redirect target may
 * change to a Duo SSO login page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getCurrentUser } from './get-current-user.js';

/**
 * Ensures the current request has an authenticated user.
 * Throws an error with redirect info if unauthenticated.
 *
 * @param {Request|null} [request=null] - The incoming request
 * @returns {Promise<object>} The authenticated user object
 * @throws {{ unauthorized: true, redirectTo: string }} If not authenticated
 */
export async function requireAuth(request = null) {
  const user = await getCurrentUser(request);

  if (!user) {
    // FUTURE: When Duo is integrated, redirectTo will point to the Duo SSO
    // login URL instead of this placeholder path.
    const error = new Error('Authentication required');
    error.unauthorized = true;
    error.redirectTo = '/login'; // Placeholder — login page not yet built
    throw error;
  }

  return user;
}
