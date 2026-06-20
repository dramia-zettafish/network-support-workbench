import { handleRouteError, json, readJson } from '@/network-workbench/lib/apiResponse';
import { createUpsInstallation, listUpsInstallations } from '@/network-workbench/lib/upsRepository';
import { handleNetworkWriteError, requireNetworkReadAccess, requireNetworkWriteAccess } from '@/app/api/network/_guards';

export async function GET(request) {
  const accessError = await requireNetworkReadAccess(request);
  if (accessError) return accessError;

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

export async function POST(request) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const body = await readJson(request);
    const install = await createUpsInstallation(body);
    return json(install, { status: 201 });
  } catch (error) {
    return handleNetworkWriteError(error, 'Error creating UPS installation');
  }
}

function clampQueryInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
