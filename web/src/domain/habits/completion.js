/**
 * Domain Habit Feature Completion Evaluation & Progress Derivation.
 */

import { WORKOUT_EXERCISES, WALK_DAY_ROUTINE } from '../../lib/fixtures/exercise-plan.js';
import { getDayOfWeek } from '../../utils/date-helpers.js';
import { isHabitRestDay } from '../schedule/resolution.js';
import { getStepId, isStepCompleted } from '../../utils/checklist-helpers.js';

/**
 * Evaluates whether an individual configured feature slot is satisfied by progress data.
 *
 * Distinct state boundary: Feature progress vs Item state vs Parent habit outcome.
 *
 * @param {string} featureKey - One of APPROVED_FEATURE_SLOTS ('counter', 'timer', 'checklist', 'notes', 'catalog', 'daySchedule')
 * @param {Object} featureConfig - Feature configuration object
 * @param {Object} progress - Daily log progress for this habit
 * @param {string|null} [dayOfWeek=null] - Day of week
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
      if (items.length === 0) return true;
      // An item is required unless explicitly marked optional via isRequired: false or isRequiredForCompletion: false
      const requiredItemsWithIndex = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item?.isRequiredForCompletion !== false && item?.isRequired !== false);
      if (requiredItemsWithIndex.length === 0) return true;
      const completedSteps = Array.isArray(progress.completedSteps) ? progress.completedSteps : [];
      return requiredItemsWithIndex.every(({ item, index }) =>
        isStepCompleted(item, index, completedSteps, false, items)
      );
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
 * @param {string|null} [dayOfWeek=null] - Day of week
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
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.isRequired !== false && item.isRequiredForCompletion !== false)
      .map(({ item, idx }) => getStepId(item, idx));
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
  return activeFeatures.every(({ key, config }) => isFeatureSatisfied(key, config, progress, currentDay));
}
