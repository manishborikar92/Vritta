'use client';

import { useState, useMemo, memo } from 'react';
import {
  Check,
  Clock,
  Moon,
  ChevronDown,
  Coffee,
} from 'lucide-react';
import { getCategoryConfig } from '@/lib/constants/categories';
import {
  evaluateHabitCompletion,
  clampCounterProgress,
  deriveCompletedProgressForHabit,
  deriveUncompletedProgressForHabit,
  getUserTimezone,
} from '@/domain';
import { getTimingDisplay, getDayOfWeek, getTodayString } from '@/utils/date-helpers';
import { isHabitRestDay } from '@/utils/analytics-helpers';
import { useSound } from '@/contexts';
import {
  SlotTimer,
  SlotStepper,
  SlotChecklist,
  SlotNotes,
  SlotCatalog,
  SlotDaySchedule,
} from './slots';

/**
 * HabitTrackerCard — Composable Habit Tracking Card for Vritta Today view.
 * Phase 4 Revision: Simplified Completion Contract
 *
 * Implements:
 * - Feature-driven architecture rendering atomic slots dynamically based on `habit.features`.
 * - Strictly NO title sniffing, account hardcoding, or category substring matching.
 * - Primary circular completion checkbox (WCAG min 44x44px touch target) is the single
 *   user-facing mechanism for recording completion or correcting an erroneous completion.
 * - Eliminates manual Rest / Skip / Missed / Reset outcome action buttons.
 * - Planned rest days (e.g. Sunday movement) are gracefully recognized from the schedule.
 * - Seamless preservation of Osho listening, reading timers, workbook steppers, and conditioning plans.
 */
function HabitTrackerCard({
  habit,
  isCompleted = false,
  progress = {},
  onToggle,
  onUpdateProgress,
  userProfile = {},
  onUpdateProfile,
  date,
}) {
  const { playStepToggleCue, playHabitCompleteCue } = useSound();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!habit) return null;

  const config = getCategoryConfig(habit.category, habit.customCategory);
  const timingText = getTimingDisplay(habit);
  const isNightTiming = timingText.toLowerCase().includes('bed') || timingText.toLowerCase().includes('night');

  // Check if today is a recurring planned rest day for this routine
  // Resolves against user anchor timezone and active calendar day
  const timezone = getUserTimezone(userProfile);
  const localToday = date || getTodayString();
  const isScheduledRest = isHabitRestDay(habit, localToday, timezone);
  const isExplicitRest =
    progress?.status === 'rest' ||
    progress?.outcome === 'rest' ||
    progress?.outcomes?.[habit?.id]?.status === 'rest';

  const isPlannedRest = Boolean(isScheduledRest || isExplicitRest);

  // Features from composable habit model
  const features = habit.features || {};

  const hasCounter = Boolean(features.counter?.enabled);
  const hasTimer = Boolean(features.timer?.enabled);
  const hasChecklist = Boolean(features.checklist?.enabled);
  const hasNotes = Boolean(features.notes?.enabled);
  const hasCatalog = Boolean(features.catalog?.enabled);
  const hasDaySchedule = Boolean(features.daySchedule?.enabled);

  // Instructions text
  const instructionsText = habit.instructions || habit.description || '';
  const hasLongInstructions = instructionsText.length > 60;

  // Primary circular completion checkbox handler
  const handlePrimaryToggle = (e) => {
    e?.stopPropagation();

    // Guard: A planned rest day is a neutral day, not a completion opportunity.
    if (isPlannedRest) {
      return;
    }

    if (isCompleted) {
      playStepToggleCue?.(false);
      const nextProgress = deriveUncompletedProgressForHabit(habit, progress);
      onUpdateProgress?.(habit.id, nextProgress, false);
      onToggle?.(habit.id);
    } else {
      playHabitCompleteCue?.();
      const nextProgress = deriveCompletedProgressForHabit(habit, progress);
      onUpdateProgress?.(habit.id, nextProgress, true);
      onToggle?.(habit.id);
    }
  };

  // Slot update handlers with strict feature-driven completion evaluation
  const handleCounterChange = (newCount) => {
    if (isPlannedRest) return;
    const clampedCount = clampCounterProgress(habit, newCount);
    const nextProgress = {
      ...progress,
      sessionsCompleted: clampedCount,
      count: clampedCount,
    };
    const allFeaturesSatisfied = evaluateHabitCompletion(habit, nextProgress);
    onUpdateProgress?.(habit.id, nextProgress, allFeaturesSatisfied);
  };

  const handleTimerComplete = ({ durationMinutes }) => {
    if (isPlannedRest) return;
    const nextProgress = {
      ...progress,
      durationMinutes,
      timerCompleted: true,
    };
    const allFeaturesSatisfied = evaluateHabitCompletion(habit, nextProgress);
    onUpdateProgress?.(habit.id, nextProgress, allFeaturesSatisfied);
  };

  const handleChecklistChange = (nextSteps, allDone) => {
    if (isPlannedRest) return;
    const nextProgress = {
      ...progress,
      completedSteps: nextSteps,
      reviewDone: allDone,
    };
    const allFeaturesSatisfied = evaluateHabitCompletion(habit, nextProgress);
    onUpdateProgress?.(habit.id, nextProgress, allFeaturesSatisfied);
  };

  const handleDayScheduleChange = (updatedItemIds, allDone) => {
    if (isPlannedRest) return;
    const nextProgress = {
      ...progress,
      completedItemIds: updatedItemIds,
      workoutCompleted: allDone,
      walkCompleted: allDone,
    };
    const allFeaturesSatisfied = evaluateHabitCompletion(habit, nextProgress);
    onUpdateProgress?.(habit.id, nextProgress, allFeaturesSatisfied);
  };

  const handleCatalogChange = (catalogUpdates) => {
    if (isPlannedRest) return;
    const nextProgress = {
      ...progress,
      ...catalogUpdates,
    };
    const allFeaturesSatisfied = evaluateHabitCompletion(habit, nextProgress);
    onUpdateProgress?.(habit.id, nextProgress, allFeaturesSatisfied);
  };

  const handleNotesSave = (notesText) => {
    // Notes is an expressive journal feature; it never alters habit completion state
    onUpdateProgress?.(habit.id, {
      ...progress,
      notes: notesText,
    });
  };

  return (
    <div
      className={`relative rounded-3xl border border-t-[3px] bg-surface shadow-2xs transition-all duration-200 hover:shadow-xs ${
        config.borderTopColor || 'border-t-teal-600 dark:border-t-teal-400'
      } ${
        isCompleted
          ? 'bg-teal-50/20 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-900/60'
          : isPlannedRest
          ? 'bg-amber-50/15 dark:bg-amber-950/15 border-amber-200/50 dark:border-amber-900/40'
          : 'border-subtle'
      }`}
    >
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Header Row: Category Badge & Timing on Left, Primary Completion Checkbox on Right */}
        <div className="flex items-start justify-between gap-3">
          {/* Left Metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5">
              <span className={`text-2xs sm:text-xs px-2.5 py-0.5 rounded-full font-semibold border ${config.badgeClasses}`}>
                {config.label || habit.category}
              </span>

              {timingText && (
                <span className="flex items-center gap-1 text-2xs sm:text-xs text-sub bg-surface-subtle border border-subtle px-2 py-0.5 rounded-md font-medium">
                  {isNightTiming ? (
                    <Moon className="w-3 h-3 text-slate-400" />
                  ) : (
                    <Clock className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{timingText}</span>
                </span>
              )}

              {isPlannedRest && !isCompleted && (
                <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <Coffee className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Planned Rest</span>
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-base sm:text-lg font-bold text-main leading-snug">
              {habit.title}
            </h3>

            {/* Collapsible Instructions */}
            {instructionsText && (
              <div className="mt-1">
                {hasLongInstructions ? (
                  <div>
                    {showInstructions ? (
                      <p className="text-xs sm:text-sm text-sub whitespace-pre-line leading-relaxed">
                        {instructionsText}
                      </p>
                    ) : (
                      <p className="text-xs sm:text-sm text-sub line-clamp-1 leading-relaxed">
                        {instructionsText}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowInstructions(prev => !prev)}
                      className="text-2xs font-semibold text-teal-700 dark:text-teal-400 hover:underline mt-0.5 inline-flex items-center gap-0.5"
                    >
                      {showInstructions ? 'Hide instructions' : 'Show full instructions'}
                      <ChevronDown className={`w-3 h-3 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-sub leading-relaxed">
                    {instructionsText}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Action Control: Single Primary Circular Completion Button (WCAG min 44x44px touch target) or Rest Day Indicator */}
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
            {isPlannedRest ? (
              <div
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border-2 border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400 cursor-not-allowed select-none"
                title="Planned Rest Day — Routine is resting today"
                aria-label={`${habit.title} is resting today`}
                role="status"
              >
                <Coffee className="w-5 h-5" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePrimaryToggle}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border-2 flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-95 ${
                  isCompleted
                    ? 'bg-teal-700 dark:bg-teal-600 border-teal-700 dark:border-teal-600 text-white shadow-teal-700/20 shadow-xs'
                    : 'border-slate-300 dark:border-stone-600 hover:border-teal-500 bg-surface'
                }`}
                aria-label={isCompleted ? `Mark ${habit.title} incomplete` : `Mark ${habit.title} complete`}
                title={isCompleted ? 'Completed' : 'Mark completed'}
              >
                {isCompleted && <Check className="w-5 h-5 text-white stroke-[3]" />}
              </button>
            )}
          </div>
        </div>

        {/* ATOMIC FEATURE SLOTS (Conditioned strictly on features) */}
        <div className="space-y-3 pt-0.5">
          {/* 1. Counter Slot */}
          {hasCounter && (
            <SlotStepper
              feature={features.counter || { targetCount: 2, unit: 'sessions', step: 1, minCount: 0 }}
              progress={progress}
              onChange={handleCounterChange}
              isHabitComplete={isCompleted}
              disabled={isPlannedRest}
            />
          )}

          {/* 2. Timer Slot */}
          {hasTimer && (
            <SlotTimer
              habitId={habit.id}
              feature={features.timer || { targetDurationMinutes: habit.targetMinutes || 30 }}
              habit={habit}
              isCompleted={isCompleted}
              onComplete={handleTimerComplete}
              disabled={isPlannedRest}
            />
          )}

          {/* 3. Checklist Slot */}
          {hasChecklist && (
            <SlotChecklist
              feature={features.checklist || { items: habit.checklistItems || [] }}
              habit={habit}
              progress={progress}
              onChange={handleChecklistChange}
              isHabitComplete={isCompleted}
              disabled={isPlannedRest}
            />
          )}

          {/* 4. Day Schedule & Conditioning Slot */}
          {hasDaySchedule && (
            <SlotDaySchedule
              feature={features.daySchedule || {}}
              habit={habit}
              progress={progress}
              onChange={handleDayScheduleChange}
              userProfile={userProfile}
              onUpdateProfile={onUpdateProfile}
              isHabitComplete={isCompleted}
              disabled={isPlannedRest}
              date={localToday}
            />
          )}

          {/* 5. Catalog Slot (Osho Audio Library or Curriculum) */}
          {hasCatalog && (
            <SlotCatalog
              feature={features.catalog || { catalogId: 'osho_discourses', catalogTitle: 'Osho Discourse Audio Library' }}
              habit={habit}
              progress={progress}
              onChange={handleCatalogChange}
              userProfile={userProfile}
              onUpdateProfile={onUpdateProfile}
              disabled={isPlannedRest}
            />
          )}

          {/* 6. Notes & Reflection Slot */}
          {hasNotes && (
            <SlotNotes
              habitId={habit.id}
              feature={features.notes}
              progress={progress}
              onSave={handleNotesSave}
              disabled={isPlannedRest}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(HabitTrackerCard);
