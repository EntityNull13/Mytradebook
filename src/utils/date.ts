/**
 * Centralized Timezone & Date Utility for Tradebook
 * Ensures consistent trading-day calculations without UTC slicing discrepancies.
 */

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

/**
 * Returns a standardized 'YYYY-MM-DD' calendar date key for any timestamp
 * evaluated in the user's configured timezone (default Asia/Jakarta).
 */
export function getDateKey(
  timestamp?: string | Date | number | null,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!timestamp) return '';

  const date =
    typeof timestamp === 'string' || typeof timestamp === 'number'
      ? new Date(timestamp)
      : timestamp;

  if (isNaN(date.getTime())) {
    // If it's already a 'YYYY-MM-DD' string, return as-is
    if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
      return timestamp;
    }
    return '';
  }

  try {
    const tz = timezone || DEFAULT_TIMEZONE;
    // 'en-CA' locale natively outputs ISO format: YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Safe fallback if timezone name is unsupported
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Returns today's 'YYYY-MM-DD' string in the given timezone.
 */
export function getTodayDateKey(timezone: string = DEFAULT_TIMEZONE): string {
  return getDateKey(new Date(), timezone);
}

/**
 * Formats a timestamp into a human-readable date in the given timezone
 */
export function formatDateInTimezone(
  timestamp?: string | Date | number | null,
  timezone: string = DEFAULT_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!timestamp) return '—';
  const date = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(date.getTime())) return String(timestamp);

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Formats a timestamp with time in the given timezone
 */
export function formatDateTimeInTimezone(
  timestamp?: string | Date | number | null,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!timestamp) return '—';
  const date = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(date.getTime())) return String(timestamp);

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
