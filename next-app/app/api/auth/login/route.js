/**
 * POST /api/auth/login — authenticate user and create session.
 */

import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const providerName = process.env.AUTH_PROVIDER || 'mock';

    if (providerName === 'mock' && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }

    let user = null;

    if (providerName === 'legacy') {
      const { authenticate } = await import('@/lib/auth/providers/legacy-provider.js');
      user = await authenticate(username, password);
    } else if (providerName === 'mock') {
      // In dev mock mode, accept any credentials and map known usernames to local personas.
      const { getMockUserForUsername } = await import('@/lib/auth/mock-user.js');
      user = getMockUserForUsername(username);
    } else {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    await createSession(user);

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role, teams: user.teams || [] },
    });
  } catch (error) {
    console.error('[auth/login] Error:', error.message);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
