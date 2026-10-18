/**
 * Canonical Composable Habit & Daily Log Models, Validators, and Date Helpers.
 * Phase 1: Universal Domain & Database Foundation
 * 
 * Defines:
 * - Composable Habit Model & feature slot schemas
 * - Daily Log Model with 3-layer outcome architecture (persisted vs normalized vs derived)
 * - Effective-dated Schedule History for historical preservation
 * - Deterministic Timezone and Observance Date resolution (04:00 AM grace window)
 * - Strict validation and habit-specific historical date provenance
 */

import { CATEGORIES, CANONICAL_CATEGORIES, isValidCategory, isValidCustomCategory } from './categories.js';
import { WORKOUT_EXERCISES, WALK_DAY_ROUTINE } from '../fixtures/exercise-plan.js';
import { getDayOfWeek } from '../../utils/date-helpers.js';

export { CATEGORIES, CANONICAL_CATEGORIES, isValidCategory, isValidCustomCategory };

// ============================================================================
// Enums & Domain Constants
// ============================================================================

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const TIMING_TYPES = ['anytime', 'preferred_period', 'relative', 'exact'];

export const PREFERRED_PERIODS = ['Morning', 'Afternoon', 'Evening', 'Night'];

/**
 * Strict enum for persisted habit outcomes in Firestore (/dailyLogs/{id}.habitOutcomes).
 * Persisted outcomes MUST ONLY represent explicit recorded actions.
 */
export const PERSISTED_OUTCOME_STATUSES = ['completed', 'skipped', 'missed'];

/**
 * Full domain enum for resolved habit outcomes (including runtime/derived states).
 */
export const DOMAIN_OUTCOME_STATUSES = ['completed', 'skipped', 'missed', 'unrecorded'];

/**
 * 4-tier habit-specific historical date provenance classifications.
 */
export const PROVENANCE_STATUSES = [
  'verified_creation',   // Tier 1: Authoritative createdAt, no logs precede it
  'verified_first_log',  // Tier 2: Habit-specific log precedes createdAt (re-seeded)
  'inferred_activity',   // Tier 3: Lacks createdAt, anchored to earliest habit log
  'unverifiable',        // Tier 4: Lacks createdAt and zero habit logs (horizon is null)
];

/**
 * Canonical alias for provenance status tiers matching plan specification.
 */
export const PROVENANCE_TIERS = PROVENANCE_STATUSES;

/**
 * The six canonical feature slots approved for composable habits.
 * Sub-habits or other unauthorized features are strictly prohibited.
 */
export const APPROVED_FEATURE_SLOTS = [
  'counter',
  'timer',
  'checklist',
  'notes',
  'catalog',
  'daySchedule',
];

export const SEED_ORIGINS = [
  'custom',
  'template',
  'personal_preset',
  'foundation_preset',
];

// ============================================================================
// Domain Errors
// ============================================================================

export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// ============================================================================
// Date & Timezone Pure Helpers
// ============================================================================

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

// ============================================================================
// Effective-Dated Schedule History
// ============================================================================

/**
 * Create a new schedule history entry.
 * @param {Object} schedule - Schedule object
 * @param {string} effectiveDate - 'YYYY-MM-DD' when this schedule takes effect
 * @returns {Object} Canonical ScheduleHistoryEntry
 */
export function createScheduleHistoryEntry(schedule, effectiveDate) {
  if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new ValidationError(`Valid effectiveDate ('YYYY-MM-DD') required for schedule history, received: ${effectiveDate}`);
  }

  const frequency = Array.isArray(schedule.frequency) ? [...schedule.frequency] : [...WEEKDAYS];
  const restDays = Array.isArray(schedule.restDays) ? [...schedule.restDays] : [];

  return {
    effectiveDate,
    frequency,
    restDays,
    timingType: schedule.timingType || 'anytime',
    preferredPeriod: schedule.preferredPeriod || null,
    relativeTiming: schedule.relativeTiming || null,
    exactTime: schedule.exactTime || null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Retrieve the authoritative effective schedule for a habit on a specific calendar date,
 * timestamp, or observance.
 * 
 * Invariants:
 * 1. Evaluates `scheduleHistory` entries where `effectiveDate <= targetDate`,
 *    returning the latest applicable entry with `source: 'schedule_history'`.
 * 2. If targetDate precedes all history entries (before the earliest recorded schedule change),
 *    returns the earliest history entry (baseline schedule) with `source: 'schedule_history_baseline'`
 *    to prevent future schedule updates from retroactively rewriting historical expectations.
 * 3. If scheduleHistory is empty or absent, returns the habit's current canonical schedule (`source: 'current_schedule'`).
 * 4. Missing or malformed history (e.g. non-array, or entries missing effectiveDate or frequency)
 *    is handled deliberately with a ValidationError rather than silently hiding scheduling corruption.
 * 5. Handles input forms deterministically:
 *    - Date string 'YYYY-MM-DD'
 *    - Weekday name ('Mon'..'Sun') -> resolves to current schedule
 *    - Date instance or timestamp -> resolves to observance date using user anchor timezone and 04:00 AM window
 *    - null/undefined -> resolves to current schedule
 * 
 * @param {Object} habit - ComposableHabitModel or habit document
 * @param {string|Date|number|null} [dateOrTimestampOrWeekday=null] - Calendar date ('YYYY-MM-DD'), Date, timestamp, or weekday ('Mon'..'Sun')
 * @param {string} [timezone='UTC'] - User anchor timezone for observance resolution if timestamp/Date provided
 * @returns {Object} Effective schedule object active on the target date
 */
export function getEffectiveSchedule(habit, dateOrTimestampOrWeekday = null, timezone = 'UTC') {
  if (!habit || typeof habit !== 'object') {
    throw new ValidationError('Valid habit object is required to resolve effective schedule.');
  }

  // Validate schedule existence (support legacy un-normalized objects with frequency)
  let baseSchedule = habit.schedule;
  if (!baseSchedule || typeof baseSchedule !== 'object') {
    if (Array.isArray(habit.frequency)) {
      baseSchedule = {
        frequency: [...habit.frequency],
        restDays: Array.isArray(habit.metadata?.restDays)
          ? [...habit.metadata.restDays]
          : (Array.isArray(habit.restDays) ? [...habit.restDays] : []),
        timingType: habit.timingType || 'anytime',
        preferredPeriod: habit.preferredPeriod || null,
        relativeTiming: habit.relativeTiming || null,
        exactTime: habit.time && habit.time !== 'Flexible' ? habit.time : null,
      };
    } else {
      throw new ValidationError('Habit schedule is required to resolve effective schedule.');
    }
  }

  // Validate scheduleHistory structure if present
  if (habit.scheduleHistory !== undefined && habit.scheduleHistory !== null && !Array.isArray(habit.scheduleHistory)) {
    throw new ValidationError('Habit scheduleHistory must be an array when present.');
  }

  // Resolve target calendar date ('YYYY-MM-DD') from input
  let targetDate = null;
  if (typeof dateOrTimestampOrWeekday === 'string') {
    if (WEEKDAYS.includes(dateOrTimestampOrWeekday)) {
      // Weekday name does not identify a calendar date; falls back to current schedule
      targetDate = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrTimestampOrWeekday)) {
      targetDate = dateOrTimestampOrWeekday;
    } else {
      targetDate = resolveObservanceDate(dateOrTimestampOrWeekday, timezone);
    }
  } else if (dateOrTimestampOrWeekday instanceof Date || typeof dateOrTimestampOrWeekday === 'number') {
    targetDate = resolveObservanceDate(dateOrTimestampOrWeekday, timezone);
  }

  const history = Array.isArray(habit.scheduleHistory) ? habit.scheduleHistory : [];

  if (history.length > 0) {
    // Validate all history entries deliberately
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      if (!entry || typeof entry !== 'object' || !entry.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(entry.effectiveDate)) {
        throw new ValidationError(`Malformed scheduleHistory entry at index ${i}: missing or invalid effectiveDate.`);
      }
      if (!Array.isArray(entry.frequency)) {
        throw new ValidationError(`Malformed scheduleHistory entry at index ${i}: frequency must be an array.`);
      }
    }

    if (targetDate) {
      // Sort ascending by effectiveDate
      const sorted = [...history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

      // Find the latest entry that took effect on or before targetDate
      let matchingEntry = null;
      for (const entry of sorted) {
        if (entry.effectiveDate <= targetDate) {
          matchingEntry = entry;
        } else {
          break;
        }
      }

      if (matchingEntry) {
        return {
          frequency: [...matchingEntry.frequency],
          restDays: [...(matchingEntry.restDays || [])],
          timingType: matchingEntry.timingType || 'anytime',
          preferredPeriod: matchingEntry.preferredPeriod || null,
          relativeTiming: matchingEntry.relativeTiming || null,
          exactTime: matchingEntry.exactTime || null,
          source: 'schedule_history',
          effectiveDate: matchingEntry.effectiveDate,
        };
      }

      // If targetDate precedes all history entries (before the earliest recorded change),
      // the baseline schedule active from the beginning is the earliest entry in history.
      const earliest = sorted[0];
      return {
        frequency: [...earliest.frequency],
        restDays: [...(earliest.restDays || [])],
        timingType: earliest.timingType || 'anytime',
        preferredPeriod: earliest.preferredPeriod || null,
        relativeTiming: earliest.relativeTiming || null,
        exactTime: earliest.exactTime || null,
        source: 'schedule_history_baseline',
        effectiveDate: earliest.effectiveDate,
      };
    }
  }

  // Fallback to current schedule (empty history, or no target date specified)
  return {
    frequency: [...(baseSchedule.frequency || WEEKDAYS)],
    restDays: [...(baseSchedule.restDays || [])],
    timingType: baseSchedule.timingType || 'anytime',
    preferredPeriod: baseSchedule.preferredPeriod || null,
    relativeTiming: baseSchedule.relativeTiming || null,
    exactTime: baseSchedule.exactTime || null,
    source: 'current_schedule',
    effectiveDate: habit.lifecycle?.trackingHorizon?.startDate || null,
  };
}

/**
 * Authoritative alias for backward compatibility with getEffectiveScheduleForDate callers.
 */
export const getEffectiveScheduleForDate = getEffectiveSchedule;

/**
 * Checks whether a habit has a planned rest day on a specific day of the week or date.
 * Respects:
 * 1. Authoritative effective-dated schedule history when a date string, Date, or timestamp is provided.
 * 2. Explicit rest day configuration in schedule.restDays, metadata.restDays, or habit.restDays.
 * 3. Progressive Day Schedule rest variants in features.daySchedule.dayVariations[dow] (type === 'rest', dayType === 'rest', or isRestDay === true).
 * 4. Canonical movement routines (Sunday is an intentional planned rest day).
 * 5. User-anchor timezone and 04:00 AM observance boundary when given a Date, timestamp, or resolved date.
 *
 * @param {Object} habit
 * @param {string|Date|number} [dayOfWeekOrDate] - 'Mon'..'Sun', 'YYYY-MM-DD', Date instance, or timestamp.
 * @param {string} [timezone='UTC'] - IANA timezone for observance resolution if timestamp/Date provided.
 * @returns {boolean}
 */
export function isHabitRestDay(habit, dayOfWeekOrDate, timezone = 'UTC') {
  if (!habit) return false;

  let dow = null;
  let targetDate = null;

  if (typeof dayOfWeekOrDate === 'string') {
    if (WEEKDAYS.includes(dayOfWeekOrDate)) {
      dow = dayOfWeekOrDate;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dayOfWeekOrDate)) {
      targetDate = dayOfWeekOrDate;
      dow = getDayOfWeek(dayOfWeekOrDate);
    } else {
      targetDate = resolveObservanceDate(dayOfWeekOrDate, timezone);
      dow = getDayOfWeek(targetDate);
    }
  } else if (dayOfWeekOrDate instanceof Date || typeof dayOfWeekOrDate === 'number') {
    targetDate = resolveObservanceDate(dayOfWeekOrDate, timezone);
    dow = getDayOfWeek(targetDate);
  }

  if (!dow) {
    const ts = dayOfWeekOrDate || new Date();
    targetDate = resolveObservanceDate(ts, timezone);
    dow = getDayOfWeek(targetDate);
  }

  // 1. Authoritative effective-dated schedule resolution
  if (habit.schedule || Array.isArray(habit.frequency)) {
    try {
      const effective = getEffectiveSchedule(habit, targetDate || dow, timezone);
      if (Array.isArray(effective.restDays) && effective.restDays.includes(dow)) {
        return true;
      }
      // If an authoritative historical schedule entry was resolved, its restDays definition governs this date.
      if (effective.source === 'schedule_history' || effective.source === 'schedule_history_baseline') {
        // Historical schedule is definitive; do not fall back to unversioned current schedule restDays
      } else {
        // Current schedule source; check legacy metadata/restDays if present
        if (Array.isArray(habit.metadata?.restDays) && habit.metadata.restDays.includes(dow)) {
          return true;
        }
        if (Array.isArray(habit.restDays) && habit.restDays.includes(dow)) {
          return true;
        }
      }
    } catch {
      // If validation fails on non-standard test inputs, continue to explicit fallback properties
      if (Array.isArray(habit.schedule?.restDays) && habit.schedule.restDays.includes(dow)) {
        return true;
      }
      if (Array.isArray(habit.metadata?.restDays) && habit.metadata.restDays.includes(dow)) {
        return true;
      }
      if (Array.isArray(habit.restDays) && habit.restDays.includes(dow)) {
        return true;
      }
    }
  } else {
    // Fallback checks for legacy habit schemas without schedule or frequency
    if (Array.isArray(habit.metadata?.restDays) && habit.metadata.restDays.includes(dow)) {
      return true;
    }
    if (Array.isArray(habit.restDays) && habit.restDays.includes(dow)) {
      return true;
    }
  }

  // 2. Progressive Day Schedule rest variant (features.daySchedule)
  const daySchedule = habit.features?.daySchedule;
  if (daySchedule && (daySchedule.enabled || habit.completionMethod === 'exercise_plan')) {
    const dayVar = daySchedule.dayVariations?.[dow];
    if (dayVar && (dayVar.type === 'rest' || dayVar.dayType === 'rest' || dayVar.isRestDay === true)) {
      return true;
    }
    // Sunday is default rest in daySchedule unless explicitly overridden by an active non-rest variation
    if (dow === 'Sun' && (!dayVar || dayVar.type === 'rest' || dayVar.dayType === 'rest' || dayVar.isRestDay === true)) {
      return true;
    }
  }

  // 3. Canonical movement plan fallback: Sunday is an intentional planned rest day
  const isCanonicalMovement =
    habit.stableKey === 'canonical_exercise_plan' ||
    habit.stableKey === 'routine_physical_movement' ||
    habit.completionMethod === 'exercise_plan';

  if (dow === 'Sun' && isCanonicalMovement) {
    return true;
  }

  return false;
}

/**
 * Apply a schedule update to a habit while preserving historical schedule continuity.
 * 
 * If scheduleHistory was empty, the prior schedule is preserved as an entry effective
 * from the habit's tracking horizon start date (or createdAt). The new schedule is
 * recorded as an entry effective on `effectiveDate`.
 * 
 * @param {Object} habit - ComposableHabitModel
 * @param {Object} newSchedule - New schedule configuration
 * @param {string} effectiveDate - 'YYYY-MM-DD' when the change takes effect
 * @returns {Object} New habit object with updated schedule and scheduleHistory
 */
export function applyScheduleUpdate(habit, newSchedule, effectiveDate) {
  if (!habit) throw new ValidationError('Habit required to apply schedule update.');
  if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new ValidationError(`Valid effectiveDate ('YYYY-MM-DD') required, received: ${effectiveDate}`);
  }

  const existingHistory = Array.isArray(habit.scheduleHistory) ? [...habit.scheduleHistory] : [];
  const trackingStart = habit.lifecycle?.trackingHorizon?.startDate || '1970-01-01';

  // If history was empty, record the baseline schedule effective from tracking start
  if (existingHistory.length === 0 && habit.schedule) {
    existingHistory.push(createScheduleHistoryEntry(habit.schedule, trackingStart));
  }

  // Check if an entry for this exact effectiveDate already exists
  const existingIndex = existingHistory.findIndex(e => e.effectiveDate === effectiveDate);
  const newEntry = createScheduleHistoryEntry(newSchedule, effectiveDate);

  if (existingIndex >= 0) {
    existingHistory[existingIndex] = newEntry;
  } else {
    existingHistory.push(newEntry);
  }

  // Keep history sorted ascending by effectiveDate
  existingHistory.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  return {
    ...habit,
    schedule: {
      ...habit.schedule,
      ...newSchedule,
      frequency: [...(newSchedule.frequency || habit.schedule.frequency)],
      restDays: [...(newSchedule.restDays || habit.schedule.restDays || [])],
    },
    scheduleHistory: existingHistory,
    lifecycle: {
      ...habit.lifecycle,
      updatedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Historical Provenance Policy Engine
// ============================================================================

/**
 * Derive the tracking horizon for a habit based on habit-specific evidence.
 * 
 * Strictly follows the 4-tier policy:
 * - Tier 1 ('verified_creation'): Habit has createdAt, and NO habit-specific log precedes it.
 * - Tier 2 ('verified_first_log'): A verified habit-specific log precedes createdAt.
 * - Tier 3 ('inferred_activity'): Habit lacks createdAt, but habit logs exist.
 * - Tier 4 ('unverifiable'): Lacks createdAt and has zero habit logs -> startDate = null.
 * 
 * Strictly prohibits fallback to user.createdAt or logs belonging to other habits.
 * 
 * @param {Object} habitData - Habit document data
 * @param {Array<Object>} [habitSpecificLogs=[]] - Array of logs that explicitly reference THIS habit
 * @param {string} [timezone='UTC'] - User anchor timezone
 * @returns {Object} TrackingHorizon { startDate: string|null, status: string, inferredEvidence?: string }
 */
export function deriveTrackingHorizon(habitData, habitSpecificLogs = [], timezone = 'UTC') {
  if (habitData?.lifecycle?.trackingHorizon?.startDate) {
    return habitData.lifecycle.trackingHorizon;
  }

  const habitId = habitData?.id;
  const createdAt = habitData?.createdAt || habitData?.lifecycle?.createdAt;
  const localCreationDate = convertTimestampToTrackingDate(createdAt, timezone);

  // Filter logs strictly referencing THIS specific habit
  const relevantLogDates = [];
  if (Array.isArray(habitSpecificLogs)) {
    for (const log of habitSpecificLogs) {
      if (!log || !log.date) continue;
      const hasCompleted = Array.isArray(log.completedHabitIds) && habitId && log.completedHabitIds.includes(habitId);
      const hasProgress = log.habitProgress && habitId && Boolean(log.habitProgress[habitId]);
      const hasOutcome = log.habitOutcomes && habitId && Boolean(log.habitOutcomes[habitId]);

      if (hasCompleted || hasProgress || hasOutcome) {
        relevantLogDates.push(log.date);
      }
    }
  }

  relevantLogDates.sort(); // Ascending YYYY-MM-DD
  const earliestLogDate = relevantLogDates.length > 0 ? relevantLogDates[0] : null;

  // Case 1: Habit has authoritative creation timestamp
  if (localCreationDate) {
    if (earliestLogDate && earliestLogDate < localCreationDate) {
      return {
        startDate: earliestLogDate,
        status: 'verified_first_log',
        inferredEvidence: `First verified activity on ${earliestLogDate} precedes recorded creation date ${localCreationDate} (re-seeded routine).`,
      };
    }

    return {
      startDate: localCreationDate,
      status: 'verified_creation',
    };
  }

  // Case 2: Habit lacks creation timestamp, but has habit-specific logs
  if (earliestLogDate) {
    return {
      startDate: earliestLogDate,
      status: 'inferred_activity',
      inferredEvidence: `Creation timestamp missing; tracking horizon anchored to earliest recorded activity on ${earliestLogDate}.`,
    };
  }

  // Case 3: Lacks creation timestamp AND zero habit-specific activity records
  return {
    startDate: null,
    status: 'unverifiable',
    inferredEvidence: 'No habit-specific creation timestamp or historical activity records found.',
  };
}

// ============================================================================
// Model Validation
// ============================================================================

/**
 * Validate a ComposableHabitModel instance.
 * @param {Object} habit 
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateComposableHabit(habit) {
  const errors = [];

  if (!habit || typeof habit !== 'object') {
    return { valid: false, errors: ['Habit must be a valid object.'] };
  }

  if (!habit.id || typeof habit.id !== 'string') errors.push('Habit id is required.');
  if (!habit.userId || typeof habit.userId !== 'string') errors.push('Habit userId is required.');
  
  if (!habit.title || typeof habit.title !== 'string' || habit.title.trim().length === 0) {
    errors.push('Habit title must be a non-empty string.');
  } else if (habit.title.length > 200) {
    errors.push('Habit title cannot exceed 200 characters.');
  }

  if (!habit.category || !isValidCategory(habit.category)) {
    errors.push(`Habit category '${habit.category}' is invalid. Allowed: ${CATEGORIES.join(', ')}`);
  } else if (habit.category === 'Other') {
    if (!habit.customCategory || !isValidCustomCategory(habit.customCategory)) {
      errors.push("When category is 'Other', customCategory must be a non-empty string between 1 and 40 characters.");
    }
  }

  // Schedule validation: active weekdays (frequency) is the single source of truth
  if (!habit.schedule || typeof habit.schedule !== 'object') {
    errors.push('Habit schedule is required.');
  } else {
    if (!Array.isArray(habit.schedule.frequency) || habit.schedule.frequency.length === 0) {
      errors.push('Schedule frequency must contain at least one weekday.');
    } else {
      const invalidDays = habit.schedule.frequency.filter(d => !WEEKDAYS.includes(d));
      if (invalidDays.length > 0) {
        errors.push(`Invalid frequency days: ${invalidDays.join(', ')}`);
      }
    }

    if (habit.schedule.timingType && !TIMING_TYPES.includes(habit.schedule.timingType)) {
      errors.push(`Invalid timingType: '${habit.schedule.timingType}'. Allowed: ${TIMING_TYPES.join(', ')}`);
    }

    if (habit.schedule.restDays) {
      if (!Array.isArray(habit.schedule.restDays)) {
        errors.push('Schedule restDays must be an array.');
      } else {
        const invalidRest = habit.schedule.restDays.filter(d => !WEEKDAYS.includes(d));
        if (invalidRest.length > 0) {
          errors.push(`Invalid rest days: ${invalidRest.join(', ')}`);
        }
      }
    }
  }

  // Features validation — strictly enforces the 6 canonical feature slots
  if (!habit.features || typeof habit.features !== 'object') {
    errors.push('Habit features object is required.');
  } else {
    const f = habit.features;

    // Reject unsupported / unauthorized feature slots (e.g., sub-habits)
    for (const slotKey of Object.keys(f)) {
      if (!APPROVED_FEATURE_SLOTS.includes(slotKey)) {
        errors.push(`Unsupported feature slot '${slotKey}'. Approved slots: ${APPROVED_FEATURE_SLOTS.join(', ')}`);
      }
    }

    // Mutex / compatibility: Catalog and DaySchedule cannot both be enabled simultaneously
    if (f.catalog && f.catalog.enabled && f.daySchedule && f.daySchedule.enabled) {
      errors.push('Catalog and DaySchedule features cannot be enabled simultaneously on the same routine.');
    }

    // 1. Counter Slot
    if (f.counter && f.counter.enabled) {
      if (typeof f.counter.targetCount !== 'number' || f.counter.targetCount <= 0) {
        errors.push('Counter targetCount must be a positive number.');
      }
      if (!f.counter.unit || typeof f.counter.unit !== 'string' || !f.counter.unit.trim()) {
        errors.push('Counter unit must be a non-empty string.');
      }
      if (f.counter.step !== undefined && (typeof f.counter.step !== 'number' || f.counter.step <= 0)) {
        errors.push('Counter step must be a positive number.');
      }
      if (f.counter.minCount !== undefined && typeof f.counter.minCount !== 'number') {
        errors.push('Counter minCount must be a valid number.');
      }
    }

    // 2. Timer Slot
    if (f.timer && f.timer.enabled) {
      if (typeof f.timer.targetDurationMinutes !== 'number' || f.timer.targetDurationMinutes <= 0) {
        errors.push('Timer targetDurationMinutes must be a positive number.');
      }
      if (f.timer.mode && !['countdown', 'stopwatch'].includes(f.timer.mode)) {
        errors.push(`Invalid timer mode '${f.timer.mode}'. Allowed: 'countdown', 'stopwatch'.`);
      }
    }

    // 3. Checklist Slot
    if (f.checklist && f.checklist.enabled) {
      if (!Array.isArray(f.checklist.items)) {
        errors.push('Checklist items must be an array.');
      } else {
        for (let i = 0; i < f.checklist.items.length; i++) {
          const item = f.checklist.items[i];
          if (!item || typeof item !== 'object' || typeof item.label !== 'string' || !item.label.trim()) {
            errors.push(`Checklist item at index ${i} must have a valid non-empty label.`);
          }
        }
      }
    }

    // 4. Notes & Reflection Slot
    if (f.notes && f.notes.enabled) {
      if (f.notes.reflectionPrompts !== undefined && (!Array.isArray(f.notes.reflectionPrompts) || f.notes.reflectionPrompts.some(p => typeof p !== 'string'))) {
        errors.push('Notes reflectionPrompts must be an array of strings.');
      }
      if (f.notes.placeholder !== undefined && typeof f.notes.placeholder !== 'string') {
        errors.push('Notes placeholder must be a string.');
      }
    }

    // 5. Multi-Item Catalog Slot
    if (f.catalog && f.catalog.enabled) {
      if (!f.catalog.catalogId || typeof f.catalog.catalogId !== 'string' || !f.catalog.catalogId.trim()) {
        errors.push('Catalog catalogId is required when catalog feature is enabled.');
      }
      if (!f.catalog.catalogTitle || typeof f.catalog.catalogTitle !== 'string' || !f.catalog.catalogTitle.trim()) {
        errors.push('Catalog catalogTitle is required when catalog feature is enabled.');
      }
      if (!Array.isArray(f.catalog.items)) {
        errors.push('Catalog items must be an array.');
      }
    }

    // 6. Progressive Day Schedule Slot
    if (f.daySchedule && f.daySchedule.enabled) {
      if (!f.daySchedule.dayVariations || typeof f.daySchedule.dayVariations !== 'object') {
        errors.push('DaySchedule dayVariations must be an object keyed by weekday.');
      }
    }
  }

  // Lifecycle validation
  if (!habit.lifecycle || typeof habit.lifecycle !== 'object') {
    errors.push('Habit lifecycle object is required.');
  } else {
    const th = habit.lifecycle.trackingHorizon;
    if (!th || typeof th !== 'object') {
      errors.push('Lifecycle trackingHorizon is required.');
    } else {
      if (!PROVENANCE_STATUSES.includes(th.status)) {
        errors.push(`Invalid trackingHorizon status: '${th.status}'.`);
      }
      if (th.startDate !== null && (typeof th.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(th.startDate))) {
        errors.push(`trackingHorizon startDate must be 'YYYY-MM-DD' or null, received: ${th.startDate}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a PersistedDailyLogDoc instance before writing to Cloud Firestore.
 * 
 * Enforces the strict Layer 1 persisted schema invariant:
 * - habitOutcomes MUST ONLY contain statuses: 'completed' | 'skipped' | 'missed'
 * - 'unrecorded_outcome' or 'unrecorded' is STRICTLY FORBIDDEN from persistence
 * 
 * @param {Object} logDoc 
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateDailyLogDoc(logDoc) {
  const errors = [];

  if (!logDoc || typeof logDoc !== 'object') {
    return { valid: false, errors: ['Daily log must be an object.'] };
  }

  if (!logDoc.userId || typeof logDoc.userId !== 'string') {
    errors.push('Daily log userId is required.');
  }

  if (!logDoc.date || typeof logDoc.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(logDoc.date)) {
    errors.push(`Daily log date must be 'YYYY-MM-DD', received: ${logDoc.date}`);
  }

  if (logDoc.timezone && !isValidTimezone(logDoc.timezone)) {
    errors.push(`Invalid timezone on daily log: ${logDoc.timezone}`);
  }

  if (logDoc.habitOutcomes && typeof logDoc.habitOutcomes === 'object') {
    for (const [habitId, outcome] of Object.entries(logDoc.habitOutcomes)) {
      if (!outcome || typeof outcome !== 'object') {
        errors.push(`Outcome for habit '${habitId}' must be an object.`);
        continue;
      }
      if (!PERSISTED_OUTCOME_STATUSES.includes(outcome.status)) {
        errors.push(
          `Invalid persisted outcome status '${outcome.status}' for habit '${habitId}'. ` +
          `Persisted outcomes must only be one of: ${PERSISTED_OUTCOME_STATUSES.join(', ')}. ` +
          `'unrecorded' is a derived runtime state and must never be persisted.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Evaluates whether an individual configured feature slot is satisfied by progress data.
 *
 * Distinct state boundary: Feature progress vs Item state vs Parent habit outcome.
 *
 * @param {string} featureKey - One of APPROVED_FEATURE_SLOTS ('counter', 'timer', 'checklist', 'notes', 'catalog', 'daySchedule')
 * @param {Object} featureConfig - Feature configuration object
 * @param {Object} progress - Daily log progress for this habit
 * @returns {boolean} Whether this specific feature is satisfied
 */
export function isFeatureSatisfied(featureKey, featureConfig = {}, progress = {}, dayOfWeek = null) {
  if (!featureConfig || !featureConfig.enabled) return true;

  switch (featureKey) {
    case 'counter': {
      const current = progress.sessionsCompleted ?? progress.count ?? 0;
      const target = featureConfig.targetCount || 1;
      return current >= target;
    }
    case 'timer': {
      if (progress.timerCompleted) return true;
      const duration = progress.durationMinutes || 0;
      const target = featureConfig.targetDurationMinutes || 1;
      return duration >= target;
    }
    case 'checklist': {
      const items = Array.isArray(featureConfig.items) ? featureConfig.items : [];
      // An item is required unless explicitly marked optional via isRequired: false or isRequiredForCompletion: false
      const requiredItems = items.filter(
        item => item.isRequiredForCompletion !== false && item.isRequired !== false
      );
      if (requiredItems.length === 0) return true;
      const completedSteps = Array.isArray(progress.completedSteps) ? progress.completedSteps : [];
      return requiredItems.every(reqItem => completedSteps.includes(reqItem.id || reqItem.label));
    }
    case 'catalog': {
      const isOsho = featureConfig.catalogId === 'osho_discourses';
      if (!isOsho && Array.isArray(featureConfig.items) && featureConfig.items.length > 0) {
        if (progress.catalogItemCompleted) return true;
        const completedIds = Array.isArray(progress.completedCatalogItemIds) ? progress.completedCatalogItemIds : [];
        return featureConfig.items.every(item => completedIds.includes(item.id || item.title));
      }
      return Boolean(
        progress.catalogItemCompleted ||
        progress.talkCompleted ||
        (progress.seriesProgress && Object.values(progress.seriesProgress).some(sp => sp?.completedTalks > 0))
      );
    }
    case 'daySchedule': {
      const currentDay = dayOfWeek || getDayOfWeek();
      const dayVar = featureConfig.dayVariations?.[currentDay];
      const isRest = dayVar?.type === 'rest' || dayVar?.dayType === 'rest' || dayVar?.isRestDay === true || (currentDay === 'Sun' && (!dayVar || dayVar.type === 'rest' || dayVar.dayType === 'rest' || dayVar.isRestDay === true));
      if (isRest) {
        return false;
      }
      if (progress.workoutCompleted || progress.walkCompleted) {
        return true;
      }
      const currentItems = Array.isArray(dayVar?.exercises) && dayVar.exercises.length > 0
        ? dayVar.exercises
        : (dayVar?.type === 'walk' || currentDay === 'Tue' || currentDay === 'Thu' || currentDay === 'Sat')
        ? WALK_DAY_ROUTINE
        : WORKOUT_EXERCISES;

      const requiredItems = currentItems.filter(
        item => item.isRequired !== false && item.isRequiredForCompletion !== false
      );
      if (requiredItems.length === 0) {
        return false;
      }
      const completedIds = Array.isArray(progress.completedItemIds) ? progress.completedItemIds : [];
      return requiredItems.every(reqItem => completedIds.includes(reqItem.id));
    }
    case 'notes': {
      // Notes is an expressive / reflection annotation; does not gate completion
      return true;
    }
    default:
      return true;
  }
}

/**
 * Clamp a counter value within [minCount, maxCount].
 * Max bound defaults to `targetCount` unless `maxCount` is explicitly configured.
 *
 * @param {Object} habit - Habit document
 * @param {number} count - Candidate count
 * @returns {number} Clamped count
 */
export function clampCounterProgress(habit, count) {
  const counterConfig = habit?.features?.counter;
  if (!counterConfig) return count;
  const minCount = typeof counterConfig.minCount === 'number' ? counterConfig.minCount : 0;
  const targetCount = Number(counterConfig.targetCount) > 0 ? Number(counterConfig.targetCount) : 1;
  const maxCount = typeof counterConfig.maxCount === 'number' && counterConfig.maxCount >= targetCount
    ? counterConfig.maxCount
    : targetCount;
  const num = typeof count === 'number' && !isNaN(count) ? count : minCount;
  return Math.min(maxCount, Math.max(minCount, num));
}

/**
 * Derive daily log progress when the user activates the main habit checkbox.
 * Marks all required items/features for that observance day complete.
 *
 * Specific feature invariants:
 * - Counter: sets sessionsCompleted / count to targetCount (or maxCount)
 * - Timer: sets timerCompleted to true, durationMinutes to targetDurationMinutes
 * - Checklist: checks all required items (optional items do not block)
 * - Catalog: marks daily observance complete (catalogItemCompleted / talkCompleted) WITHOUT
 *   touching seriesProgress or marking all 30 discourses listened (Osho disclosure promise)
 * - Day Schedule: marks daily workout/walk complete
 * - Notes: notes text is strictly preserved, NEVER cleared or overwritten
 *
 * @param {Object} habit - Composable habit document
 * @param {Object} [existingProgress] - Current progress object
 * @returns {Object} Next progress object
 */
export function deriveCompletedProgressForHabit(habit, existingProgress = {}, dayOfWeek = null) {
  if (!habit || !habit.features) return { ...existingProgress };
  const currentDay = dayOfWeek || getDayOfWeek();
  if (isHabitRestDay(habit, currentDay)) return { ...existingProgress };
  const f = habit.features;
  const next = { ...existingProgress };

  if (f.counter?.enabled) {
    const target = Number(f.counter.targetCount) > 0 ? Number(f.counter.targetCount) : 1;
    next.sessionsCompleted = target;
    next.count = target;
  }

  if (f.timer?.enabled) {
    const targetMin = Number(f.timer.targetDurationMinutes) > 0 ? Number(f.timer.targetDurationMinutes) : 1;
    next.timerCompleted = true;
    next.durationMinutes = targetMin;
  }

  if (f.checklist?.enabled) {
    const items = Array.isArray(f.checklist.items) ? f.checklist.items : [];
    const requiredKeys = items
      .filter(item => item.isRequired !== false && item.isRequiredForCompletion !== false)
      .map(item => item.id || item.label);
    const existingSteps = Array.isArray(next.completedSteps) ? next.completedSteps : [];
    next.completedSteps = Array.from(new Set([...existingSteps, ...requiredKeys]));
    next.reviewDone = true;
  }

  if (f.catalog?.enabled) {
    next.catalogItemCompleted = true;
    next.talkCompleted = true;
    const isOsho = f.catalog.catalogId === 'osho_discourses' ||
      habit.stableKey === 'canonical_listen_osho' ||
      habit.completionMethod === 'osho_listening' ||
      (!f.catalog.catalogId && habit.title?.toLowerCase().includes('osho'));
    if (!isOsho && Array.isArray(f.catalog.items)) {
      const allItemIds = f.catalog.items.map((item, idx) => item.id || item.title || `item_${idx}`);
      next.completedCatalogItemIds = allItemIds;
    }
    // Osho disclosure invariant: Strictly leave seriesProgress untouched
  }

  if (f.daySchedule?.enabled) {
    next.workoutCompleted = true;
    next.walkCompleted = true;
    const currentDay = dayOfWeek || getDayOfWeek();
    const dayVar = f.daySchedule.dayVariations?.[currentDay];
    const currentItems = Array.isArray(dayVar?.exercises) && dayVar.exercises.length > 0
      ? dayVar.exercises
      : (dayVar?.type === 'walk' || currentDay === 'Tue' || currentDay === 'Thu' || currentDay === 'Sat')
      ? WALK_DAY_ROUTINE
      : (dayVar?.type === 'rest' || dayVar?.dayType === 'rest' || dayVar?.isRestDay === true || currentDay === 'Sun')
      ? []
      : WORKOUT_EXERCISES;
    const applicableIds = currentItems.map(item => item.id);
    const existingIds = Array.isArray(next.completedItemIds) ? next.completedItemIds : [];
    next.completedItemIds = Array.from(new Set([...existingIds, ...applicableIds]));
  }

  // Notes invariant: strictly preserve existing notes text
  return next;
}

/**
 * Derive daily log progress when the user unchecks the main habit checkbox.
 * Reverses daily completion requirements without erasing history or notes.
 *
 * @param {Object} habit - Composable habit document
 * @param {Object} [existingProgress] - Current progress object
 * @returns {Object} Next progress object
 */
export function deriveUncompletedProgressForHabit(habit, existingProgress = {}) {
  if (!habit || !habit.features) return { ...existingProgress };
  const f = habit.features;
  const next = { ...existingProgress };

  if (f.counter?.enabled) {
    const minCount = typeof f.counter.minCount === 'number' ? f.counter.minCount : 0;
    next.sessionsCompleted = minCount;
    next.count = minCount;
  }

  if (f.timer?.enabled) {
    next.timerCompleted = false;
    next.durationMinutes = 0;
  }

  if (f.checklist?.enabled) {
    next.completedSteps = [];
    next.reviewDone = false;
  }

  if (f.catalog?.enabled) {
    next.catalogItemCompleted = false;
    next.talkCompleted = false;
    const isOsho = f.catalog.catalogId === 'osho_discourses' ||
      habit.stableKey === 'canonical_listen_osho' ||
      habit.completionMethod === 'osho_listening' ||
      (!f.catalog.catalogId && habit.title?.toLowerCase().includes('osho'));
    if (!isOsho) {
      next.completedCatalogItemIds = [];
    }
    // Series progress remains untouched
  }

  if (f.daySchedule?.enabled) {
    next.workoutCompleted = false;
    next.walkCompleted = false;
    next.completedItemIds = [];
  }

  // Notes invariant: strictly preserve existing notes text
  return next;
}

/**
 * Evaluates whether ALL required active features of a habit are satisfied.
 *
 * Multi-Feature Invariant:
 * Completing one child item or one feature NEVER completes a multi-feature habit prematurely.
 * If multiple features are enabled (e.g. Counter + Checklist), ALL enabled features with completion
 * requirements must be satisfied for this function to return true.
 *
 * @param {Object} habit - Habit document with features
 * @param {Object} progress - Progress state
 * @param {string|null} [dayOfWeek=null] - Day of week (e.g. 'Mon')
 * @returns {boolean}
 */
export function evaluateHabitCompletion(habit, progress = {}, dayOfWeek = null) {
  if (!habit || !habit.features) return false;
  const currentDay = dayOfWeek || getDayOfWeek();
  if (isHabitRestDay(habit, currentDay)) return false;

  const f = habit.features;
  const activeFeatures = [];

  if (f.counter?.enabled) activeFeatures.push({ key: 'counter', config: f.counter });
  if (f.timer?.enabled) activeFeatures.push({ key: 'timer', config: f.timer });
  if (f.checklist?.enabled && Array.isArray(f.checklist.items) && f.checklist.items.length > 0) {
    activeFeatures.push({ key: 'checklist', config: f.checklist });
  }
  if (f.catalog?.enabled) activeFeatures.push({ key: 'catalog', config: f.catalog });
  if (f.daySchedule?.enabled) activeFeatures.push({ key: 'daySchedule', config: f.daySchedule });

  // If no action-based feature slots are enabled, habit completion is explicit-only
  if (activeFeatures.length === 0) {
    return false;
  }

  // ALL active features must be satisfied
  return activeFeatures.every(({ key, config }) => isFeatureSatisfied(key, config, progress, dayOfWeek));
}
