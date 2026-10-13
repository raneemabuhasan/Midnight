/**
 * Builds the local calendar-date key (YYYY-MM-DD) for a Date.
 *
 * Local components are used so the machine's timezone is respected, and the
 * single implementation keeps the policy and the controller in agreement about
 * what "the same day" means.
 *
 * @param d - The local time to derive the date key from.
 * @returns The zero-padded YYYY-MM-DD string for that local date.
 */
export function localDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Determines whether a late-night reminder should be shown.
 *
 * Pure logic: no side effects, no timers, no notifications, no file access.
 *
 * @param now - The current simulated local time.
 * @param lastReminderDate - ISO date string (YYYY-MM-DD) of the last
 *   automatic reminder in local time, or null if no reminder has been
 *   shown in the current session.
 * @returns true if a reminder should be shown, false otherwise.
 */
export function shouldRemind(
  now: Date,
  lastReminderDate: string | null,
): boolean {
  // Build the local calendar-date string for the supplied Date.
  const today = localDateKey(now);

  // Deduplication: already reminded on this local calendar date.
  if (lastReminderDate === today) {
    return false;
  }

  // Time-window check: 00:00 inclusive through 06:00 exclusive.
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const START_OF_WINDOW = 0; // 00:00
  const END_OF_WINDOW = 6 * 60; // 06:00

  return totalMinutes >= START_OF_WINDOW && totalMinutes < END_OF_WINDOW;
}
