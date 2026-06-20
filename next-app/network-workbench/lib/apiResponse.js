import { NextResponse } from 'next/server';

export function json(data, init = {}) {
  return NextResponse.json(data, init);
}

export function errorResponse(status, detail) {
  return NextResponse.json({ detail }, { status });
}

export function badRequest(detail = 'Invalid request data') {
  return errorResponse(400, detail);
}

export function notFound(detail = 'Not found') {
  return errorResponse(404, detail);
}

export function serverError(detail = 'Internal server error') {
  return errorResponse(500, detail);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

export function handleRouteError(error, fallbackDetail = 'Internal server error') {
  if (error?.status) {
    return errorResponse(error.status, error.message);
  }

  if (error?.code === '23505' || error?.code === '23503' || error?.code === '23514' || error?.code === '22P02') {
    return badRequest('Invalid request data');
  }

  return serverError(fallbackDetail);
}
