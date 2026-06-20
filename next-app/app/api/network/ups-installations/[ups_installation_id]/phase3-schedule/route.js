import { json, readJson } from '@/network-workbench/lib/apiResponse';
import { updateUpsInstallation } from '@/network-workbench/lib/upsRepository';
import { handleNetworkWriteError, requireNetworkWriteAccess } from '@/app/api/network/_guards';

const allowedFields = ['proposed_install_date', 'install_contact', 'install_contact_number'];

export async function PATCH(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

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
    return handleNetworkWriteError(error, 'Error updating UPS phase 3 schedule');
  }
}
