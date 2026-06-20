import { requireAuth } from '@/lib/auth';
import { withTransaction } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    const writeCheck = requireWriteEnabled();
    if (writeCheck) return writeCheck;
    await requireAuth(request);
    const { id } = await params;
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM cm_custom_logistics_teams WHERE id = $1`, [id]);
    });
    return Response.json({ ok: true });
  } catch (err) {
    if (err.unauthorized) return Response.json({ error: 'Authentication required' }, { status: 401 });
    return Response.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
