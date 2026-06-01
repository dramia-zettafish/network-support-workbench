import { createTicketResponse, getTicketResponse, updateTicketResponse } from '../../../../../lib/ticketRepository';
import { handleRouteError, json, readJson } from '../../../../../lib/apiResponse';

export async function GET(_request, { params }) {
  try {
    const { ticket_number: ticketNumber } = await params;
    const response = await getTicketResponse(Number.parseInt(ticketNumber, 10));
    return json(response);
  } catch (error) {
    return handleRouteError(error, 'Error retrieving ticket response');
  }
}

export async function POST(request, { params }) {
  try {
    const { ticket_number: ticketNumber } = await params;
    const body = await readJson(request);
    const response = await createTicketResponse(Number.parseInt(ticketNumber, 10), body);
    return json(response, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Error creating ticket response');
  }
}

export async function PATCH(request, { params }) {
  try {
    const { ticket_number: ticketNumber } = await params;
    const body = await readJson(request);
    const response = await updateTicketResponse(Number.parseInt(ticketNumber, 10), body);
    return json(response);
  } catch (error) {
    return handleRouteError(error, 'Error updating ticket response');
  }
}
