/**
 * Cisco Duo MFA authentication provider — PLACEHOLDER.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FUTURE IMPLEMENTATION:
 *
 * This file is the designated integration point for the company's Cisco Duo
 * MFA system. When ready, it will:
 *
 *   1. Validate Duo-issued tokens/sessions from the request.
 *   2. Exchange Duo auth assertions for internal user identity.
 *   3. Map Duo group memberships to application roles and team access.
 *   4. Provide SSO session management hooks.
 *
 * The existing custom username/password/JWT/MFA auth is temporary and will be
 * replaced entirely by this provider. The rest of the auth boundary (roles,
 * teams, modules) is designed to be provider-agnostic so the switchover is
 * isolated to this file plus configuration.
 *
 * Environment variables expected (future):
 *   - DUO_CLIENT_ID
 *   - DUO_CLIENT_SECRET
 *   - DUO_API_HOST
 *   - DUO_REDIRECT_URI
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Resolves the current user from a Duo-authenticated request.
 * NOT YET IMPLEMENTED — will throw until Duo integration is built.
 *
 * @param {Request|null} _request - Incoming request with Duo session/token
 * @returns {Promise<object|null>}
 */
export async function resolveUser(_request = null) {
  throw new Error(
    '[future-duo-provider] Cisco Duo integration is not yet implemented. ' +
    'Set AUTH_PROVIDER=mock for development.'
  );
}

/**
 * Validates whether the Duo provider is configured and ready.
 * Returns false until Duo credentials are configured.
 *
 * @returns {Promise<boolean>}
 */
export async function isProviderReady() {
  // FUTURE: Check that DUO_CLIENT_ID, DUO_CLIENT_SECRET, DUO_API_HOST are set
  return false;
}

/**
 * Provider metadata for diagnostics.
 */
export const providerInfo = {
  name: 'duo',
  description: 'Cisco Duo MFA provider — NOT YET IMPLEMENTED',
  temporary: false,
};
