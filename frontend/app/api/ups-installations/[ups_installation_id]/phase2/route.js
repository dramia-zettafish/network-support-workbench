import { handleRouteError, json, readJson } from '../../../../../lib/apiResponse';
import { updateUpsInstallation } from '../../../../../lib/upsRepository';

const allowedFields = [
  'model',
  'serial_number',
  'snmp_ip',
  'hostname',
  'asset_tag',
  'mac_address',
  'room_number',
  'defective_battery_pack_serial',
  'battery_pack_1_asset_tag',
  'idf'
];

export async function PATCH(request, { params }) {
  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const body = await readJson(request);
    const install = await updateUpsInstallation(Number.parseInt(upsInstallationId, 10), body, allowedFields);
    return json(install);
  } catch (error) {
    return handleRouteError(error, 'Error updating UPS phase 2');
  }
}
