export const NETWORK_ROUTE_PREFIX = process.env.NEXT_PUBLIC_NETWORK_ROUTE_PREFIX || '/network';

export const networkModules = [
  { id: 'dashboard', label: 'Dashboard', href: withNetworkPrefix('/') },
  { id: 'tickets', label: 'Tickets', href: withNetworkPrefix('/tickets') },
  { id: 'ups', label: 'UPS', href: withNetworkPrefix('/ups') }
];

export function withNetworkPrefix(path) {
  const normalizedPath = path === '/' ? '' : path;
  const normalizedPrefix = NETWORK_ROUTE_PREFIX.replace(/\/+$/, '');
  return `${normalizedPrefix}${normalizedPath}` || '/';
}

export function moduleHref(moduleId) {
  return networkModules.find((module) => module.id === moduleId)?.href || withNetworkPrefix('/');
}
