'use client';

import { useState, memo } from 'react';
import {
  Activity,
  Check,
  Moon,
  Footprints,
  ShieldAlert,
  ChevronDown,
  Sparkles,
  HeartPulse,
} from 'lucide-react';
import {
  MOVEMENT_SCHEDULE,
  WORKOUT_EXERCISES,
  WALK_DAY_ROUTINE,
  STOP_SIGNALS,
  GENERAL_HEALTH_NOTES,
} from '@/lib/fixtures/exercise-plan';
import { getDayOfWeek, getTodayString } from '@/utils/date-helpers';
import { resolveObservanceDate, getUserTimezone } from '@/domain';
import { useSound } from '@/contexts';

/**
 * SlotDaySchedule — Universal progressive day schedule and conditioning slot.
 *
 * Configured via `habit.features.daySchedule`:
 * - `dayVariations`: Object mapping weekdays to specific routines
 *
 * Fully supports:
 * - Weekday-specific activity variations
 * - Integrated Sunday and planned rest-day restorative states
 * - Exercise items completion and audio feedback
 * - Safety guidance notes and stop signals
 */
function SlotDaySchedule({
  feature = {},
  habit = {},
  progress = {},
  onChange,
  userProfile = {},
  onUpdateProfile,
  disabled = false,
  isHabitComplete = false,
  date,
}) {
  const { playStepToggleCue, playHabitCompleteCue } = useSound();
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState(null);

  const timezone = getUserTimezone(userProfile);
  const localToday = date || getTodayString();
  const calendarDayOfWeek = getDayOfWeek(localToday);
  const currentObservanceDate = resolveObservanceDate(new Date(), timezone);

  // Resolve today's schedule from feature.dayVariations or fallback to MOVEMENT_SCHEDULE
  const dayVariation = feature.dayVariations?.[calendarDayOfWeek];
  const scheduleForToday = dayVariation || MOVEMENT_SCHEDULE[calendarDayOfWeek] || MOVEMENT_SCHEDULE.Mon;

  const isRestDay = scheduleForToday.type === 'rest' || dayVariation?.isRestDay === true || calendarDayOfWeek === 'Sun';
  const isWalkDay = scheduleForToday.type === 'walk';
  const isWorkoutDay = scheduleForToday.type === 'workout' || (!isRestDay && !isWalkDay);

  // Completed item IDs
  const completedItemIds = progress.completedItemIds || [];

  // Determine items for today
  const currentItems = Array.isArray(scheduleForToday.exercises) && scheduleForToday.exercises.length > 0
    ? scheduleForToday.exercises
    : isWorkoutDay
    ? WORKOUT_EXERCISES
    : isWalkDay
    ? WALK_DAY_ROUTINE
    : [];

  const requiredItems = currentItems.filter(
    item => item.isRequired !== false && item.isRequiredForCompletion !== false
  );

  const allRequiredChecked = requiredItems.length > 0
    ? requiredItems.every(item => completedItemIds.includes(item.id))
    : Boolean(progress.workoutCompleted || progress.walkCompleted);
  const isComplete = Boolean(isHabitComplete || progress.workoutCompleted || allRequiredChecked);

  const handleToggleItem = (itemId, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (disabled || isRestDay) return;

    const isCurrentlyChecked = completedItemIds.includes(itemId);
    const updatedIds = isCurrentlyChecked
      ? completedItemIds.filter(id => id !== itemId)
      : [...completedItemIds, itemId];

    const nextAllRequiredChecked = requiredItems.length > 0
      ? requiredItems.every(item => updatedIds.includes(item.id))
      : true;

    // Requirement 3: When the last required checklist item is checked and completes parent,
    // trigger the exact same completion sound (playHabitCompleteCue) used by main checkbox;
    // ensure it plays once, no duplicates, no replay on reload/render.
    if (!isCurrentlyChecked && nextAllRequiredChecked && !isComplete) {
      playHabitCompleteCue?.();
    } else {
      playStepToggleCue?.(!isCurrentlyChecked);
    }

    onChange?.(updatedIds, nextAllRequiredChecked, currentObservanceDate);
  };

  // If Rest Day (e.g. Sunday)
  if (isRestDay) {
    return (
      <div className="rounded-xl p-3 sm:p-4 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-2xs uppercase tracking-wider">
            <Moon className="w-3.5 h-3.5" />
            <span>Rest & Restoration Day</span>
          </div>
          <span className="text-2xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 font-semibold border border-teal-300/80 dark:border-teal-700/60">
            {scheduleForToday.title || (calendarDayOfWeek === 'Sun' ? 'Sunday' : calendarDayOfWeek)}
          </span>
        </div>

        <p className="text-xs text-sub leading-relaxed">
          {scheduleForToday.description || 'Full recovery, nervous system down-regulation, and restful sleep.'}
        </p>

        <div className="flex items-center gap-2 pt-1 text-2xs text-teal-800 dark:text-teal-300 font-medium">
          <HeartPulse className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Rest days bridge consistency without streak penalty.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3 sm:p-3.5 bg-surface-subtle/80 dark:bg-stone-900/60 border border-subtle space-y-2.5">
      {/* Header Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-main text-2xs uppercase tracking-tight">
          {isWalkDay ? (
            <Footprints className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          ) : (
            <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          )}
          <span>Today: {scheduleForToday.title || (isWalkDay ? 'Brisk Walk & Mobility' : 'Structured Workout')}</span>
        </div>

        <button
          type="button"
          onClick={() => setShowSafetyModal(true)}
          className="text-2xs text-muted hover:text-teal-700 dark:hover:text-teal-400 flex items-center gap-1 transition-colors"
          title="View movement safety guidance"
        >
          <ShieldAlert className="w-3 h-3 text-amber-500" />
          <span>Safety</span>
        </button>
      </div>

      {/* Progress track */}
      {currentItems.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-2xs text-sub">
            <span>Exercises: {completedItemIds.filter(id => currentItems.some(ci => ci.id === id)).length} of {currentItems.length}</span>
            <span>{isComplete ? 'Complete' : 'In Progress'}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isComplete ? 'bg-teal-600 dark:bg-teal-400' : 'bg-teal-500/70'
              }`}
              style={{
                width: `${Math.min(100, (completedItemIds.filter(id => currentItems.some(ci => ci.id === id)).length / currentItems.length) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-1.5 pt-1">
        {currentItems.map((item) => {
          const isItemDone = completedItemIds.includes(item.id);
          const isDetailExpanded = expandedExerciseId === item.id;

          return (
            <div
              key={item.id}
              className={`rounded-xl border transition-all ${
                isItemDone
                  ? 'bg-teal-50/50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60'
                  : 'bg-surface border-subtle'
              }`}
            >
              <div
                onClick={(e) => {
                  if (disabled || isRestDay) return;
                  handleToggleItem(item.id, e);
                }}
                role="checkbox"
                aria-checked={isItemDone}
                aria-disabled={disabled || isRestDay}
                tabIndex={disabled || isRestDay ? -1 : 0}
                className={`flex items-center gap-3 p-2 sm:p-2.5 ${
                  disabled || isRestDay ? 'cursor-not-allowed opacity-60 pointer-events-none select-none' : 'cursor-pointer'
                }`}
              >
                {/* Checkbox button (min 44x44px touch target) */}
                <button
                  type="button"
                  onClick={(e) => {
                    if (disabled || isRestDay) return;
                    handleToggleItem(item.id, e);
                  }}
                  disabled={disabled || isRestDay}
                  aria-disabled={disabled || isRestDay}
                  tabIndex={disabled || isRestDay ? -1 : 0}
                  className={`w-9 h-9 min-w-[36px] min-h-[36px] sm:w-8 sm:h-8 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                    disabled || isRestDay ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    isItemDone
                      ? 'bg-teal-700 dark:bg-teal-600 border-teal-700 dark:border-teal-600 text-white'
                      : 'border-slate-300 dark:border-slate-600 hover:border-teal-500 bg-surface'
                  }`}
                  aria-label={`Toggle ${item.name}`}
                  title={disabled || isRestDay ? `${item.name} (Locked — Planned Rest)` : undefined}
                >
                  {isItemDone && <Check className="w-4 h-4 stroke-[3]" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs sm:text-sm font-semibold truncate ${isItemDone ? 'line-through text-muted' : 'text-main'}`}>
                      {item.name || item.label}
                      {(item.isRequired === false || item.isRequiredForCompletion === false) && (
                        <span className="ml-1.5 text-2xs font-normal text-muted italic">(Optional)</span>
                      )}
                    </span>
                    {item.target && (
                      <span className="text-2xs text-muted flex-shrink-0 font-medium">
                        {item.target}
                      </span>
                    )}
                  </div>
                  {item.reps && (
                    <p className="text-2xs text-sub truncate">{item.reps}</p>
                  )}
                </div>

                {item.cues && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedExerciseId(prev => (prev === item.id ? null : item.id));
                    }}
                    className="p-1.5 text-muted hover:text-main rounded-md transition-colors"
                    aria-label="Toggle exercise cues"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDetailExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {isDetailExpanded && item.cues && (
                <div className="px-3 pb-2.5 pt-1 text-2xs text-sub border-t border-subtle/60 space-y-1">
                  <p><span className="font-semibold text-main">Posture & Cues:</span> {item.cues}</p>
                  {item.progression && (
                    <p><span className="font-semibold text-teal-700 dark:text-teal-400">Progression:</span> {item.progression}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Safety Modal */}
      {showSafetyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="bg-surface rounded-2xl max-w-md w-full p-5 border border-subtle shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-main flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Movement Safety Guidance</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="text-muted hover:text-main p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-sub max-h-80 overflow-y-auto pr-1">
              <div className="space-y-1">
                <h4 className="font-bold text-main">Stop Signals:</h4>
                <ul className="list-disc pl-4 space-y-0.5 text-2xs">
                  {STOP_SIGNALS.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1 pt-1 border-t border-subtle">
                <h4 className="font-bold text-main">General Health Notes:</h4>
                <p className="text-2xs leading-relaxed">{GENERAL_HEALTH_NOTES}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="px-4 py-2 bg-teal-700 dark:bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-800 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SlotDaySchedule);
