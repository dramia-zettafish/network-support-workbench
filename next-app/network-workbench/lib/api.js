export const API_BASE = process.env.NEXT_PUBLIC_NETWORK_API_BASE || '/api/network';

export async function apiRequest(endpoint, options = {}) {
  if (isMutatingMethod(options.method)) {
    const writesEnabled = await fetch('/api/write-safety/status', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => status?.enabled === true || status?.writesEnabled === true)
      .catch(() => false);

    if (!writesEnabled) {
      throw new Error('Write operations are disabled');
    }
  }

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

function isMutatingMethod(method = 'GET') {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
}

function normalizeEndpoint(endpoint) {
  const [path, query = ''] = endpoint.split('?');
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}
