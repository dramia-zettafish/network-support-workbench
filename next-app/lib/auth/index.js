/**
 * Auth boundary — centralized exports for authentication and authorization.
 *
 * Import from '@/lib/auth' to access all auth helpers:
 *
 *   import {
 *     getCurrentUser,
 *     requireAuth,
 *     requireRole,
 *     requireTeamAccess,
 *     getAllowedModules,
 *     hasModuleAccess,
 *     ROLES,
 *     ALL_MODULES,
 *   } from '@/lib/auth';
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE:
 *
 * Authentication (WHO you are) is handled by pluggable providers:
 *   - providers/mock-provider.js   → Local development (default)
 *   - providers/future-duo-provider.js → Cisco Duo MFA (not yet implemented)
 *
 * Authorization (WHAT you can do) is handled by application-level helpers:
 *   - requireRole()       → Role-based gating
 *   - requireTeamAccess() → Team-based gating
 *   - getAllowedModules()  → Module-level permissions
 *
 * These two concerns are deliberately separated so that swapping the auth
 * provider (e.g., mock → Duo) does not require changes to authorization logic.
 *
 * FUTURE: The existing Python/FastAPI custom auth (username/password/JWT/MFA)
 * is temporary. It will be replaced entirely by Cisco Duo. This boundary is
 * designed for that transition — it does NOT integrate with the legacy auth.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export { getCurrentUser } from './get-current-user.js';
export { requireAuth } from './require-auth.js';
export { requireRole, ROLES } from './require-role.js';
export { requireTeamAccess } from './require-team-access.js';
export { getAllowedModules, hasModuleAccess, ALL_MODULES } from './allowed-modules.js';
export { getSession, createSession, destroySession } from './session.js';
