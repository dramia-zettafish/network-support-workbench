import { handleRouteError, json, readJson } from '../../../../lib/apiResponse';
import { updateUpsInstallation } from '../../../../lib/upsRepository';

export async function PUT(request, { params }) {
  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const body = await readJson(request);
    const install = await updateUpsInstallation(Number.parseInt(upsInstallationId, 10), body);
    return json(install);
  } catch (error) {
    return handleRouteError(error, 'Error updating UPS installation');
  }
}
