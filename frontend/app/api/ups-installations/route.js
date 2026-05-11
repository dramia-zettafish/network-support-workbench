import { handleRouteError, json } from '../../../lib/apiResponse';
import { listUpsInstallations } from '../../../lib/upsRepository';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  try {
    const installs = await listUpsInstallations({
      status: searchParams.get('status') || null,
      search: searchParams.get('search') || null,
      limit: clampQueryInt(searchParams.get('limit'), 100, 1, 5000),
      offset: clampQueryInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    });

    return json(installs);
  } catch (error) {
    return handleRouteError(error, 'Error retrieving UPS installations');
  }
}

function clampQueryInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
