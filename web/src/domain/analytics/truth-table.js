/**
 * Pure Domain Analytics Truth Table Evaluator.
 *
 * Implements the 8-Scenario Analytics Truth Table (Section 3.9) along with
 * future/pending state classifications. Evaluates habit outcomes into canonical
 * numerators, verified/adherence denominators, streak effects, and badges.
 */

import {
  isHabitScheduledOnDay,
  isHabitRestDay,
  convertTimestampToTrackingDate,
  deriveTrackingHorizon,
} from '../schedule/index.js';
import { evaluateHabitCompletion } from '../habits/index.js';

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
