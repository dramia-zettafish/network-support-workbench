import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db.js';
import { mutate } from '@/lib/db-write.js';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    const { current_password, new_password } = await request.json();

    if (!current_password || !new_password) {
      return Response.json({ error: 'Current and new password are required' }, { status: 422 });
    }

    const [row] = await query('SELECT id, password_hash FROM auth_users WHERE username = $1', [user.username]);
    if (!row) return Response.json({ error: 'User not found' }, { status: 404 });

    const valid = await bcrypt.compare(current_password, row.password_hash);
    if (!valid) return Response.json({ error: 'Current password is incorrect' }, { status: 401 });

    const hash = await bcrypt.hash(new_password, 12);
    await mutate('UPDATE auth_users SET password_hash = $1 WHERE id = $2', [hash, row.id]);

    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
