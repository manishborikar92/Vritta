/**
 * Domain Validation for Composable Habits and Daily Logs.
 */

import { ValidationError } from '../errors.js';
import {
  CATEGORIES,
  WEEKDAYS,
  TIMING_TYPES,
  APPROVED_FEATURE_SLOTS,
  PROVENANCE_STATUSES,
  PERSISTED_OUTCOME_STATUSES,
} from './schema.js';
import { isValidCategory, isValidCustomCategory } from '../../lib/constants/categories.js';
import { isValidTimezone } from '../schedule/observance.js';

export { ValidationError };

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
