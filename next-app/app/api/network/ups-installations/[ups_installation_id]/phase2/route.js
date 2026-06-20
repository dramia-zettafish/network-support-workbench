import { json, readJson } from '@/network-workbench/lib/apiResponse';
import { updateUpsInstallation } from '@/network-workbench/lib/upsRepository';
import { handleNetworkWriteError, requireNetworkWriteAccess } from '@/app/api/network/_guards';

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
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ups_installation_id: upsInstallationId } = await params;
    const body = await readJson(request);
    const install = await updateUpsInstallation(Number.parseInt(upsInstallationId, 10), body, allowedFields);
    return json(install);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error updating UPS phase 2');
  }
}
