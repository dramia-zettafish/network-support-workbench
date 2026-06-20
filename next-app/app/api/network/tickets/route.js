import { createTicket, listTickets } from '@/network-workbench/lib/ticketRepository';
import { handleRouteError, json, readJson } from '@/network-workbench/lib/apiResponse';
import { handleNetworkWriteError, requireNetworkReadAccess, requireNetworkWriteAccess } from '@/app/api/network/_guards';

export async function GET(request) {
  const accessError = await requireNetworkReadAccess(request);
  if (accessError) return accessError;

  const { searchParams } = new URL(request.url);

  try {
    const tickets = await listTickets({
      status: searchParams.get('status') || null,
      limit: clampQueryInt(searchParams.get('limit'), 100, 1, 1000),
      offset: clampQueryInt(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    });

    return json(tickets);
  } catch (error) {
    return handleRouteError(error, 'Error retrieving tickets');
  }
}

export async function POST(request) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const body = await readJson(request);
    const ticket = await createTicket(body);
    return json(ticket, { status: 201 });
  } catch (error) {
    return handleNetworkWriteError(error, 'Error creating ticket');
  }
}

function clampQueryInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
