'use client';

import { useState, memo } from 'react';
import { Check, ListChecks, ChevronDown, Coffee } from 'lucide-react';
import { useSound } from '@/contexts';
import {
  isStepCompleted,
  calculateChecklistProgress,
  toggleChecklistStep,
  normalizeCompletedSteps,
} from '@/utils/checklist-helpers';

/**
 * SlotChecklist — Universal step-by-step checklist slot.
 *
 * Configured via `habit.features.checklist`:
 * - `items`: Array of step definitions ({ id, label, required })
 *
 * Supports robust step normalization (preserving completed state across step reorders/renames),
 * WCAG 2.2 touch targets (min 44x44px), and audio completion feedback.
 * Strictly locks and prevents mutations on planned rest days.
 */
function SlotChecklist({
  feature = {},
  habit = {},
  progress = {},
  onChange,
  disabled = false,
  isHabitComplete = false,
}) {
  const { playStepToggleCue, playHabitCompleteCue } = useSound();

  // Resolve items from feature.items or legacy habit.checklistItems
  const items = Array.isArray(feature.items) && feature.items.length > 0
    ? feature.items
    : Array.isArray(habit.checklistItems)
    ? habit.checklistItems
    : [];

  const rawCompletedSteps = progress.completedSteps || progress.completedItemIds || [];
  const completedSteps = normalizeCompletedSteps(rawCompletedSteps, items);

  const { completedCount, totalCount, percent, isAllCompleted } = calculateChecklistProgress(
    items,
    completedSteps,
    isHabitComplete
  );

  const [isExpanded, setIsExpanded] = useState(() => totalCount <= 3 || completedCount > 0);

  if (items.length === 0) return null;

  const handleStepToggle = (index, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (disabled) return;

    const isCurrentlyChecked = isStepCompleted(items[index], index, completedSteps, isHabitComplete, items);
    const { nextCompletedSteps, isAllCompleted: nextAllDone } = toggleChecklistStep(
      items,
      completedSteps,
      index,
      isHabitComplete
    );

    if (nextAllDone) {
      playHabitCompleteCue?.();
    } else {
      playStepToggleCue?.(!isCurrentlyChecked);
    }

    onChange?.(nextCompletedSteps, nextAllDone);
  };

  return (
    <div className="rounded-xl p-3 sm:p-3.5 bg-surface-subtle/80 dark:bg-stone-900/60 border border-subtle space-y-2.5">
      {/* Header Row */}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="flex items-center gap-1.5 font-semibold text-main hover:text-teal-700 dark:hover:text-teal-400 transition-colors text-2xs uppercase tracking-tight"
          aria-expanded={isExpanded}
        >
          <ListChecks className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Step Checklist</span>
          {totalCount > 3 && (
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          )}
        </button>

        <span className="text-2xs font-medium text-sub">
          {completedCount} of {totalCount} completed ({percent}%)
        </span>
      </div>

      {/* Planned Rest Inactive Banner */}
      {disabled && (
        <div
          role="status"
          aria-label="Checklist paused for planned rest"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-2xs font-semibold select-none"
        >
          <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>Planned Rest Day — Checklist items are paused and locked today.</span>
        </div>
      )}

      {/* Progress track */}
      <div className="w-full bg-slate-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isAllCompleted ? 'bg-teal-600 dark:bg-teal-400' : 'bg-teal-500/70'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Checklist items list */}
      {isExpanded && (
        <div className="space-y-1.5 pt-1">
          {items.map((item, index) => {
            const label = typeof item === 'string' ? item : item?.label || `Step ${index + 1}`;
            const stepChecked = isStepCompleted(item, index, completedSteps, isHabitComplete, items);

            return (
              <div
                key={item?.id || `step_${index}`}
                onClick={(e) => {
                  if (disabled) return;
                  handleStepToggle(index, e);
                }}
                onKeyDown={(e) => {
                  if (disabled) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStepToggle(index, e);
                  }
                }}
                role="checkbox"
                aria-checked={stepChecked}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                className={`flex items-center gap-3 p-2 sm:p-2.5 rounded-xl border transition-all ${
                  disabled
                    ? 'opacity-60 cursor-not-allowed select-none bg-surface-subtle/50 border-subtle pointer-events-none'
                    : 'cursor-pointer'
                } ${
                  stepChecked
                    ? 'bg-teal-50/50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60 text-slate-500 dark:text-slate-400'
                    : 'bg-surface border-subtle text-main hover:bg-surface-subtle'
                }`}
              >
                {/* Checkbox button (WCAG 2.2 min 44x44px touch target) */}
                <button
                  type="button"
                  onClick={(e) => {
                    if (disabled) return;
                    handleStepToggle(index, e);
                  }}
                  disabled={disabled}
                  aria-disabled={disabled}
                  tabIndex={disabled ? -1 : 0}
                  className={`w-9 h-9 min-w-[36px] min-h-[36px] sm:w-8 sm:h-8 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                    disabled ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    stepChecked
                      ? 'bg-teal-700 dark:bg-teal-600 border-teal-700 dark:border-teal-600 text-white'
                      : 'border-slate-300 dark:border-slate-600 hover:border-teal-500 bg-surface'
                  }`}
                  aria-label={disabled ? `${label} (Locked - Planned Rest)` : `Toggle ${label}`}
                >
                  {stepChecked && <Check className="w-4 h-4 stroke-[3]" />}
                </button>

                <span className={`text-xs sm:text-sm font-medium leading-relaxed flex-1 ${stepChecked ? 'line-through text-muted' : 'text-main'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(SlotChecklist);
