import { handleRouteError, json } from '../../../../../lib/apiResponse';
import { rollbackUpsInstallation } from '../../../../../lib/upsRepository';

export async function PATCH(_request, { params }) {
  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const install = await rollbackUpsInstallation(Number.parseInt(upsInstallationId, 10));
    return json(install);
  } catch (error) {
    return handleRouteError(error, 'Error rolling back UPS installation');
  }
}
