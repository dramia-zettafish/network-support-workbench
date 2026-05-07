export const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
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
