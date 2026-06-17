import { handleRouteError, json, readJson } from '../../../../../lib/apiResponse';
import { updateUpsInstallation } from '../../../../../lib/upsRepository';

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
  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const body = await readJson(request);
    const install = await updateUpsInstallation(Number.parseInt(upsInstallationId, 10), body, allowedFields);
    return json(install);
  } catch (error) {
    return handleRouteError(error, 'Error updating UPS phase 3 devices');
  }
}
