import { handleRouteError, json, readJson } from '../../../../../lib/apiResponse';
import { scheduleUpsInstallationsWithDates } from '../../../../../lib/upsRepository';

export async function POST(request) {
  try {
    const body = await readJson(request);
    const schedule = await scheduleUpsInstallationsWithDates(body);
    return json(schedule);
  } catch (error) {
    return handleRouteError(error, 'Error generating UPS schedule');
  }
}
