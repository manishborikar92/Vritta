/**
 * Pure Domain Habit and Lifetime Consistency Calculations.
 *
 * Implements:
 * 1. Single habit consistency, streaks, and dual-metric rates:
 *    - Verified Consistency Rate = Completed / Explicitly Recorded
 *    - Effective Adherence Rate = Completed / Total Past Scheduled
 *    - Historical Coverage Ratio = Explicitly Recorded / Total Past Scheduled
 * 2. Multi-habit aggregate lifetime analytics with canonical category groupings,
 *    heatmaps, and supportive non-punitive overall streaks.
 */

import { resolveObservanceDate } from '../schedule/observance.js';
import { deriveTrackingHorizon } from '../schedule/resolution.js';
import { getTimeframeDateRange, getContiguousDateRange } from './timeframe.js';
import { evaluateHabitDayScenario } from './truth-table.js';
import { getCategoryConfig } from '../../lib/constants/categories.js';
import {
  getDayOfWeek,
  parseDateString,
} from '../../utils/date-helpers.js';

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
