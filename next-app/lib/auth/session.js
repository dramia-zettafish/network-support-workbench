/**
 * Session management — secure cookie-based sessions for interim auth.
 *
 * Uses signed, HTTP-only cookies. No localStorage/sessionStorage.
 * Session data is a JSON payload signed with HMAC-SHA256.
 */

import 'server-only';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'eus_session';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE_SECONDS || '28800', 10); // 8 hours default

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      '[auth/session] SESSION_SECRET must be set and at least 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return secret;
}

function sign(payload) {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${Buffer.from(data).toString('base64url')}.${hmac}`;
}

function verify(token) {
  try {
    const [dataB64, sig] = token.split('.');
    if (!dataB64 || !sig) return null;
    const data = Buffer.from(dataB64, 'base64url').toString();
    const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(data);
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a session cookie for the authenticated user.
 */
export async function createSession(user) {
  const payload = {
    uid: user.id,
    username: user.username,
    role: user.role,
    teams: user.teams || [],
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const token = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return payload;
}

/**
 * Read and validate the current session from cookies.
 * @returns {object|null} Session payload or null if invalid/expired.
 */
export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verify(cookie.value);
}

/**
 * Read session from a raw cookie header string (for API routes).
 */
export function getSessionFromCookieHeader(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verify(match[1]);
}

/**
 * Destroy the session cookie.
 */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
