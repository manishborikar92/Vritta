/**
 * Domain Habit Formatters & Sorting Utilities.
 */

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
 * 1. Habits appear in their original creation order on both Today and Habits page.
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
