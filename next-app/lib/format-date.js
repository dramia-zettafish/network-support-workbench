'use client';

import { useWorkspace } from '@/app/components/workspace-provider.jsx';

/**
 * Format a date/time value in the user's selected timezone.
 */
export function formatInTimezone(value, timezone, opts = {}) {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, { timeZone: timezone, ...opts });
}

/**
 * Hook that returns a formatter bound to the user's timezone.
 */
export function useTimezone() {
  const { timezone } = useWorkspace();
  const tz = timezone || 'America/Chicago';
  return {
    timezone: tz,
    fmt: (value, opts) => formatInTimezone(value, tz, opts),
    fmtDate: (value) => formatInTimezone(value, tz, { dateStyle: 'short' }),
    fmtTime: (value) => formatInTimezone(value, tz, { timeStyle: 'short' }),
  };
}
