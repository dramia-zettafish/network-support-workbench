export const API_BASE = process.env.NEXT_PUBLIC_NETWORK_API_BASE || '/api';

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${normalizeEndpoint(endpoint)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function normalizeEndpoint(endpoint) {
  const [path, query = ''] = endpoint.split('?');
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}
