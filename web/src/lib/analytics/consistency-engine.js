/**
 * Lifetime Consistency Engine for Vritta.
 * Phase 4: Mathematically Defensible Lifetime Analytics Engine
 *
 * Implements:
 * 1. The 8-Scenario Analytics Truth Table (Section 3.9)
 * 2. Dual-Metric Formulation:
 *    - Verified Consistency % = Completed / Recorded Scheduled Days
 *    - Effective Schedule Adherence % = Completed / Total Past Scheduled Days in Horizon
 *    - Historical Coverage Ratio % = Recorded / Total Past Scheduled Days in Horizon
 * 3. Habit-Specific Historical Date Provenance (Section 3.8)
 * 4. User Anchor Timezone & Deterministic 04:00 AM Grace-Period Boundaries (Section 3.10)
 * 5. Non-Punitive Rest-Day Bridging and Ongoing-Day Grace (Section 4.5)
 * 6. Multi-Timeframe Filtering ('7D', '30D', '90D', 'YTD', 'Lifetime', 'Custom')
 *
 * Pure, side-effect-free module safe for Next.js (client/server) and Node test runner.
 */

import {
  isHabitScheduledOnDay,
  isHabitRestDay,
  calculateStreak,
} from '../../utils/analytics-helpers.js';
import {
  resolveObservanceDate,
  convertTimestampToTrackingDate,
  deriveTrackingHorizon,
  evaluateHabitCompletion,
} from '../constants/habit-models.js';
import {
  CATEGORIES,
  CANONICAL_CATEGORIES,
  getCategoryConfig,
} from '../constants/categories.js';
import {
  parseDateString,
  getDateString,
  getDayOfWeek,
} from '../../utils/date-helpers.js';

export const SUPPORTED_TIMEFRAMES = ['7D', '30D', '90D', 'YTD', 'Lifetime', 'Custom'];
export const DAY_TO_COLUMN = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// ============================================================================
// Date & Timeframe Helpers
// ============================================================================

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

// ============================================================================
// 8-Scenario Day Evaluation (Section 3.9)
// ============================================================================

/**
 * Check whether a habit was completed in a given daily log entry.
 * Evaluates completion via:
 * 1. log.habitOutcomes[habitId].status === 'completed'
 * 2. log.completedHabitIds.includes(habitId)
 * 3. evaluateHabitCompletion(habit, log.habitProgress[habitId])
 *
 * @param {Object} habit 
 * @param {Object|Array} dailyLog 
 * @returns {boolean}
 */
export function isHabitCompletedInLog(habit, dailyLog) {
  if (!habit || !habit.id || !dailyLog) return false;

  // 1. Check habitOutcomes explicit outcome
  const outcomeStatus = dailyLog.habitOutcomes?.[habit.id]?.status;
  if (outcomeStatus === 'completed') return true;

  // 2. Check legacy / normalized completedHabitIds array
  const completedIds = Array.isArray(dailyLog)
    ? dailyLog
    : (dailyLog.completedHabitIds || []);
  if (completedIds.includes(habit.id)) return true;

  // 3. Check granular feature completion
  if (dailyLog.habitProgress && dailyLog.habitProgress[habit.id]) {
    try {
      if (evaluateHabitCompletion(habit, dailyLog.habitProgress[habit.id])) {
        return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Evaluates a single habit on a specific date against the 8-Scenario Truth Table.
 *
 * @param {Object} habit - Habit model
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} dayOfWeek - 'Mon', 'Tue', etc.
 * @param {Object|Array} dailyLog - Daily log document data for dateStr
 * @param {Object} [options={}]
 * @param {string} [options.currentObservanceDate] - Today's logical date
 * @param {Object} [options.trackingHorizon] - Pre-derived tracking horizon
 * @param {string} [options.timezone='UTC'] - User timezone
 * @returns {Object} Evaluation outcome
 */
export function evaluateHabitDayScenario(habit, dateStr, dayOfWeek, dailyLog, options = {}) {
  const {
    currentObservanceDate,
    trackingHorizon,
    timezone = 'UTC',
  } = options;

  // Horizon & Date Pre-conditions
  const horizon = trackingHorizon || deriveTrackingHorizon(habit, [], timezone);

  // Scenario 7: Day prior to tracking horizon or horizon unestablished
  if (!horizon.startDate || dateStr < horizon.startDate) {
    return {
      scenario: 7,
      status: 'prior_to_tracking',
      label: 'Prior to Tracking',
      isScheduled: false,
      isRecorded: false,
      isCompleted: false,
      isRestDay: false,
      isPending: false,
      numerator: 0,
      verifiedDenom: 0,
      adherenceDenom: 0,
      streakEffect: 'neutral',
      colorBadge: 'slate-muted',
    };
  }

  // Scenario 8: Dates following habit archive / deletion
  const archiveTimestamp = habit.archivedAt || habit.lifecycle?.archivedAt || habit.deletedAt || habit.lifecycle?.deletedAt;
  if (archiveTimestamp) {
    const archiveDate = convertTimestampToTrackingDate(archiveTimestamp, timezone);
    if (archiveDate && dateStr > archiveDate) {
      return {
        scenario: 8,
        status: 'archived',
        label: 'Archived',
        isScheduled: false,
        isRecorded: false,
        isCompleted: false,
        isRestDay: false,
        isPending: false,
        numerator: 0,
        verifiedDenom: 0,
        adherenceDenom: 0,
        streakEffect: 'neutral',
        colorBadge: 'slate-muted',
      };
    }
  }

  const outcomeStatus = dailyLog?.habitOutcomes?.[habit.id]?.status;

  // Scenario 4: Intentional planned recurring rest day (e.g. Sunday) or date-specific rest day override
  // A planned rest day is a neutral day, not a completion opportunity and not a missed occurrence.
  // It bridges streaks and is excluded from all completion and failure denominators.
  const isRest = isHabitRestDay(habit, dateStr || dayOfWeek, timezone) || outcomeStatus === 'rest';
  if (isRest) {
    return {
      scenario: 4,
      status: 'rest',
      label: outcomeStatus === 'rest' ? 'Rest Day (Override)' : 'Planned Rest',
      isScheduled: true,
      isRecorded: outcomeStatus === 'rest',
      isCompleted: false,
      isMissed: false,
      isRestDay: true,
      isPending: false,
      numerator: 0,
      eligibleDenom: 0,
      verifiedDenom: 0,
      adherenceDenom: 0,
      streakEffect: 'bridges',
      colorBadge: 'amber-blue-recovery',
    };
  }

  // Check recorded status
  const completed = isHabitCompletedInLog(habit, dailyLog);

  // Scenario 1: Scheduled day with recorded completion
  if (completed) {
    return {
      scenario: 1,
      status: 'completed',
      label: 'Completed',
      isScheduled: true,
      isRecorded: true,
      isCompleted: true,
      isMissed: false,
      isRestDay: false,
      isPending: false,
      numerator: 1,
      eligibleDenom: 1,
      verifiedDenom: 1,
      adherenceDenom: 1,
      streakEffect: 'extends',
      colorBadge: 'solid-green',
    };
  }

  // Scenario 2: Scheduled day with explicit recorded non-completion (skipped)
  if (outcomeStatus === 'skipped') {
    return {
      scenario: 2,
      status: 'skipped',
      label: 'Skipped Today',
      isScheduled: true,
      isRecorded: true,
      isCompleted: false,
      isMissed: true,
      isRestDay: false,
      isPending: false,
      numerator: 0,
      eligibleDenom: 1,
      verifiedDenom: 1,
      adherenceDenom: 1,
      streakEffect: 'breaks',
      colorBadge: 'slate-muted',
    };
  }

  // Scenario 2: Scheduled day with explicit recorded non-completion (missed)
  if (outcomeStatus === 'missed') {
    return {
      scenario: 2,
      status: 'missed',
      label: 'Missed',
      isScheduled: true,
      isRecorded: true,
      isCompleted: false,
      isMissed: true,
      isRestDay: false,
      isPending: false,
      numerator: 0,
      eligibleDenom: 1,
      verifiedDenom: 1,
      adherenceDenom: 1,
      streakEffect: 'breaks',
      colorBadge: 'muted-rose-outline',
    };
  }

  // Scenario 5: Day habit was not scheduled
  if (!isHabitScheduledOnDay(habit, dayOfWeek)) {
    return {
      scenario: 5,
      status: 'unscheduled',
      label: 'Unscheduled',
      isScheduled: false,
      isRecorded: false,
      isCompleted: false,
      isMissed: false,
      isRestDay: false,
      isPending: false,
      numerator: 0,
      eligibleDenom: 0,
      verifiedDenom: 0,
      adherenceDenom: 0,
      streakEffect: 'neutral',
      colorBadge: 'slate-dot',
    };
  }

  // Scenario 9: Future dates beyond current observance date
  if (currentObservanceDate && dateStr > currentObservanceDate) {
    return {
      scenario: 9,
      status: 'future',
      label: 'Upcoming',
      isScheduled: true,
      isRecorded: false,
      isCompleted: false,
      isMissed: false,
      isRestDay: false,
      isPending: true,
      numerator: 0,
      eligibleDenom: 0,
      verifiedDenom: 0,
      adherenceDenom: 0,
      streakEffect: 'neutral',
      colorBadge: 'slate-dot',
    };
  }

  // Scenario 6: Current day in progress & Grace Period
  if (currentObservanceDate && dateStr === currentObservanceDate) {
    return {
      scenario: 6,
      status: 'in_progress',
      label: 'In Progress / Grace',
      isScheduled: true,
      isRecorded: false,
      isCompleted: false,
      isMissed: false,
      isRestDay: false,
      isPending: true,
      numerator: 0,
      eligibleDenom: 0,
      verifiedDenom: 0,
      adherenceDenom: 0,
      streakEffect: 'maintains',
      colorBadge: 'cyan-in-progress',
    };
  }

  // Scenario 3: Scheduled day without completion on past closed date
  // Automatically classified as missed (purely derived at runtime, zero DB writes)
  return {
    scenario: 3,
    status: 'missed',
    label: 'Missed',
    isScheduled: true,
    isRecorded: false,
    isCompleted: false,
    isMissed: true,
    isRestDay: false,
    isPending: false,
    numerator: 0,
    eligibleDenom: 1,
    verifiedDenom: 1,
    adherenceDenom: 1,
    streakEffect: 'breaks',
    colorBadge: 'muted-rose-outline',
  };
}

// ============================================================================
// Single Habit Consistency Calculator
// ============================================================================

/**
 * Calculates consistency, streaks, and scenario evaluations for a single habit
 * over a given list of contiguous date strings.
 *
 * @param {Object} habit 
 * @param {Object} [dailyLogs={}] 
 * @param {Object} [options={}]
 * @returns {Object} HabitConsistencyMetrics
 */
export function calculateHabitConsistency(habit, dailyLogs = {}, options = {}) {
  const {
    now = new Date(),
    timezone = 'UTC',
    startDate,
    endDate,
    timeframe = '30D',
  } = options;

  const currentObservanceDate = resolveObservanceDate(now, timezone);

  // Derive tracking horizon
  const logsList = Object.values(dailyLogs);
  const horizon = deriveTrackingHorizon(habit, logsList, timezone);

  // Date range
  let start = startDate;
  let end = endDate;
  if (!start || !end) {
    const range = getTimeframeDateRange(timeframe, { habits: [habit], dailyLogs, now, timezone });
    start = range.startDate;
    end = range.endDate;
  }

  const allDates = getContiguousDateRange(start, end);

  let completedScheduledDays = 0;
  let explicitlyRecordedScheduledDays = 0;
  let totalScheduledPastDays = 0;
  let restDaysCount = 0;
  let unscheduledDaysCount = 0;
  let inProgressDaysCount = 0;
  let unrecordedDaysCount = 0;
  let missedDaysCount = 0;

  const evaluationsByDate = {};

  for (const dStr of allDates) {
    const dow = getDayOfWeek(dStr);
    const log = dailyLogs[dStr];

    const evalResult = evaluateHabitDayScenario(habit, dStr, dow, log, {
      currentObservanceDate,
      trackingHorizon: horizon,
      timezone,
    });

    evaluationsByDate[dStr] = evalResult;

    if (evalResult.scenario === 1) {
      completedScheduledDays++;
      explicitlyRecordedScheduledDays++;
      totalScheduledPastDays++;
    } else if (evalResult.scenario === 2) {
      missedDaysCount++;
      explicitlyRecordedScheduledDays++;
      totalScheduledPastDays++;
    } else if (evalResult.scenario === 3) {
      missedDaysCount++;
      unrecordedDaysCount++;
      explicitlyRecordedScheduledDays++;
      totalScheduledPastDays++;
    } else if (evalResult.scenario === 4) {
      restDaysCount++;
    } else if (evalResult.scenario === 5) {
      unscheduledDaysCount++;
    } else if (evalResult.scenario === 6) {
      inProgressDaysCount++;
    }
  }

  // Dual-Metric Calculations
  const verifiedConsistencyRate = explicitlyRecordedScheduledDays > 0
    ? Math.round((completedScheduledDays / explicitlyRecordedScheduledDays) * 100)
    : null;

  const effectiveAdherenceRate = totalScheduledPastDays > 0
    ? Math.round((completedScheduledDays / totalScheduledPastDays) * 100)
    : null;

  const historicalCoverageRatio = totalScheduledPastDays > 0
    ? Math.round((explicitlyRecordedScheduledDays / totalScheduledPastDays) * 100)
    : null;

  // Streak Calculation:
  // Walk backward from currentObservanceDate (or today) through history
  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  // For longest streak: walk chronologically through all dates
  for (const dStr of allDates) {
    const ev = evaluationsByDate[dStr];
    if (ev.streakEffect === 'extends') {
      runningStreak++;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else if (ev.streakEffect === 'bridges' || ev.streakEffect === 'neutral' || ev.streakEffect === 'maintains') {
      // Streak preserved, not broken
    } else if (ev.streakEffect === 'breaks') {
      runningStreak = 0;
    }
  }

  // For current streak: walk backward from end of date list
  const reversedDates = [...allDates].reverse();
  for (const dStr of reversedDates) {
    const ev = evaluationsByDate[dStr];
    if (ev.streakEffect === 'extends') {
      currentStreak++;
    } else if (ev.streakEffect === 'maintains') {
      // In-progress ongoing day does not break or increment streak
      continue;
    } else if (ev.streakEffect === 'bridges') {
      // Rest day bridges streak
      continue;
    } else if (ev.streakEffect === 'neutral') {
      // Unscheduled or prior to tracking is neutral
      continue;
    } else if (ev.streakEffect === 'breaks') {
      // Broken streak
      break;
    }
  }

  return {
    habitId: habit.id,
    habitTitle: habit.title,
    category: habit.category,
    trackingHorizon: horizon,
    evaluationsByDate,
    counts: {
      completedScheduledDays,
      explicitlyRecordedScheduledDays,
      totalScheduledPastDays,
      restDaysCount,
      unscheduledDaysCount,
      inProgressDaysCount,
      unrecordedDaysCount,
      missedDaysCount,
      totalDaysInRange: allDates.length,
    },
    rates: {
      verifiedConsistencyRate,      // Completed / Explicitly Recorded
      effectiveAdherenceRate,       // Completed / Total Past Scheduled
      historicalCoverageRatio,      // Explicitly Recorded / Total Past Scheduled
    },
    streaks: {
      currentStreak,
      longestStreak,
    },
  };
}

// ============================================================================
// Multi-Habit Lifetime Analytics Engine
// ============================================================================

/**
 * Calculates complete analytics across all user habits for a specified timeframe.
 *
 * @param {Array<Object>} habits 
 * @param {Object} [dailyLogs={}] 
 * @param {Object} [options={}]
 * @returns {Object} ComprehensiveAnalyticsSummary
 */
export function calculateLifetimeAnalytics(habits = [], dailyLogs = {}, options = {}) {
  const {
    now = new Date(),
    timezone = 'UTC',
    timeframe = '30D',
    customStartDate,
    customEndDate,
  } = options;

  const currentObservanceDate = resolveObservanceDate(now, timezone);

  const range = getTimeframeDateRange(timeframe, {
    habits,
    dailyLogs,
    now,
    timezone,
    customStartDate,
    customEndDate,
  });

  const contiguousDates = getContiguousDateRange(range.startDate, range.endDate);

  // Calculate per-habit metrics
  const habitMetricsList = habits.map(h => {
    return calculateHabitConsistency(h, dailyLogs, {
      now,
      timezone,
      startDate: range.startDate,
      endDate: range.endDate,
      timeframe,
    });
  });

  // Aggregate counters across all habits
  let aggCompletedDays = 0;
  let aggRecordedDays = 0;
  let aggTotalPastScheduledDays = 0;
  let aggRestDays = 0;

  for (const hm of habitMetricsList) {
    aggCompletedDays += hm.counts.completedScheduledDays;
    aggRecordedDays += hm.counts.explicitlyRecordedScheduledDays;
    aggTotalPastScheduledDays += hm.counts.totalScheduledPastDays;
    aggRestDays += hm.counts.restDaysCount;
  }

  const aggregateVerifiedConsistency = aggRecordedDays > 0
    ? Math.round((aggCompletedDays / aggRecordedDays) * 100)
    : null;

  const aggregateEffectiveAdherence = aggTotalPastScheduledDays > 0
    ? Math.round((aggCompletedDays / aggTotalPastScheduledDays) * 100)
    : null;

  const aggregateHistoricalCoverage = aggTotalPastScheduledDays > 0
    ? Math.round((aggRecordedDays / aggTotalPastScheduledDays) * 100)
    : null;

  // Day-by-Day Aggregate Rhythm Heatmap
  let daysMetThresholdCount = 0;
  let activeScheduledDaysCount = 0;

  const calendarDays = contiguousDates.map(dateStr => {
    const dow = getDayOfWeek(dateStr);
    const dayHabitEvaluations = habitMetricsList.map(hm => hm.evaluationsByDate[dateStr]);

    // Active scheduled non-rest habits on this day
    const scheduledNonRest = dayHabitEvaluations.filter(e => e.isScheduled && !e.isRestDay && e.scenario !== 7 && e.scenario !== 8);
    const completedCount = scheduledNonRest.filter(e => e.isCompleted).length;
    const skippedCount = scheduledNonRest.filter(e => e.status === 'skipped').length;
    const missedCount = scheduledNonRest.filter(e => e.status === 'missed').length;
    const requiredCount = scheduledNonRest.length;
    const restCount = dayHabitEvaluations.filter(e => e.isRestDay).length;
    const isAllRest = requiredCount === 0 && restCount > 0;
    const isPending = dayHabitEvaluations.some(e => e.isPending);

    let dayRate = null;
    let isDaySuccess = false;

    if (requiredCount > 0) {
      activeScheduledDaysCount++;
      dayRate = Math.round((completedCount / requiredCount) * 100);
      if (dayRate >= 50) {
        isDaySuccess = true;
        daysMetThresholdCount++;
      }
    } else if (isAllRest) {
      dayRate = 100;
      isDaySuccess = true;
    }

    return {
      dateStr,
      dayNum: parseDateString(dateStr).getDate(),
      dayOfWeek: dow,
      completedCount,
      requiredCount,
      restCount,
      skippedCount,
      missedCount,
      isAllRest,
      isPending,
      dayRate,
      isDaySuccess,
    };
  });

  // Calculate Overall Streak across all routines using supportive 50% threshold
  let overallCurrentStreak = 0;
  let overallLongestStreak = 0;
  let runningOverallStreak = 0;

  for (const day of calendarDays) {
    if (day.isDaySuccess) {
      runningOverallStreak++;
      if (runningOverallStreak > overallLongestStreak) overallLongestStreak = runningOverallStreak;
    } else if (day.isPending) {
      // Maintains streak
    } else if (day.requiredCount === 0) {
      // Pure rest / unscheduled bridges streak
    } else {
      runningOverallStreak = 0;
    }
  }

  const reversedCalendar = [...calendarDays].reverse();
  for (const day of reversedCalendar) {
    if (day.isDaySuccess) {
      overallCurrentStreak++;
    } else if (day.isPending) {
      continue;
    } else if (day.requiredCount === 0) {
      continue;
    } else {
      break;
    }
  }

  // Group by Canonical Categories
  const categoryMap = new Map();

  for (let i = 0; i < habits.length; i++) {
    const h = habits[i];
    const hm = habitMetricsList[i];
    const catName = h.category || 'Other';

    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, {
        category: catName,
        habits: [],
        completedDays: 0,
        recordedDays: 0,
        totalScheduledDays: 0,
        hasRestProtection: false,
      });
    }

    const catData = categoryMap.get(catName);
    catData.habits.push({ habit: h, metrics: hm });
    catData.completedDays += hm.counts.completedScheduledDays;
    catData.recordedDays += hm.counts.explicitlyRecordedScheduledDays;
    catData.totalScheduledDays += hm.counts.totalScheduledPastDays;
    if (hm.counts.restDaysCount > 0) catData.hasRestProtection = true;
  }

  const categories = Array.from(categoryMap.values()).map(c => {
    const config = getCategoryConfig(c.category);
    const verifiedConsistency = c.recordedDays > 0
      ? Math.round((c.completedDays / c.recordedDays) * 100)
      : null;
    const effectiveAdherence = c.totalScheduledDays > 0
      ? Math.round((c.completedDays / c.totalScheduledDays) * 100)
      : null;
    const coverage = c.totalScheduledDays > 0
      ? Math.round((c.recordedDays / c.totalScheduledDays) * 100)
      : null;

    return {
      category: c.category,
      label: config.label,
      iconName: config.iconName,
      badgeClasses: config.badgeClasses,
      textColor: config.textColor,
      bgColor: config.bgColor,
      borderColor: config.borderColor,
      habitCount: c.habits.length,
      completedDays: c.completedDays,
      recordedDays: c.recordedDays,
      totalScheduledDays: c.totalScheduledDays,
      verifiedConsistency,
      effectiveAdherence,
      coverage,
      hasRestProtection: c.hasRestProtection,
      habits: c.habits,
    };
  });

  return {
    timeframe: range.timeframe,
    timeframeLabel: range.label,
    startDate: range.startDate,
    endDate: range.endDate,
    currentObservanceDate,
    timezone,
    aggregate: {
      completedActivities: aggCompletedDays,
      recordedActivities: aggRecordedDays,
      totalScheduledActivities: aggTotalPastScheduledDays,
      verifiedConsistencyRate: aggregateVerifiedConsistency,
      effectiveAdherenceRate: aggregateEffectiveAdherence,
      historicalCoverageRatio: aggregateHistoricalCoverage,
      overallCurrentStreak,
      overallLongestStreak,
      daysMetThresholdCount,
      activeScheduledDaysCount,
    },
    calendarDays,
    categories,
    habits: habitMetricsList,
  };
}

// ============================================================================
// Month-Based Calendar Analytics Engine
// ============================================================================

/**
 * Calculates complete month-based analytics across all user habits for a specified month.
 * Simplified Completion Model:
 * - Eligible scheduled occurrences = completed + automatically derived missed occurrences.
 * - Excludes recurring planned rest days, unscheduled days, future dates, and pre-tracking dates.
 * - Does not count today as missed before 04:00 AM observance close.
 * - Monthly completion rate = (Completed / Eligible Scheduled Occurrences) * 100.
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
