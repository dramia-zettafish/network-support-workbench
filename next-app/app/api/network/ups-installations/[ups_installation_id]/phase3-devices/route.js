import { json, readJson } from '@/network-workbench/lib/apiResponse';
import { updateUpsInstallation } from '@/network-workbench/lib/upsRepository';
import { handleNetworkWriteError, requireNetworkWriteAccess } from '@/app/api/network/_guards';

const allowedFields = [
  'new_asset_tag',
  'new_serial_number',
  'new_webcard_serial',
  'new_mac_address',
  'new_battery_pack_serial',
  'new_battery_pack_asset_tag',
  'battery_pack_1_asset_tag'
];

export async function PATCH(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const body = await readJson(request);
    const install = await updateUpsInstallation(Number.parseInt(upsInstallationId, 10), body, allowedFields);
    return json(install);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error updating UPS phase 3 devices');
  }
}
