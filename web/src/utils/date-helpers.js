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
 * Computes a standardized numerical sort weight for a habit based on its timing preference.
 * Priority order (Flexible / Anytime first, followed by daily progression):
 * 10: Flexible / Anytime
 * 20: Morning
 * 30: Afternoon
 * 40: Evening
 * 50: Before Bed / Night
 *
 * @param {Object} habit
 * @returns {number}
 */
export function getTimingSortWeight(habit) {
  if (!habit) return 10;

  const timingType = habit.timingType || '';
  const period = String(habit.preferredPeriod || habit.time || '').toLowerCase();
  const relative = String(habit.relativeTiming || '').toLowerCase();

  // 1. Flexible / Anytime (Highest priority: First position)
  if (
    timingType === 'anytime' ||
    period === 'flexible' ||
    (!period && !relative && timingType !== 'exact')
  ) {
    return 10;
  }

  // 2. Before Bed / Night (Relative or Night period)
  if (
    relative.includes('bed') ||
    period.includes('bed') ||
    period.includes('night') ||
    relative.includes('night')
  ) {
    return 50;
  }

  // 3. Morning
  if (
    period.includes('morning') ||
    relative.includes('waking') ||
    relative.includes('breakfast')
  ) {
    return 20;
  }

  // 4. Afternoon
  if (
    period.includes('afternoon') ||
    period.includes('midday') ||
    relative.includes('lunch')
  ) {
    return 30;
  }

  // 5. Evening
  if (
    period.includes('evening') ||
    relative.includes('evening') ||
    relative.includes('wind-down') ||
    relative.includes('dinner')
  ) {
    return 40;
  }

  // 6. Exact time parsing
  if (timingType === 'exact' && habit.time) {
    const timeStr = String(habit.time).toUpperCase().trim();
    if (timeStr.includes('AM')) {
      const match = timeStr.match(/^(\d{1,2})/);
      const hour = match ? parseInt(match[1], 10) : 8;
      if (hour === 12) return 50;
      return 20;
    }
    if (timeStr.includes('PM')) {
      const match = timeStr.match(/^(\d{1,2})/);
      const hour = match ? parseInt(match[1], 10) : 12;
      if (hour === 12 || hour < 5) return 30;
      if (hour < 9) return 40;
      return 50;
    }
  }

  // 7. Default: Flexible / Anytime
  return 10;
}

/**
 * Predictably sort an array of habits based on natural daily timing,
 * with stable secondary tie-breaker on existing order, then title.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function sortHabitsByTiming(a, b) {
  const weightA = getTimingSortWeight(a);
  const weightB = getTimingSortWeight(b);

  if (weightA !== weightB) {
    return weightA - weightB;
  }

  // Preserve existing order as a secondary tie-breaker if present and different
  const orderA = typeof a.order === 'number' ? a.order : 99;
  const orderB = typeof b.order === 'number' ? b.order : 99;
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return (a.title || '').localeCompare(b.title || '');
}
