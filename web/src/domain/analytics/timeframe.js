/**
 * Pure Domain Timeframe and Date Range Calculations.
 *
 * Implements deterministic boundary resolution for supported analytical horizons
 * ('7D', '30D', '90D', 'YTD', 'Lifetime', 'Custom') respecting the user's anchor
 * timezone and 04:00 AM observance window.
 */

import { resolveObservanceDate } from '../schedule/observance.js';
import { deriveTrackingHorizon } from '../schedule/resolution.js';
import {
  parseDateString,
  getDateString,
} from '../../utils/date-helpers.js';

export const SUPPORTED_TIMEFRAMES = ['7D', '30D', '90D', 'YTD', 'Lifetime', 'Custom'];
export const DAY_TO_COLUMN = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/**
 * Format a Date object as 'YYYY-MM-DD' in a specified timezone.
 *
 * @param {Date} dateObj 
 * @param {string} timezone 
 * @returns {string} 'YYYY-MM-DD'
 */
export function formatDateInTimezone(dateObj, timezone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

/**
 * Generates an array of contiguous 'YYYY-MM-DD' string dates between startDate and endDate (inclusive).
 *
 * @param {string} startDateStr - 'YYYY-MM-DD'
 * @param {string} endDateStr - 'YYYY-MM-DD'
 * @returns {string[]} Array of date strings in ascending order
 */
export function getContiguousDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return [];
  if (startDateStr > endDateStr) return [];

  const dates = [];
  const start = parseDateString(startDateStr);
  const end = parseDateString(endDateStr);

  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0);
  const target = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0);

  while (current <= target) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Derives start and end dates for a given timeframe identifier.
 *
 * @param {string} timeframe - '7D' | '30D' | '90D' | 'YTD' | 'Lifetime' | 'Custom'
 * @param {Object} options
 * @param {Array<Object>} [options.habits=[]] - Habits to derive lifetime tracking horizon
 * @param {Object} [options.dailyLogs={}] - Daily logs map
 * @param {Date|number} [options.now=new Date()] - Reference point in time
 * @param {string} [options.timezone='UTC'] - User anchor timezone
 * @param {string} [options.customStartDate] - Start date for 'Custom' timeframe
 * @param {string} [options.customEndDate] - End date for 'Custom' timeframe
 * @returns {Object} { startDate: string, endDate: string, timeframe: string, label: string }
 */
export function getTimeframeDateRange(timeframe = '30D', options = {}) {
  const {
    habits = [],
    dailyLogs = {},
    now = new Date(),
    timezone = 'UTC',
    customStartDate,
    customEndDate,
  } = options;

  const currentObservance = resolveObservanceDate(now, timezone);
  const currentObsDate = parseDateString(currentObservance);

  if (timeframe === 'Custom') {
    const sDate = customStartDate || currentObservance;
    const eDate = customEndDate || currentObservance;
    return {
      timeframe: 'Custom',
      startDate: sDate <= eDate ? sDate : eDate,
      endDate: sDate <= eDate ? eDate : sDate,
      label: 'Custom Range',
    };
  }

  if (timeframe === '7D') {
    const startObj = new Date(currentObsDate.getFullYear(), currentObsDate.getMonth(), currentObsDate.getDate() - 6, 12, 0, 0);
    const startDate = getDateString(startObj);
    return {
      timeframe: '7D',
      startDate,
      endDate: currentObservance,
      label: 'Last 7 Days',
    };
  }

  if (timeframe === '90D') {
    const startObj = new Date(currentObsDate.getFullYear(), currentObsDate.getMonth(), currentObsDate.getDate() - 89, 12, 0, 0);
    const startDate = getDateString(startObj);
    return {
      timeframe: '90D',
      startDate,
      endDate: currentObservance,
      label: 'Last 90 Days',
    };
  }

  if (timeframe === 'YTD') {
    const currentYear = currentObsDate.getFullYear();
    const startDate = `${currentYear}-01-01`;
    return {
      timeframe: 'YTD',
      startDate,
      endDate: currentObservance,
      label: `${currentYear} Year to Date`,
    };
  }

  if (timeframe === 'Lifetime') {
    // Find earliest tracking horizon or earliest verified activity date across habits
    let earliestDate = null;
    const logsList = Object.values(dailyLogs);

    for (const h of habits) {
      const horizon = deriveTrackingHorizon(h, logsList, timezone);
      if (horizon.startDate) {
        if (!earliestDate || horizon.startDate < earliestDate) {
          earliestDate = horizon.startDate;
        }
      }
    }

    // Fallback: if no habit tracking horizon established, default to 365 days prior
    if (!earliestDate) {
      const startObj = new Date(currentObsDate.getFullYear() - 1, currentObsDate.getMonth(), currentObsDate.getDate(), 12, 0, 0);
      earliestDate = getDateString(startObj);
    }

    return {
      timeframe: 'Lifetime',
      startDate: earliestDate <= currentObservance ? earliestDate : currentObservance,
      endDate: currentObservance,
      label: 'All-Time Lifetime',
    };
  }

  // Default: '30D'
  const startObj = new Date(currentObsDate.getFullYear(), currentObsDate.getMonth(), currentObsDate.getDate() - 29, 12, 0, 0);
  const startDate = getDateString(startObj);
  return {
    timeframe: '30D',
    startDate,
    endDate: currentObservance,
    label: 'Last 30 Days',
  };
}
