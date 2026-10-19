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

import {
  getTimingDisplay,
  getFrequencyDisplay,
  sortHabits,
} from '../domain/habits/formatters.js';

export { getTimingDisplay, getFrequencyDisplay, sortHabits };

