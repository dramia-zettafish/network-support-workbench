import { json, readJson } from '@/network-workbench/lib/apiResponse';
import { scheduleUpsInstallationsWithDates } from '@/network-workbench/lib/upsRepository';
import { handleNetworkWriteError, requireNetworkWriteAccess } from '@/app/api/network/_guards';

export async function POST(request) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const body = await readJson(request);
    const schedule = await scheduleUpsInstallationsWithDates(body);
    return json(schedule);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error generating UPS schedule');
  }
}
