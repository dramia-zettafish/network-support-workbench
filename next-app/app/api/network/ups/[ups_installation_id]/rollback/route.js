import { json } from '@/network-workbench/lib/apiResponse';
import { rollbackUpsInstallation } from '@/network-workbench/lib/upsRepository';
import { handleNetworkWriteError, requireNetworkWriteAccess } from '@/app/api/network/_guards';

export async function PATCH(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const install = await rollbackUpsInstallation(Number.parseInt(upsInstallationId, 10));
    return json(install);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error rolling back UPS installation');
  }
}
