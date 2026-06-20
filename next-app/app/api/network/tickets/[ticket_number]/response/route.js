import { createTicketResponse, getTicketResponse, updateTicketResponse } from '@/network-workbench/lib/ticketRepository';
import { handleRouteError, json, readJson } from '@/network-workbench/lib/apiResponse';
import { handleNetworkWriteError, requireNetworkReadAccess, requireNetworkWriteAccess } from '@/app/api/network/_guards';

export async function GET(request, { params }) {
  const accessError = await requireNetworkReadAccess(request);
  if (accessError) return accessError;

  try {
    const { ticket_number: ticketNumber } = await params;
    const response = await getTicketResponse(Number.parseInt(ticketNumber, 10));
    return json(response);
  } catch (error) {
    return handleRouteError(error, 'Error retrieving ticket response');
  }
}

export async function POST(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ticket_number: ticketNumber } = await params;
    const body = await readJson(request);
    const response = await createTicketResponse(Number.parseInt(ticketNumber, 10), body);
    return json(response, { status: 201 });
  } catch (error) {
    return handleNetworkWriteError(error, 'Error creating ticket response');
  }
}

export async function PATCH(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ticket_number: ticketNumber } = await params;
    const body = await readJson(request);
    const response = await updateTicketResponse(Number.parseInt(ticketNumber, 10), body);
    return json(response);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error updating ticket response');
  }
}
