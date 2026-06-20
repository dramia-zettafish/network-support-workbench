export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const writesEnabled =
    String(process.env.WRITES_ENABLED || 'false').toLowerCase() === 'true';

  const publicWritesEnabled =
    String(process.env.NEXT_PUBLIC_WRITES_ENABLED || 'false').toLowerCase() === 'true';

  return Response.json(
    {
      enabled: writesEnabled,
      writesEnabled,
      publicWritesEnabled,
      message: writesEnabled
        ? 'Write operations are enabled.'
        : 'Write operations are disabled.'
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    }
  );
}
