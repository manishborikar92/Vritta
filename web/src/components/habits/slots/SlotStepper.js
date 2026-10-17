'use client';

import { memo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useSound } from '@/contexts';

/**
 * SlotStepper — Universal counter & session stepper slot.
 *
 * Configured via `habit.features.counter`:
 * - `targetCount`: Target quantity (e.g., 2 sessions, 8 glasses, 10 reps)
 * - `unit`: Label string (e.g., "sessions", "reps", "glasses")
 * - `step`: Increment delta (default: 1)
 * - `minCount`: Minimum value (default: 0)
 *
 * Preserves backward compatibility with existing workbook progress (`sessionsCompleted`).
 */
function SlotStepper({
  feature = {},
  progress = {},
  onChange,
  disabled = false,
  isHabitComplete = false,
}) {
  const { playStepToggleCue, playHabitCompleteCue } = useSound();

  const targetCount = Number(feature.targetCount) > 0 ? Number(feature.targetCount) : 1;
  const maxCount = typeof feature.maxCount === 'number' && feature.maxCount >= targetCount
    ? feature.maxCount
    : targetCount;
  const unit = feature.unit || 'sessions';
  const step = Number(feature.step) > 0 ? Number(feature.step) : 1;
  const minCount = typeof feature.minCount === 'number' ? feature.minCount : 0;

  // Read current count from progress (support both sessionsCompleted and count)
  const currentCount = typeof progress.sessionsCompleted === 'number'
    ? progress.sessionsCompleted
    : typeof progress.count === 'number'
    ? progress.count
    : minCount;

  const isTargetReached = currentCount >= targetCount;
  const isMaxReached = currentCount >= maxCount;

  const handleDecrement = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (disabled || currentCount <= minCount) return;
    const next = Math.max(minCount, currentCount - step);
    playStepToggleCue?.(false);
    onChange?.(next, next >= targetCount);
  };

  const handleIncrement = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (disabled || isMaxReached) return;
    const next = Math.min(maxCount, currentCount + step);
    if (next >= targetCount && !isTargetReached) {
      playHabitCompleteCue?.();
    } else {
      playStepToggleCue?.(true);
    }
    onChange?.(next, next >= targetCount);
  };

  const remaining = Math.max(0, targetCount - currentCount);

  return (
    <div className="rounded-xl p-3 sm:p-3.5 bg-surface-subtle/80 dark:bg-stone-900/60 border border-subtle space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-main tracking-tight uppercase text-2xs">
          Daily {unit} Target
        </span>
        <span className="text-2xs font-medium text-sub">
          {isTargetReached ? (
            <span className="text-teal-700 dark:text-teal-400 font-semibold">Target fulfilled</span>
          ) : (
            <span>{remaining} {remaining === 1 ? unit.replace(/s$/, '') : unit} remaining</span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Decrement Button (min 44x44px touch target) */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || currentCount <= minCount}
          aria-disabled={disabled || currentCount <= minCount}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border border-subtle bg-surface text-main hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-95"
          aria-label={`Decrement ${unit}`}
          title={`Decrease ${unit}`}
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Counter readout */}
        <div className="flex-1 text-center py-1">
          <div className="text-xl sm:text-2xl font-extrabold text-main tracking-tight">
            {currentCount} <span className="text-sm font-semibold text-muted">/ {targetCount}</span>
          </div>
          <p className="text-2xs text-muted font-medium">{unit}</p>
        </div>

        {/* Increment Button (min 44x44px touch target) */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || isMaxReached}
          aria-disabled={disabled || isMaxReached}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-95"
          aria-label={`Increment ${unit}`}
          title={isMaxReached ? `Maximum ${unit} reached` : `Increase ${unit}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Progress track */}
      <div className="w-full bg-slate-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isTargetReached ? 'bg-teal-600 dark:bg-teal-400' : 'bg-teal-500/70'
          }`}
          style={{ width: `${Math.min(100, (currentCount / targetCount) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default memo(SlotStepper);
