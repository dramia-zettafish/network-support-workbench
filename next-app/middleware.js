/**
 * Next.js Middleware — auth boundary + workspace-based route gating.
 *
 * Redirects unauthenticated users to /login for protected pages.
 * Returns 401 for protected API routes without valid session.
 * Blocks access to modules the user's teams/role don't grant.
 */

import { NextResponse } from 'next/server';

const COOKIE_NAME = 'eus_session';

/**
 * Route-to-team mapping: which teams grant access to each route prefix.
 * A user needs at least ONE of the listed teams to access the route.
 * Routes not listed here are accessible to any authenticated user.
 */
const ROUTE_TEAM_REQUIREMENTS = {
  '/issue': ['parts_administrators'],
  '/checkin': ['parts_administrators'],
  '/inventory': ['parts_administrators'],
  '/ledger': ['parts_administrators'],
  '/logistics/log': ['logistics_technicians'],
  '/logistics': ['logistics_technicians'],
  '/route-coordination': ['route_coordinators'],
  '/data-management': ['reporting_administrators'],
  '/cases': [
    'computer_technicians', 'intake_administrators', 'internal_support_technicians',
    'network_technicians', 'order_administrators', 'parts_administrators',
    'quote_administrators', 'rma_administrators', 'route_coordinators',
  ],
  '/notifications': [],  // role-gated below
  '/system-monitoring': [], // role-gated below
  '/admin': [], // role-gated below
  '/management': [], // role-gated below
  '/alto-inventory': ['rma_administrators'],
  '/employee-assets': ['internal_support_technicians'],
  '/bulk-orders': ['quote_administrators'],
  '/program-tracking': ['quote_administrators'],
  '/network': ['network_technicians'],
};

/**
 * Routes that require specific roles (independent of teams).
 */
const ROUTE_ROLE_REQUIREMENTS = {
  '/notifications': ['supervisor', 'manager'],
  '/system-monitoring': ['manager'],
  '/admin': ['manager'],
  '/management': ['supervisor', 'manager'],
};

/**
 * Routes accessible to any authenticated user (no team/role check).
 */
const OPEN_ROUTES = ['/runbook', '/protected'];

const PROTECTED_PAGE_PREFIXES = [
  '/inventory', '/issue', '/checkin', '/ledger', '/notifications',
  '/cases', '/logistics', '/route-coordination', '/data-management',
  '/runbook', '/system-monitoring', '/protected', '/admin', '/alto-inventory',
  '/employee-assets', '/management', '/bulk-orders', '/program-tracking',
  '/network',
];

const PROTECTED_API_PREFIXES = [
  '/api/cases', '/api/parts', '/api/stock', '/api/logistics',
  '/api/reference', '/api/db-health', '/api/issue', '/api/checkin',
  '/api/ledger', '/api/notifications', '/api/runbook', '/api/admin',
  '/api/data-management', '/api/system-metrics', '/api/alto-inventory',
  '/api/employee-assets', '/api/bulk-orders', '/api/program-tracking',
  '/api/network',
];

const PUBLIC_PATHS = [
  '/login', '/api/health', '/api/auth', '/api/env-label',
  '/api/write-safety/status', '/api/logistics/workbook/status',
];

function isPublic(pathname) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isProtectedPage(pathname) {
  return PROTECTED_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isProtectedApi(pathname) {
  return PROTECTED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isOpenRoute(pathname) {
  return OPEN_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Check if a user's session grants access to a given page path.
 * Returns true if access is allowed.
 */
function hasRouteAccess(pathname, session) {
  if (isOpenRoute(pathname)) return true;

  const userTeams = session.teams || [];
  const userRole = session.role || '';

  // If session predates teams field, allow access (user must re-login to get gating)
  if (!session.teams) return true;

  // Check role-gated routes first (more specific)
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLE_REQUIREMENTS)) {
    if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
      if (allowedRoles.includes(userRole)) return true;
      // If it's ONLY role-gated (empty team list), deny here
      const teamReq = ROUTE_TEAM_REQUIREMENTS[routePrefix];
      if (!teamReq || teamReq.length === 0) return false;
    }
  }

  // Check team-gated routes (match longest prefix first)
  const sortedPrefixes = Object.keys(ROUTE_TEAM_REQUIREMENTS).sort((a, b) => b.length - a.length);
  for (const routePrefix of sortedPrefixes) {
    if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
      const allowedTeams = ROUTE_TEAM_REQUIREMENTS[routePrefix];
      if (!allowedTeams || allowedTeams.length === 0) continue;
      if (allowedTeams.some((t) => userTeams.includes(t))) return true;
      // Manager/supervisor bypass for visibility
      if (['manager', 'supervisor'].includes(userRole)) return true;
      return false;
    }
  }

  return true;
}

async function verifySession(cookieValue) {
  if (!cookieValue) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;

  try {
    const [dataB64, sig] = cookieValue.split('.');
    if (!dataB64 || !sig) return null;

    const padded = dataB64.replace(/-/g, '+').replace(/_/g, '/');
    const data = decodeURIComponent(escape(atob(padded + '='.repeat((4 - padded.length % 4) % 4))));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const expected = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (sig !== expected) return null;
    const payload = JSON.parse(data);
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || isPublic(pathname)) {
    return NextResponse.next();
  }

  const needsPageAuth = isProtectedPage(pathname);
  const needsApiAuth = isProtectedApi(pathname);

  if (!needsPageAuth && !needsApiAuth) {
    // Root path and any unmatched paths still require auth
    const cookie = request.cookies.get(COOKIE_NAME);
    const session = await verifySession(cookie?.value);
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME);
  const session = await verifySession(cookie?.value);

  if (!session) {
    if (needsApiAuth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Workspace/team-based route gating (pages only — API routes keep their own auth)
  if (needsPageAuth && !hasRouteAccess(pathname, session)) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('access_denied', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
