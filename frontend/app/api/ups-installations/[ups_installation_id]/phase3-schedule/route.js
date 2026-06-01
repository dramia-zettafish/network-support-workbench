import { handleRouteError, json, readJson } from '../../../../../lib/apiResponse';
import { updateUpsInstallation } from '../../../../../lib/upsRepository';

const allowedFields = ['proposed_install_date', 'install_contact', 'install_contact_number'];

export async function PATCH(request, { params }) {
  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const body = await readJson(request);
    const payload = {
      ...body,
      ...(body.proposed_install_date ? { status: 'scheduled' } : {})
    };
    const install = await updateUpsInstallation(
      Number.parseInt(upsInstallationId, 10),
      payload,
      [...allowedFields, 'status']
    );
    return json(install);
  } catch (error) {
    return handleRouteError(error, 'Error updating UPS phase 3 schedule');
  }
}
