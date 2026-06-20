/**
 * GET /api/auth/me — return current authenticated user (safe fields only).
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      teams: user.teams || [],
      timezone: user.timezone || 'America/Chicago',
      modules: user.modules || [],
    },
  });
}
