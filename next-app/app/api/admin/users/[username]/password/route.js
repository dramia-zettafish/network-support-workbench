import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { withTransaction } from '@/lib/db-write.js';
import bcrypt from 'bcryptjs';

const ALLOWED_ROLES = ['admin', 'supervisor', 'manager'];

/** POST /api/admin/users/[username]/password — set user password */
export async function POST(req, { params }) {
  await requireRole(ALLOWED_ROLES, req);
  const { username } = await params;
  const body = await req.json();
  const password = (body.password || '').trim();

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 422 });
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least 1 letter and 1 digit' }, { status: 422 });
  }

  const hash = await bcrypt.hash(password, 10);

  await withTransaction(async (client) => {
    // Upsert auth_users table (password_hash lives here, not in users)
    await client.query(
      `INSERT INTO auth_users (username, password_hash, is_active)
       VALUES ($1, $2, 1)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = 1`,
      [username, hash]
    );
  });

  return NextResponse.json({ ok: true });
}
