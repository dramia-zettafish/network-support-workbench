/**
 * requireRole — server-side helper to enforce role-based access.
 *
 * Use this after authentication to ensure the user holds a specific role
 * (e.g., 'admin', 'technician', 'viewer').
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN NOTE:
 * Roles are an application-level authorization concept, independent of the
 * authentication provider. Whether the user authenticates via mock, Duo, or
 * any future method, role checks work the same way based on the user object's
 * `role` field.
 *
 * FUTURE: Role definitions may be expanded or loaded from a configuration
 * source. The role hierarchy and mapping from Duo groups → app roles will be
 * defined during Duo integration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { requireAuth } from './require-auth.js';

/**
 * Known roles in priority order (highest to lowest).
 * Used for hierarchy checks if needed in the future.
 */
export const ROLES = ['admin', 'manager', 'technician', 'viewer'];

/**
 * Ensures the authenticated user holds one of the required roles.
 *
 * @param {string|string[]} allowedRoles - Role(s) that are permitted
 * @param {Request|null} [request=null] - The incoming request
 * @returns {Promise<object>} The authenticated user if role check passes
 * @throws {{ forbidden: true, requiredRoles: string[] }} If role not matched
 */
export async function requireRole(allowedRoles, request = null) {
  const user = await requireAuth(request);

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    const error = new Error(
      `Forbidden: role "${user.role}" is not in allowed roles [${roles.join(', ')}]`
    );
    error.forbidden = true;
    error.requiredRoles = roles;
    throw error;
  }

  return user;
}
