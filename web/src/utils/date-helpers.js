/**
 * Date and timezone helper functions.
 * Designed to strictly respect the user's local calendar day and avoid UTC offset bugs.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns date in YYYY-MM-DD format using the LOCAL timezone.
 * Avoids .toISOString() which converts to UTC and can shift the date.
 * @param {Date} [d=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function getTodayString(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns short day name in local time: "Sun", "Mon", "Tue", etc.
 * @param {Date|string} [date=new Date()]
 * @returns {string}
 */
export function getDayOfWeek(date = new Date()) {
  const d = typeof date === 'string' ? parseDateString(date) : date;
  return DAYS[d.getDay()];
}

/**
 * Returns full human-readable date in local time, e.g. "Wednesday, October 14, 2026".
 * @param {Date|string} [date=new Date()]
 * @returns {string}
 */
export function formatDate(date = new Date()) {
  const d = typeof date === 'string' ? parseDateString(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get YYYY-MM-DD string for a specific date in local time.
 * @param {Date} date
 * @returns {string}
 */
export function getDateString(date) {
  return getTodayString(date);
}

/**
 * Safely parse a YYYY-MM-DD string into a local Date object (at midnight local time).
 * @param {string} dateStr - Format: YYYY-MM-DD
 * @returns {Date}
 */
export function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get Date X days ago relative to local calendar day.
 * @param {number} days
 * @param {Date} [baseDate=new Date()]
 * @returns {Date}
 */
export function getDaysAgo(days, baseDate = new Date()) {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - days, 12, 0, 0);
  return date;
}

/**
 * Format timing for UI display, keeping timing as guidance rather than a hard deadline.
 * @param {Object} habit
 * @returns {string}
 */
export function getTimingDisplay(habit) {
  if (!habit) return 'Anytime';
  if (habit.timingType === 'relative') {
    return habit.relativeTiming || 'Before bed';
  }
  if (habit.timingType === 'preferred_period') {
    return habit.preferredPeriod ? `${habit.preferredPeriod}` : 'Anytime';
  }
  if (habit.timingType === 'exact' && habit.time) {
    return habit.time;
  }
  if (habit.preferredPeriod) {
    return `${habit.preferredPeriod}`;
  }
  if (habit.time) {
    return habit.time;
  }
  return 'Anytime';
}

/**
 * Format habit recurrence frequency for UI display.
 * Returns human-friendly text like "Daily", "Weekdays", "Weekends", or comma-separated days.
 * @param {string[]} [frequency]
 * @returns {string}
 */
export function getFrequencyDisplay(frequency) {
  if (!Array.isArray(frequency) || frequency.length === 0 || frequency.length >= 7) {
    return 'Daily';
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weekends = ['Sat', 'Sun'];

  const isWeekdays = frequency.length === 5 && weekdays.every(d => frequency.includes(d));
  if (isWeekdays) return 'Weekdays';

  const isWeekends = frequency.length === 2 && weekends.every(d => frequency.includes(d));
  if (isWeekends) return 'Weekends';

  return frequency.join(', ');
}

/**
 * Predictably sorts an array of habits based on canonical sortOrder (First Added, First Displayed).
 * Uses deterministic tie-breakers on creation time and document ID for concurrency resilience.
 *
 * Invariants:
 * 1. Habits appear in their original creation order on both Dashboard and Habits page.
 * 2. Newly created habits appear strictly after previously created habits.
 * 3. Editing a habit (title, category, timing, description, completion) NEVER alters its position.
 * 4. Deterministic tie-breakers: Creation timestamp, then document ID.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function sortHabits(a, b) {
  const orderA = typeof a?.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
  const orderB = typeof b?.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  // Tier 2 deterministic tie-breaker: Creation timestamp (handles concurrent allocations)
  const timeA = typeof a?.createdAt?.toMillis === 'function'
    ? a.createdAt.toMillis()
    : typeof a?.createdAt?.seconds === 'number'
    ? a.createdAt.seconds * 1000
    : typeof a?.createdAt === 'string' || typeof a?.createdAt === 'number'
    ? new Date(a.createdAt).getTime()
    : 0;

  const timeB = typeof b?.createdAt?.toMillis === 'function'
    ? b.createdAt.toMillis()
    : typeof b?.createdAt?.seconds === 'number'
    ? b.createdAt.seconds * 1000
    : typeof b?.createdAt === 'string' || typeof b?.createdAt === 'number'
    ? new Date(b.createdAt).getTime()
    : 0;

  if (timeA !== timeB) {
    return timeA - timeB;
  }

  // Tier 3 ultimate tie-breaker: Document ID
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

