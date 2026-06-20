import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user.js';
import { mutate } from '@/lib/db-write.js';

export const dynamic = 'force-dynamic';

export async function PUT(request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { timezone } = await request.json();
  if (!timezone || typeof timezone !== 'string') {
    return NextResponse.json({ error: 'timezone is required' }, { status: 400 });
  }

  // Validate it's a real IANA timezone
  try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); }
  catch { return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 }); }

  await mutate('UPDATE users SET timezone = $1 WHERE id = $2', [timezone, user.id]);
  return NextResponse.json({ ok: true, timezone });
}
