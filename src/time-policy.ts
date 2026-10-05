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
  // We use local components so the tester's timezone is respected.
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;

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
