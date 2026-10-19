/**
 * Pure Analytics & Scheduling Utility Functions for Vritta.
 *
 * Centralizes:
 * 1. Schedule recurrence evaluation (habit.frequency)
 * 2. Planned rest day detection (metadata.restDays & canonical movement fallback)
 * 3. Daily completion rate and denominator calculations
 * 4. Non-punitive 50% streak calculation with ongoing-day grace
 * 5. Dynamic category & domain-level consistency highlights
 *
 * Pure functions with zero side-effects, safely executable in both
 * Next.js browser/server environments and Node.js test runners.
 */

import { getCategoryConfig } from '../lib/constants/categories.js';
import { getDateString, getDaysAgo, getDayOfWeek } from './date-helpers.js';
import {
  resolveObservanceDate,
  evaluateHabitCompletion,
  isHabitRestDay,
  isHabitScheduledOnDay,
  isHabitRequiredOnDay,
  getEffectiveSchedule,
  getEffectiveScheduleForDate,
  getUserTimezone,
} from '../domain/index.js';

export {
  isHabitScheduledOnDay,
  isHabitRequiredOnDay,
  isHabitRestDay,
  getEffectiveSchedule,
  getEffectiveScheduleForDate,
  getUserTimezone,
};

/**
 * Calculates completion metrics for a single date.
 *
 * Supportive Non-Punitive Rules:
 * - Unscheduled habits are omitted from both numerator and denominator.
 * - Planned rest days are omitted from the required denominator.
 * - If all scheduled habits for the day are in planned rest, rate is 100% and isAllRest is true.
 * - If no habits are scheduled at all, rate is null.
 *
 * @param {Array} habits - All user habits
 * @param {Array} completedHabitIds - IDs completed on this date
 * @param {string} dayOfWeek - Short day name
 * @returns {Object} { rate, isAllRest, scheduledCount, requiredCount, completedCount, hasPlannedRest, restCount, isRestDay, isSunday }
 */
export function calculateDayMetrics(habits = [], completedHabitIds = [], dayOfWeek = 'Mon') {
  const activeHabits = (habits || []).filter(h => isHabitScheduledOnDay(h, dayOfWeek));

  if (activeHabits.length === 0) {
    return {
      rate: null,
      isAllRest: true,
      scheduledCount: 0,
      requiredCount: 0,
      completedCount: 0,
      hasPlannedRest: false,
      restCount: 0,
      isRestDay: false,
      isSunday: dayOfWeek === 'Sun',
    };
  }

  const requiredHabits = activeHabits.filter(h => !isHabitRestDay(h, dayOfWeek));
  const restHabits = activeHabits.filter(h => isHabitRestDay(h, dayOfWeek));

  if (requiredHabits.length === 0) {
    return {
      rate: 100,
      isAllRest: true,
      scheduledCount: 0,
      requiredCount: 0,
      completedCount: 0,
      hasPlannedRest: restHabits.length > 0,
      restCount: restHabits.length,
      isRestDay: true,
      isSunday: dayOfWeek === 'Sun',
    };
  }

  const completedIds = Array.isArray(completedHabitIds) ? completedHabitIds : [];
  const completedRequired = requiredHabits.filter(h => completedIds.includes(h.id)).length;
  const rate = Math.round((completedRequired / requiredHabits.length) * 100);

  return {
    rate,
    isAllRest: false,
    scheduledCount: requiredHabits.length,
    requiredCount: requiredHabits.length, // Alias for backward compatibility
    completedCount: completedRequired,
    hasPlannedRest: restHabits.length > 0,
    restCount: restHabits.length,
    isRestDay: restHabits.length > 0 && dayOfWeek === 'Sun',
    isSunday: dayOfWeek === 'Sun',
  };
}

/**
 * Calculates current streak across recent history (default 30 days).
 *
 * Rules:
 * - A successful day requires >= 50% completion of scheduled, non-rest activities.
 * - Pure rest days (no required activities) do NOT break a streak.
 * - Today (i=0) is granted a grace period if not yet completed.
 * - Earlier days with < 50% completion break the streak.
 *
 * @param {Array} habits - All user habits
 * @param {Object} dailyLogs - Map of dateStr -> completedHabitIds[] or { completedHabitIds, habitProgress }
 * @param {number} maxDays - Window size (default: 30)
 * @returns {number} Current streak count
 */
export function calculateStreak(habits = [], dailyLogs = {}, maxDays = 30, timezone = 'UTC') {
  if (!habits || habits.length === 0) return 0;

  let currentStreak = 0;
  let currentObservance = null;
  try {
    currentObservance = resolveObservanceDate(new Date(), timezone);
  } catch {
    currentObservance = getDateString(new Date());
  }

  for (let i = 0; i < maxDays; i++) {
    const checkDate = getDaysAgo(i);
    const dateStr = getDateString(checkDate);
    const dayOfWeekForDate = getDayOfWeek(checkDate);

    const activeHabits = habits.filter(h => isHabitScheduledOnDay(h, dayOfWeekForDate));
    const requiredHabits = activeHabits.filter(h => !isHabitRestDay(h, dayOfWeekForDate));

    // Pure rest days or unscheduled days do not break a streak
    if (requiredHabits.length === 0) continue;

    const logEntry = dailyLogs[dateStr];
    const completedList = Array.isArray(logEntry)
      ? logEntry
      : (logEntry?.completedHabitIds || []);
    const outcomes = (!Array.isArray(logEntry) && logEntry?.habitOutcomes) || {};
    const habitProgress = (!Array.isArray(logEntry) && logEntry?.habitProgress) || {};

    const completedCount = requiredHabits.filter(h => {
      if (outcomes[h.id]?.status === 'completed') return true;
      if (completedList.includes(h.id)) return true;
      if (habitProgress[h.id]) {
        try {
          if (evaluateHabitCompletion(h, habitProgress[h.id])) return true;
        } catch {}
      }
      return false;
    }).length;

    const completionRate = completedCount / requiredHabits.length;

    // Vritta's supportive 50% threshold
    if (completionRate >= 0.5) {
      currentStreak++;
    } else if (i === 0 || dateStr >= currentObservance) {
      // Grace period for ongoing current day or active grace window
      continue;
    } else {
      break;
    }
  }

  return currentStreak;
}

/**
 * Dynamically computes category-level and habit-level consistency highlights
 * from the user's actual routines and daily logs over a multi-day window (default 30 days).
 *
 * @param {Array} habits - User habits
 * @param {Object} dailyLogs - Daily log records
 * @param {number} daysWindow - Days to analyze (default: 30)
 * @returns {Object} { totalActiveDays, completedDays, totalCompletions, avgRate, daysWithMetrics, categories, habitStats }
 */
export function calculateDynamicAnalytics(habits = [], dailyLogs = {}, daysWindow = 30) {
  if (!habits || habits.length === 0) {
    return {
      totalActiveDays: 0,
      completedDays: 0,
      totalCompletions: 0,
      avgRate: 0,
      daysWithMetrics: [],
      categories: [],
      habitStats: {},
    };
  }

  // 1. Generate window of days in chronological order
  const windowDays = Array.from({ length: daysWindow }, (_, i) => {
    const date = getDaysAgo(i);
    const dateStr = getDateString(date);
    const dayOfWeek = getDayOfWeek(date);
    return {
      date,
      dateStr,
      dayOfWeek,
      dayNum: date.getDate(),
    };
  }).reverse();

  let totalActiveDays = 0;
  let completedDays = 0;
  let totalCompletions = 0;

  // Initialize per-habit tracking
  const habitStats = {};
  habits.forEach(h => {
    habitStats[h.id] = {
      id: h.id,
      title: h.title,
      category: h.category || 'General',
      completionMethod: h.completionMethod,
      scheduledDays: 0,
      completedDays: 0,
      totalUnits: 0, // e.g. workbook sessions
      workoutDays: 0,
      walkDays: 0,
    };
  });

  // Calculate day-by-day metrics across the window
  const daysWithMetrics = windowDays.map(item => {
    const logEntry = dailyLogs[item.dateStr];
    const completedIds = Array.isArray(logEntry)
      ? logEntry
      : (logEntry?.completedHabitIds || []);
    const habitProgress = (!Array.isArray(logEntry) && logEntry?.habitProgress) || {};

    const metrics = calculateDayMetrics(habits, completedIds, item.dayOfWeek);

    if (metrics.scheduledCount > 0) {
      totalActiveDays++;
      if (metrics.rate >= 50) {
        completedDays++;
      }
      totalCompletions += metrics.completedCount;
    }

    // Accumulate individual habit performance
    habits.forEach(h => {
      const statsObj = habitStats[h.id];
      if (!statsObj) return;

      const isScheduled = isHabitScheduledOnDay(h, item.dayOfWeek);
      const isRest = isHabitRestDay(h, item.dayOfWeek);

      if (isScheduled && !isRest) {
        statsObj.scheduledDays++;
      }

      const isDone = completedIds.includes(h.id);
      const prog = habitProgress[h.id] || {};

      if (isDone) {
        statsObj.completedDays++;
      }

      // Domain-specific unit handling
      if (h.completionMethod === 'workbook_sessions' || h.category === 'English Learning' || h.category === 'Learning & Growth') {
        const sessions = prog.sessionsCompleted || (isDone ? 2 : 0);
        statsObj.totalUnits += sessions;
      } else if (h.completionMethod === 'exercise_plan' || h.category === 'Movement & Strength' || h.category === 'Health & Fitness') {
        if (isDone) {
          if (['Mon', 'Wed', 'Fri'].includes(item.dayOfWeek)) {
            statsObj.workoutDays++;
          } else if (['Tue', 'Thu', 'Sat'].includes(item.dayOfWeek)) {
            statsObj.walkDays++;
          }
        }
      }
    });

    return {
      ...item,
      metrics,
    };
  });

  const avgRate = totalActiveDays > 0 ? Math.round((completedDays / totalActiveDays) * 100) : 0;

  // 2. Aggregate into dynamic category highlights based on actual user routines
  const categoryMap = new Map();

  habits.forEach(h => {
    const catKey = h.category || 'General';
    if (!categoryMap.has(catKey)) {
      categoryMap.set(catKey, {
        category: catKey,
        habits: [],
        hasRestProtection: false,
        totalCompletions: 0,
        scheduledDaysCount: 0,
        workbookSessionsTotal: 0,
        workoutDaysTotal: 0,
        walkDaysTotal: 0,
      });
    }

    const group = categoryMap.get(catKey);
    group.habits.push(h);

    if (isHabitRestDay(h, 'Sun') || (Array.isArray(h.metadata?.restDays) && h.metadata.restDays.length > 0)) {
      group.hasRestProtection = true;
    }

    const hStat = habitStats[h.id];
    if (hStat) {
      group.totalCompletions += hStat.completedDays;
      group.workbookSessionsTotal += hStat.totalUnits;
      group.workoutDaysTotal += hStat.workoutDays;
      group.walkDaysTotal += hStat.walkDays;
      group.scheduledDaysCount = Math.max(group.scheduledDaysCount, hStat.scheduledDays);
    }
  });

  const categories = Array.from(categoryMap.values()).map(cat => {
    const config = getCategoryConfig(cat.category);
    let metricValue = cat.totalCompletions;
    let metricUnit = cat.totalCompletions === 1 ? 'activity logged' : 'activities logged';
    let detailText = '';
    let badge = null;

    if (cat.hasRestProtection) {
      badge = 'Sunday Rest Protected';
    }

    const firstHabit = cat.habits[0];
    const isSingleHabit = cat.habits.length === 1;

    if (cat.category === 'English Learning' || cat.category === 'Learning & Growth' || firstHabit?.completionMethod === 'workbook_sessions') {
      metricValue = cat.workbookSessionsTotal || cat.totalCompletions;
      metricUnit = 'sessions logged';
      detailText = isSingleHabit ? firstHabit.title : `${cat.habits.length} study routines`;
    } else if (cat.category === 'Movement & Strength' || cat.category === 'Health & Fitness' || firstHabit?.completionMethod === 'exercise_plan') {
      metricValue = cat.totalCompletions;
      metricUnit = 'sessions completed';
      if (cat.workoutDaysTotal > 0 || cat.walkDaysTotal > 0) {
        detailText = `${cat.workoutDaysTotal} strength workouts • ${cat.walkDaysTotal} walk days`;
      } else {
        detailText = isSingleHabit ? firstHabit.title : `${cat.habits.length} movement routines`;
      }
    } else if (cat.category === 'Listening & Awareness' || cat.category === 'Mindfulness & Spirit' || firstHabit?.completionMethod === 'osho_listening') {
      metricValue = cat.totalCompletions;
      metricUnit = 'days listened';
      detailText = isSingleHabit ? firstHabit.title : `${cat.habits.length} listening routines`;
    } else if (cat.category === 'Reading' || firstHabit?.completionMethod === 'reading_duration') {
      metricValue = cat.totalCompletions;
      metricUnit = 'evenings read';
      detailText = isSingleHabit ? firstHabit.title : `${cat.habits.length} reading routines`;
    } else {
      detailText = isSingleHabit
        ? firstHabit.title
        : `${cat.habits.length} active routines (${cat.habits.map(h => h.title).slice(0, 2).join(', ')}${cat.habits.length > 2 ? '...' : ''})`;
    }

    const rate = cat.scheduledDaysCount > 0
      ? Math.round((cat.totalCompletions / cat.scheduledDaysCount) * 100)
      : (cat.totalCompletions > 0 ? 100 : 0);

    return {
      category: cat.category,
      label: config.label,
      iconName: config.iconName,
      badgeClasses: config.badgeClasses,
      textColor: config.textColor,
      bgColor: config.bgColor,
      borderColor: config.borderColor,
      habits: cat.habits.map(h => ({
        ...h,
        stats: habitStats[h.id] || null,
      })),
      habitCount: cat.habits.length,
      totalCompletions: cat.totalCompletions,
      metricValue,
      metricUnit,
      detailText,
      badge,
      rate,
      scheduledDays: cat.scheduledDaysCount,
      hasRestProtection: cat.hasRestProtection,
      restDaysLabel: badge || 'Rest Protected',
    };
  });

  return {
    totalActiveDays,
    completedDays,
    totalCompletions,
    avgRate,
    daysWithMetrics,
    categories,
    habitStats,
  };
}
