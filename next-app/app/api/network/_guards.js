import { requireTeamAccess } from '@/lib/auth';
import { requireWriteEnabled, sanitizeWriteError } from '@/lib/write-safety';
import { handleRouteError, json } from '@/network-workbench/lib/apiResponse';

export const NETWORK_TEAM = 'network_technicians';

export async function requireNetworkReadAccess(request) {
  try {
    await requireTeamAccess(NETWORK_TEAM, request);
    return null;
  } catch (error) {
    return networkAccessError(error);
  }
}

export async function requireNetworkWriteAccess(request) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  return requireNetworkReadAccess(request);
}

export function handleNetworkWriteError(error, fallbackDetail) {
  if (error?.status || isExpectedDatabaseError(error)) {
    return handleRouteError(error, fallbackDetail);
  }

  return sanitizeWriteError(error);
}

function networkAccessError(error) {
  if (error?.unauthorized) {
    return json(
      {
        error: 'Authentication required',
        message: 'You must be authenticated to access Network Workbench.',
        code: 'AUTHENTICATION_REQUIRED',
      },
      { status: 401 }
    );
  }

  if (error?.forbidden) {
    return json(
      {
        error: 'Network access denied',
        message: 'Network Workbench requires the network_technicians team.',
        code: 'NETWORK_TEAM_REQUIRED',
      },
      { status: 403 }
    );
  }

  return json(
    {
      error: 'Authorization check failed',
      message: 'Unable to verify Network Workbench access.',
      code: 'NETWORK_AUTH_CHECK_FAILED',
    },
    { status: 500 }
  );
}

function isExpectedDatabaseError(error) {
  return ['23505', '23503', '23514', '22P02'].includes(error?.code);
}
