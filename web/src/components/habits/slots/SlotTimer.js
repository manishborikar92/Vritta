'use client';

import { memo } from 'react';
import { Play, Pause, RotateCcw, Timer } from 'lucide-react';
import { useTimer } from '@/hooks/use-timer';
import { getReadingTargetMinutes } from '@/utils/reading-helpers';

/**
 * SlotTimer — Universal timer slot for countdown and focus routines.
 *
 * Configured via `habit.features.timer`:
 * - `targetDurationMinutes`: Configurable target (e.g., 10, 15, 20, 25, 30, 45, 60 min)
 * - `mode`: 'countdown' | 'stopwatch'
 *
 * Employs background-resilient timestamp tracking and Web Audio API completion cues.
 */
function SlotTimer({
  habitId,
  feature = {},
  habit = {},
  isCompleted = false,
  onComplete,
  disabled = false,
}) {
  const targetMinutes = Number(feature.targetDurationMinutes) > 0
    ? Number(feature.targetDurationMinutes)
    : getReadingTargetMinutes(habit);

  const {
    targetSeconds,
    secondsRemaining,
    timerActive,
    isPaused,
    progressPercent,
    timeFormatted,
    startTimer,
    pauseTimer,
    resetTimer,
  } = useTimer({
    habitId: habitId || habit.id,
    initialTargetMinutes: targetMinutes,
    isCompleted,
    onComplete: ({ durationMinutes }) => {
      onComplete?.({ durationMinutes: durationMinutes || targetMinutes }, true);
    },
  });

  const handleTogglePlay = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (disabled) return;
    if (timerActive) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  const handleReset = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (disabled) return;
    resetTimer();
  };

  return (
    <div className="rounded-xl p-3 sm:p-3.5 bg-surface-subtle/80 dark:bg-stone-900/60 border border-subtle space-y-3">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-main font-semibold text-2xs uppercase tracking-tight">
          <Timer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Focus Timer</span>
        </div>
        <div className="flex items-center gap-1.5 text-2xs font-medium text-sub">
          <span className="px-2 py-0.5 rounded bg-surface border border-subtle">
            {targetMinutes}m target
          </span>
        </div>
      </div>

      {/* Main Timer Display & Action Controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Time Readout */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-mono font-extrabold text-main tracking-tight">
            {timeFormatted}
          </span>
          {isPaused && (
            <span className="text-2xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Paused
            </span>
          )}
          {timerActive && (
            <span className="inline-block w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse" />
          )}
        </div>

        {/* Action Controls (min 44x44px touch targets) */}
        <div className="flex items-center gap-2">
          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled || (secondsRemaining === targetSeconds && !timerActive)}
            aria-disabled={disabled || (secondsRemaining === targetSeconds && !timerActive)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border border-subtle bg-surface text-muted hover:text-main hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-95"
            aria-label="Reset Timer"
            title="Reset timer to beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Start / Pause Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={disabled}
            aria-disabled={disabled}
            className={`px-4 h-11 min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
              timerActive
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                : 'bg-teal-700 dark:bg-teal-600 hover:bg-teal-800 dark:hover:bg-teal-500 text-white shadow-teal-700/20'
            }`}
            aria-label={timerActive ? 'Pause timer' : 'Start timer'}
          >
            {timerActive ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{secondsRemaining < targetSeconds ? 'Resume' : 'Start'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-600 dark:bg-teal-400 transition-all duration-300 rounded-full"
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>
    </div>
  );
}

export default memo(SlotTimer);
