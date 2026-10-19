/**
 * Domain Schedule Observance & Timezone Resolution.
 * Deterministically resolves logical observance date (04:00 AM grace window).
 */

import { ValidationError } from '../errors.js';

/**
 * Deterministically resolve the logical observance date ('YYYY-MM-DD') for an event.
 * 
 * Observance Window Rule:
 * - Observance day opens at 00:00 local time.
 * - The grace period extends until 04:00:00 AM local time the next morning.
 * - Any event between 00:00 and 03:59:59 AM local time is deterministically attributed
 *   to the PREVIOUS calendar day in the user's anchor timezone.
 * 
 * @param {number|Date|string} timestamp - UTC epoch ms, Date instance, or ISO string
 * @param {string} timezone - Valid IANA timezone identifier (e.g. 'Asia/Kolkata', 'America/New_York')
 * @returns {string} Logical observance date string 'YYYY-MM-DD'
 */
export function resolveObservanceDate(timestamp, timezone = 'UTC') {
  if (!timestamp) {
    throw new ValidationError('Timestamp is required to resolve observance date.');
  }

  const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(dateObj.getTime())) {
    throw new ValidationError(`Invalid timestamp provided: ${timestamp}`);
  }

  const safeTz = isValidTimezone(timezone) ? timezone : 'UTC';

  // Extract wall-clock components in user's anchor timezone
  const parts = getZonedDateParts(dateObj, safeTz);

  // If local hour is before 04:00 AM, the event belongs to previous calendar day's grace window
  if (parts.hour < 4) {
    return subtractOneCalendarDay(parts.year, parts.month, parts.day);
  }

  return formatYearMonthDay(parts.year, parts.month, parts.day);
}

/**
 * Convert a habit creation timestamp to a local calendar date ('YYYY-MM-DD')
 * formatted in the user's anchor timezone.
 * 
 * Strictly avoids blindly slicing UTC ISO strings (toISOString().slice(0, 10)),
 * which causes artificial 1-day date shifts across UTC boundaries.
 * 
 * @param {Object|number|Date|string|null} createdAtTimestamp - Firestore Timestamp, Date, ms, or ISO string
 * @param {string} timezone - Valid IANA timezone identifier
 * @returns {string|null} 'YYYY-MM-DD' or null if timestamp is null/undefined
 */
export function convertTimestampToTrackingDate(createdAtTimestamp, timezone = 'UTC') {
  if (!createdAtTimestamp) return null;

  let dateObj;
  if (typeof createdAtTimestamp.toDate === 'function') {
    dateObj = createdAtTimestamp.toDate();
  } else if (createdAtTimestamp instanceof Date) {
    dateObj = createdAtTimestamp;
  } else if (typeof createdAtTimestamp === 'object' && '_seconds' in createdAtTimestamp) {
    dateObj = new Date(createdAtTimestamp._seconds * 1000);
  } else {
    dateObj = new Date(createdAtTimestamp);
  }

  if (isNaN(dateObj.getTime())) return null;

  const safeTz = isValidTimezone(timezone) ? timezone : 'UTC';
  const parts = getZonedDateParts(dateObj, safeTz);
  return formatYearMonthDay(parts.year, parts.month, parts.day);
}

/**
 * Validate whether a timezone string is recognized by Intl.
 * @param {string} tz 
 * @returns {boolean}
 */
export function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely resolve the user's anchor timezone.
 * Priority:
 * 1. userProfile.preferences.timezone
 * 2. userProfile.timezone
 * 3. Client environment Intl.DateTimeFormat().resolvedOptions().timeZone
 * 4. Fallback 'UTC'
 *
 * @param {Object|string|null} [userProfile] - User profile object or timezone string
 * @returns {string} Valid IANA timezone identifier
 */
export function getUserTimezone(userProfile) {
  if (typeof userProfile === 'string' && isValidTimezone(userProfile)) {
    return userProfile;
  }
  const explicitTz = userProfile?.preferences?.timezone || userProfile?.timezone;
  if (explicitTz && isValidTimezone(explicitTz)) {
    return explicitTz;
  }
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (isValidTimezone(clientTz)) {
        return clientTz;
      }
    }
  } catch {
    // Ignore error in environments where Intl is restricted or fails
  }
  return 'UTC';
}

function getZonedDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = p.value;
    }
  }

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
  };
}

function formatYearMonthDay(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function subtractOneCalendarDay(year, month, day) {
  // Calendar arithmetic using UTC Date container to avoid daylight saving hour skew
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}
