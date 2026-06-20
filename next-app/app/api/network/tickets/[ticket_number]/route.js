import { deleteTicket, updateTicket } from '@/network-workbench/lib/ticketRepository';
import { json, readJson } from '@/network-workbench/lib/apiResponse';
import { handleNetworkWriteError, requireNetworkWriteAccess } from '@/app/api/network/_guards';

export async function PUT(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ticket_number: ticketNumber } = await params;
    const body = await readJson(request);
    const ticket = await updateTicket(Number.parseInt(ticketNumber, 10), body);
    return json(ticket);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error updating ticket');
  }
}

export async function DELETE(request, { params }) {
  const accessError = await requireNetworkWriteAccess(request);
  if (accessError) return accessError;

  try {
    const { ticket_number: ticketNumber } = await params;
    const result = await deleteTicket(Number.parseInt(ticketNumber, 10));
    return json(result);
  } catch (error) {
    return handleNetworkWriteError(error, 'Error deleting ticket');
  }
}
