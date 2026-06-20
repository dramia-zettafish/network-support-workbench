import { json, readJson } from '@/network-workbench/lib/apiResponse';
import { updateUpsInstallation } from '@/network-workbench/lib/upsRepository';
import { handleNetworkWriteError, requireNetworkWriteAccess } from '@/app/api/network/_guards';

export async function PUT(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const body = await readJson(request);
    const install = await updateUpsInstallation(Number.parseInt(upsInstallationId, 10), body);
    return json(install);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error updating UPS installation');
  }
}
