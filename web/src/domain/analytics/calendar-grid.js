/**
 * Pure Domain Calendar Grid & Monthly Analytics Engine.
 *
 * Implements month-based grid generation and monthly summary derivation:
 * - Eligible scheduled occurrences = completed + automatically derived missed occurrences.
 * - Excludes recurring planned rest days, unscheduled days, future dates, and pre-tracking dates.
 * - Respects the 04:00 AM observance window (does not mark today missed while day is in progress).
 * - Monthly completion rate = (Completed / Eligible Scheduled Occurrences) * 100.
 */

import { resolveObservanceDate } from '../schedule/observance.js';
import { deriveTrackingHorizon } from '../schedule/resolution.js';
import { DAY_TO_COLUMN, getContiguousDateRange } from './timeframe.js';
import { evaluateHabitDayScenario } from './truth-table.js';
import { calculateStreak } from '../../utils/analytics-helpers.js';
import {
  getDayOfWeek,
  parseDateString,
} from '../../utils/date-helpers.js';

export { DAY_TO_COLUMN };

/**
 * Calculates complete month-based analytics across all user habits for a specified month.
 *
 * @param {Array<Object>} habits
 * @param {Object} [dailyLogs={}]
 * @param {Object} [options={}]
 * @param {number} [options.year] - e.g. 2026
 * @param {number} [options.month] - 1-12 (e.g. 10 for October)
 * @param {Date|number} [options.now=new Date()]
 * @param {string} [options.timezone='UTC']
 * @returns {Object} MonthlyAnalyticsSummary
 */
export function calculateMonthlyAnalytics(habits = [], dailyLogs = {}, options = {}) {
  const {
    year,
    month,
    now = new Date(),
    timezone = 'UTC',
  } = options;

  const currentObservanceDate = resolveObservanceDate(now, timezone);
  const currentObsDate = parseDateString(currentObservanceDate);

  // If year or month not supplied, default to current observance date's year & month
  const targetYear = typeof year === 'number' ? year : currentObsDate.getFullYear();
  const targetMonth = typeof month === 'number' ? month : (currentObsDate.getMonth() + 1);

  // Contiguous dates in target month
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const contiguousDates = getContiguousDateRange(startDate, endDate);

  // Month title: e.g. "October 2026"
  const sampleDate = new Date(targetYear, targetMonth - 1, 1);
  const monthName = sampleDate.toLocaleString('en-US', { month: 'long' });
  const monthLabel = `${monthName} ${targetYear}`;

  // First day column (0 = Mon, ..., 6 = Sun)
  const firstDow = getDayOfWeek(startDate);
  const firstDayColumn = DAY_TO_COLUMN[firstDow] ?? 0;

  // Derive tracking horizons for all habits
  const logsList = Object.values(dailyLogs);
  const habitHorizons = new Map();
  for (const h of habits) {
    habitHorizons.set(h.id, deriveTrackingHorizon(h, logsList, timezone));
  }

  // Pre-calculate evaluations for all habits across all days in the month
  let totalCompletedOccurrences = 0;
  let totalMissedOccurrences = 0;
  let totalRestOccurrences = 0;

  const evaluationsByHabitAndDate = {};
  for (const h of habits) {
    evaluationsByHabitAndDate[h.id] = {};
  }

  const calendarDays = contiguousDates.map(dateStr => {
    const dow = getDayOfWeek(dateStr);
    const log = dailyLogs[dateStr];
    const isFuture = dateStr > currentObservanceDate;
    const isToday = dateStr === currentObservanceDate;

    let dayCompletedCount = 0;
    let dayMissedCount = 0;
    let dayRestCount = 0;
    let dayInProgressCount = 0;
    let dayRequiredCount = 0;

    const dayEvaluations = [];

    for (const h of habits) {
      const horizon = habitHorizons.get(h.id);
      const ev = evaluateHabitDayScenario(h, dateStr, dow, log, {
        currentObservanceDate,
        trackingHorizon: horizon,
        timezone,
      });

      evaluationsByHabitAndDate[h.id][dateStr] = ev;
      dayEvaluations.push({ habit: h, evaluation: ev });

      if (ev.isScheduled && !ev.isRestDay && ev.scenario !== 7 && ev.scenario !== 8) {
        dayRequiredCount++;
        if (ev.isCompleted) {
          dayCompletedCount++;
          totalCompletedOccurrences++;
        } else if (ev.status === 'in_progress') {
          dayInProgressCount++;
        } else if (ev.status === 'missed' || ev.status === 'skipped') {
          dayMissedCount++;
          totalMissedOccurrences++;
        }
      } else if (ev.isRestDay) {
        dayRestCount++;
        totalRestOccurrences++;
      }
    }

    const isAllRest = dayRequiredCount === 0 && dayRestCount > 0;
    let dayRate = null;
    let isDaySuccess = false;

    if (dayRequiredCount > 0) {
      dayRate = Math.round((dayCompletedCount / dayRequiredCount) * 100);
      if (dayRate >= 50) {
        isDaySuccess = true;
      }
    } else if (isAllRest) {
      dayRate = 100;
      isDaySuccess = true;
    }

    // Indicator status for visual presentation
    let indicatorStatus = 'unscheduled';
    if (isFuture) {
      indicatorStatus = 'future';
    } else if (isToday && dayInProgressCount > 0 && dayCompletedCount < dayRequiredCount) {
      indicatorStatus = 'in_progress';
    } else if (isAllRest) {
      indicatorStatus = 'all_rest';
    } else if (dayRequiredCount > 0) {
      if (dayCompletedCount === dayRequiredCount) {
        indicatorStatus = 'completed';
      } else if (dayRate >= 50) {
        indicatorStatus = 'partial';
      } else {
        indicatorStatus = 'missed';
      }
    }

    return {
      dateStr,
      dayNum: parseDateString(dateStr).getDate(),
      dayOfWeek: dow,
      isFuture,
      isToday,
      isAllRest,
      completedCount: dayCompletedCount,
      missedCount: dayMissedCount,
      restCount: dayRestCount,
      inProgressCount: dayInProgressCount,
      requiredCount: dayRequiredCount,
      dayRate,
      isDaySuccess,
      indicatorStatus,
      evaluations: dayEvaluations,
    };
  });

  const totalEligibleOccurrences = totalCompletedOccurrences + totalMissedOccurrences;
  const monthlyCompletionRate = totalEligibleOccurrences > 0
    ? Math.round((totalCompletedOccurrences / totalEligibleOccurrences) * 100)
    : (totalRestOccurrences > 0 ? 100 : null);

  // Overall streak across all habits
  let streak = 0;
  try {
    streak = calculateStreak(habits, dailyLogs, 60, timezone);
  } catch {}

  return {
    year: targetYear,
    month: targetMonth,
    monthLabel,
    startDate,
    endDate,
    currentObservanceDate,
    firstDayColumn,
    calendarDays,
    summary: {
      monthlyCompletionRate,
      totalCompletedOccurrences,
      totalMissedOccurrences,
      totalRestOccurrences,
      totalEligibleOccurrences,
      currentStreak: streak,
    },
    evaluationsByHabitAndDate,
  };
}
