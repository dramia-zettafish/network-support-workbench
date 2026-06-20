/**
 * getAllowedModules — determines which application modules a user can access.
 *
 * Modules are feature areas of the application (e.g., 'dashboard', 'inventory',
 * 'rma', 'logistics', 'reports', 'admin'). This helper returns the list of
 * modules the current user is permitted to use.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN NOTE:
 * Module access is derived from the user object's `modules` array. This is an
 * authorization concept independent of the auth provider. The user object
 * carries module permissions regardless of whether it came from mock, Duo, or
 * a future source.
 *
 * FUTURE: Module access rules may become more sophisticated (e.g., read-only
 * vs read-write per module, or time-based access). The interface will expand
 * while remaining backward-compatible.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getCurrentUser } from './get-current-user.js';

/**
 * All known application modules. Used for validation and UI navigation.
 */
export const ALL_MODULES = [
  'dashboard',
  'inventory',
  'rma',
  'logistics',
  'reports',
  'admin',
];

/**
 * Returns the list of modules the current user is allowed to access.
 *
 * @param {Request|null} [request=null] - The incoming request
 * @returns {Promise<string[]>} Array of allowed module identifiers
 */
export async function getAllowedModules(request = null) {
  const user = await getCurrentUser(request);

  if (!user) {
    return [];
  }

  // Return only modules that are both in the user's list and recognized
  const userModules = user.modules || [];
  return userModules.filter((mod) => ALL_MODULES.includes(mod));
}

/**
 * Checks if the current user has access to a specific module.
 *
 * @param {string} moduleName - Module to check
 * @param {Request|null} [request=null] - The incoming request
 * @returns {Promise<boolean>}
 */
export async function hasModuleAccess(moduleName, request = null) {
  const allowed = await getAllowedModules(request);
  return allowed.includes(moduleName);
}
