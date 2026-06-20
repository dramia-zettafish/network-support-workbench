/**
 * Write Safety Foundation — guardrail helpers for future write operations.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 * This module provides reusable safety functions that every future write route
 * (POST, PUT, PATCH, DELETE) must call before performing any mutation. All write
 * operations are DISABLED by default and require explicit opt-in via environment
 * configuration.
 *
 * USAGE PATTERN (for future write routes):
 *   import {
 *     requireWriteEnabled,
 *     assertAllowedMethod,
 *     requireWritePermission,
 *     sanitizeWriteError,
 *     createAuditContext,
 *   } from '@/lib/write-safety';
 *
 *   export async function POST(req) {
 *     const writeCheck = requireWriteEnabled();
 *     if (writeCheck) return writeCheck;
 *
 *     const methodCheck = assertAllowedMethod(req, ['POST']);
 *     if (methodCheck) return methodCheck;
 *
 *     const permCheck = await requireWritePermission(req);
 *     if (permCheck.error) return permCheck.error;
 *
 *     const audit = await createAuditContext(req);
 *     try {
 *       // ... business logic ...
 *     } catch (error) {
 *       return sanitizeWriteError(error);
 *     }
 *   }
 *
 * NOTE: No real write endpoints exist yet. This module is preparation only.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'server-only';

import { getCurrentUser } from '@/lib/auth';
import { requireAuth, requireRole, ROLES } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Returns the current write-safety status as a plain object.
 * Safe for use in API responses — no secrets or env values are exposed.
 *
 * @returns {{ enabled: boolean, reason: string }}
 */
export function getWriteSafetyStatus() {
  const enabled = (process.env.WRITES_ENABLED || 'false').toLowerCase() === 'true';
  return {
    enabled,
    reason: enabled
      ? 'Write operations are enabled via WRITES_ENABLED'
      : 'Write operations are disabled (default). Set WRITES_ENABLED=true to enable.',
  };
}

/**
 * Throws an error if write operations are disabled.
 * Use in server-side logic where you want an exception rather than a Response.
 *
 * @throws {Error} If writes are disabled.
 */
export function assertWritesEnabled() {
  const { enabled } = getWriteSafetyStatus();
  if (!enabled) {
    const err = new Error('Write operations are currently disabled');
    err.code = 'WRITES_DISABLED';
    throw err;
  }
}

/**
 * Checks whether write operations are enabled via the WRITES_ENABLED
 * environment variable. Defaults to disabled ('false').
 *
 * @returns {NextResponse|null} Returns a 403 JSON response if writes are
 *   disabled, or null if writes are enabled (allowing the caller to proceed).
 */
export function requireWriteEnabled() {
  const writesEnabled = process.env.WRITES_ENABLED || 'false';

  if (writesEnabled.toLowerCase() !== 'true') {
    return NextResponse.json(
      {
        error: 'Write operations are currently disabled',
        message:
          'This application is in read-only mode. Write operations are not available.',
        code: 'WRITES_DISABLED',
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Validates that the incoming request uses an allowed HTTP method.
 *
 * @param {Request} req - The incoming request object
 * @param {string[]} allowedMethods - Array of allowed HTTP methods (e.g., ['POST', 'PUT'])
 * @returns {NextResponse|null} Returns a 405 JSON response if the method is
 *   not allowed, or null if the method is permitted.
 */
export function assertAllowedMethod(req, allowedMethods) {
  const method = req.method?.toUpperCase();
  const allowed = allowedMethods.map((m) => m.toUpperCase());

  if (!allowed.includes(method)) {
    return NextResponse.json(
      {
        error: 'Method Not Allowed',
        message: `The ${method} method is not allowed for this endpoint.`,
        code: 'METHOD_NOT_ALLOWED',
        allowedMethods: allowed,
      },
      {
        status: 405,
        headers: { Allow: allowed.join(', ') },
      }
    );
  }

  return null;
}

/**
 * Roles that are permitted to perform write operations.
 * The 'viewer' role is explicitly excluded from write access.
 */
const WRITE_CAPABLE_ROLES = ['admin', 'manager', 'technician', 'supervisor'];

/**
 * Verifies that the requesting user is authenticated and has a write-capable
 * role. Uses existing auth helpers (import only, no modifications to auth files).
 *
 * @param {Request} req - The incoming request object
 * @returns {Promise<{ user: object } | { error: NextResponse }>} Returns
 *   the authenticated user object if permitted, or an error response if
 *   authentication fails or the user lacks write permission.
 */
export async function requireWritePermission(req) {
  try {
    // First, verify authentication
    const user = await requireAuth(req);

    // Then, verify the user has a write-capable role
    if (!WRITE_CAPABLE_ROLES.includes(user.role)) {
      return {
        error: NextResponse.json(
          {
            error: 'Insufficient permissions',
            message:
              'Your role does not have permission to perform write operations.',
            code: 'WRITE_PERMISSION_DENIED',
          },
          { status: 403 }
        ),
      };
    }

    return { user };
  } catch (err) {
    // Handle authentication errors
    if (err.unauthorized) {
      return {
        error: NextResponse.json(
          {
            error: 'Authentication required',
            message: 'You must be authenticated to perform this action.',
            code: 'AUTHENTICATION_REQUIRED',
          },
          { status: 401 }
        ),
      };
    }

    // Handle authorization/role errors
    if (err.forbidden) {
      return {
        error: NextResponse.json(
          {
            error: 'Insufficient permissions',
            message:
              'Your role does not have permission to perform write operations.',
            code: 'WRITE_PERMISSION_DENIED',
          },
          { status: 403 }
        ),
      };
    }

    // Unexpected errors — return generic error
    return {
      error: NextResponse.json(
        {
          error: 'Authorization check failed',
          message: 'Unable to verify your permissions. Please try again.',
          code: 'AUTH_CHECK_FAILED',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Patterns that indicate sensitive database information that must be stripped
 * from error messages before returning them to clients.
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /connection\s*string/i,
  /postgres(ql)?:\/\//i,
  /mysql:\/\//i,
  /mongodb(\+srv)?:\/\//i,
  /SELECT\s+/i,
  /INSERT\s+INTO/i,
  /UPDATE\s+.*\s+SET/i,
  /DELETE\s+FROM/i,
  /ALTER\s+TABLE/i,
  /DROP\s+TABLE/i,
  /TRUNCATE/i,
  /CREATE\s+TABLE/i,
  /pg_/i,
  /relation\s+"[^"]+"\s+does\s+not\s+exist/i,
  /column\s+"[^"]+"/i,
  /table\s+"[^"]+"/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /at\s+\S+\s+\(\S+:\d+:\d+\)/i,
];

/**
 * Sanitizes error information to prevent leaking internal details to clients.
 * Strips database secrets, raw SQL errors, internal table/column names,
 * connection strings, and stack traces.
 *
 * @param {Error|object} error - The error to sanitize
 * @returns {NextResponse} A safe JSON error response with no internal details.
 */
export function sanitizeWriteError(error) {
  // Log the full error server-side for debugging
  console.error('[write-safety] Write operation error:', error?.message || error);

  // Always return a generic, safe error response to the client
  return NextResponse.json(
    {
      error: 'Write operation failed',
      message: 'An error occurred while processing your request.',
      code: 'WRITE_OPERATION_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Builds an audit context object for future write operation logging.
 * Creates a structured record of who performed what action on which resource.
 *
 * NOTE: This function creates the audit context but does NOT write/persist it
 * anywhere. Future audit logging implementation will consume this context.
 *
 * @param {Request} req - The incoming request object
 * @returns {Promise<object>} An audit context object with user, timestamp,
 *   action, and resource information.
 */
export async function createAuditContext(req) {
  let user = null;

  try {
    user = await getCurrentUser(req);
  } catch {
    // If user resolution fails, proceed with null user
    // (the audit record will reflect an anonymous action)
  }

  const url = new URL(req.url, 'http://localhost');

  return {
    user: user
      ? {
          id: user.id || null,
          username: user.username || null,
          role: user.role || null,
        }
      : null,
    timestamp: new Date().toISOString(),
    action: req.method?.toUpperCase() || 'UNKNOWN',
    resource: url.pathname,
    metadata: {
      userAgent: req.headers?.get?.('user-agent') || null,
      requestId: req.headers?.get?.('x-request-id') || null,
    },
  };
}
