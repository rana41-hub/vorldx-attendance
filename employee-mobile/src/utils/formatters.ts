/**
 * Shared date, time, and duration formatting utilities for VorldX Mobile.
 */

/**
 * Format an ISO timestamp string to display localized time (e.g. "06:46 PM").
 */
export const formatTime = (isoString?: string | null): string => {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return '--:--';
  }
};

/**
 * Format an ISO date or timestamp to a friendly readable date (e.g. "Wed, Oct 15, 2026").
 */
export const formatDate = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return isoString;
  }
};

/**
 * Calculate and format the work duration between check-in and check-out (or current time if ongoing).
 * Prevents "0h 0m" for non-zero intervals by showing exact seconds if under 1 minute.
 *
 * Examples:
 * - 19 seconds elapsed: "19s"
 * - 45 minutes elapsed: "45m"
 * - 2 hours 15 mins: "2h 15m"
 * - 8 hours 0 mins: "8h 0m"
 */
export const formatDuration = (
  checkInIso?: string | null,
  checkOutIso?: string | null,
  inProgressFallback: boolean = true
): string => {
  if (!checkInIso) {
    return inProgressFallback ? '0m' : '-';
  }

  const start = new Date(checkInIso).getTime();
  if (isNaN(start)) {
    return inProgressFallback ? '0m' : '-';
  }

  const end = checkOutIso ? new Date(checkOutIso).getTime() : Date.now();
  if (isNaN(end)) {
    return inProgressFallback ? '0m' : '-';
  }

  const diffMs = Math.max(0, end - start);
  const totalSeconds = Math.floor(diffMs / 1000);

  // Short interval under 1 minute: display exact seconds (avoids confusing "0h 0m")
  if (totalSeconds < 60) {
    return totalSeconds > 0 ? `${totalSeconds}s` : '0m';
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};
