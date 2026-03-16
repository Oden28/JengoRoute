/**
 * lib/formatters.ts — Display formatting utilities for JengoRoute.
 *
 * Consistent formatting for dates, times, locations, and text
 * across every page and component. Designed for operational clarity:
 * supervisors need to scan timestamps and locations at a glance.
 */

import { formatDistanceToNowStrict, format, isToday, isYesterday } from 'date-fns';

/**
 * Relative time — compact, no "about" or "less than".
 * "3m ago", "2h ago", "1d ago"
 */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true });
  } catch {
    return '—';
  }
}

/**
 * Smart timestamp — shows time if today, date+time otherwise.
 * Today: "14:32"    Yesterday: "Yesterday 14:32"    Older: "12 Mar 14:32"
 */
export function smartTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return `Yesterday ${format(date, 'HH:mm')}`;
    return format(date, 'd MMM HH:mm');
  } catch {
    return '—';
  }
}

/**
 * Full date-time for tooltips and detail views.
 */
export function fullDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'd MMM yyyy, HH:mm:ss');
  } catch {
    return '—';
  }
}

/**
 * Format coordinates for display: "-1.2921, 36.8219"
 * Returns null placeholder if coordinates missing.
 */
export function formatCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (lat == null || lng == null) return 'No location';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Google Maps link from coordinates.
 */
export function mapsLink(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  if (lat == null || lng == null) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/**
 * Truncate long text with ellipsis.
 */
export function truncate(text: string | null | undefined, max = 60): string {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Safe guard name — always returns something displayable.
 */
export function guardName(
  user?: { name: string; phone?: string } | null,
): string {
  if (!user) return 'Unknown guard';
  return user.name || user.phone || 'Unknown guard';
}

