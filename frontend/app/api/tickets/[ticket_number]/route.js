import { deleteTicket, updateTicket } from '../../../../lib/ticketRepository';
import { handleRouteError, json, readJson } from '../../../../lib/apiResponse';

export async function PUT(request, { params }) {
  try {
    const { ticket_number: ticketNumber } = await params;
    const body = await readJson(request);
    const ticket = await updateTicket(Number.parseInt(ticketNumber, 10), body);
    return json(ticket);
  } catch (error) {
    return handleRouteError(error, 'Error updating ticket');
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { ticket_number: ticketNumber } = await params;
    const result = await deleteTicket(Number.parseInt(ticketNumber, 10));
    return json(result);
  } catch (error) {
    return handleRouteError(error, 'Error deleting ticket');
  }
}
