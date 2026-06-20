/**
 * getCurrentUser — resolves the authenticated user from the active provider.
 *
 * AUTH PROVIDER STRATEGY:
 *   - "mock"   → mock-provider.js (development only — rejected in production)
 *   - "legacy" → legacy-provider.js (interim bcrypt/DB auth)
 *   - "duo"    → future-duo-provider.js (Cisco Duo MFA — not yet implemented)
 *
 * In production (NODE_ENV=production), the mock provider is rejected (fail-closed).
 */

import * as mockProvider from './providers/mock-provider.js';
import * as legacyProvider from './providers/legacy-provider.js';
// FUTURE: import * as duoProvider from './providers/future-duo-provider.js';

/**
 * Returns the active auth provider based on AUTH_PROVIDER env var.
 * Fails closed in production if mock is selected.
 */
function getActiveProvider() {
  const providerName = process.env.AUTH_PROVIDER || 'mock';
  const isProduction = process.env.NODE_ENV === 'production';

  switch (providerName) {
    case 'mock':
      if (isProduction) {
        console.error('[auth] FATAL: AUTH_PROVIDER=mock is not allowed in production. Failing closed.');
        return null;
      }
      return mockProvider;

    case 'legacy':
      return legacyProvider;

    // FUTURE: Uncomment when Cisco Duo integration is ready
    // case 'duo':
    //   return duoProvider;

    default:
      console.error(`[auth] Unknown AUTH_PROVIDER "${providerName}". Failing closed.`);
      return null;
  }
}

/**
 * Resolves the currently authenticated user.
 *
 * @param {Request|null} [request=null] - The incoming request
 * @returns {Promise<object|null>} The user object, or null if unauthenticated
 */
export async function getCurrentUser(request = null) {
  const provider = getActiveProvider();

  if (!provider) return null;

  try {
    const user = await provider.resolveUser(request);
    return user || null;
  } catch (error) {
    // Rethrow Next.js internal errors (e.g. DynamicServerError) so the
    // framework can handle static/dynamic rendering decisions.
    if (error.digest?.startsWith('DYNAMIC_SERVER_USAGE')) {
      throw error;
    }
    console.error('[auth] Error resolving current user:', error.message);
    return null;
  }
}
