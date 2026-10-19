'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTimerContext } from '@/contexts/TimerContext';
import {
  unlockAudio,
  playStartCue,
  playPauseCue,
  playResumeCue,
  playResetCue,
  playCompletionChime,
} from '@/utils/audio-chime';
import { requestNotificationPermission, sendTimerNotification } from '@/utils/timer-notifications';

/**
 * useTimer — Configurable, background-resilient countdown timer hook.
 *
 * Connects to the global TimerContext when available (preserving countdowns across route navigation),
 * or falls back to local state and localStorage persistence for isolated component testing.
 *
 * @param {Object} options
 * @param {string} options.habitId
 * @param {number} [options.initialTargetMinutes=30]
 * @param {boolean} [options.isCompleted=false]
 * @param {Function} [options.onComplete]
 * @returns {Object} Timer state and actions
 */
export function useTimer({
  habitId,
  initialTargetMinutes = 30,
  isCompleted = false,
  onComplete,
}) {
  const context = useTimerContext();

  // Local state for standalone mode (or when context is absent)
  const [localTargetMinutes, setLocalTargetMinutes] = useState(() => {
    if (typeof window === 'undefined' || !habitId) return initialTargetMinutes;
    try {
      const raw = localStorage.getItem(`vritta_timer_${habitId}`);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.targetMinutes) return p.targetMinutes;
      }
    } catch {
      // Storage read error fallback
    }
    return initialTargetMinutes;
  });

  const localTargetSeconds = localTargetMinutes * 60;

  const [localSecondsRemaining, setLocalSecondsRemaining] = useState(() => {
    if (typeof window === 'undefined' || !habitId) return initialTargetMinutes * 60;
    try {
      const raw = localStorage.getItem(`vritta_timer_${habitId}`);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.isRunning && p.targetEndTime) {
          return Math.max(0, Math.ceil((p.targetEndTime - Date.now()) / 1000));
        }
        if (p?.isPaused && typeof p.secondsRemaining === 'number') {
          return p.secondsRemaining;
        }
      }
    } catch {
      // Storage read error fallback
    }
    return initialTargetMinutes * 60;
  });

  const [localTimerActive, setLocalTimerActive] = useState(() => {
    if (typeof window === 'undefined' || !habitId) return false;
    try {
      const raw = localStorage.getItem(`vritta_timer_${habitId}`);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.isRunning && p.targetEndTime) {
          return Date.now() < p.targetEndTime;
        }
      }
    } catch {
      // Storage read error fallback
    }
    return false;
  });

  const [localIsPaused, setLocalIsPaused] = useState(() => {
    if (typeof window === 'undefined' || !habitId) return false;
    try {
      const raw = localStorage.getItem(`vritta_timer_${habitId}`);
      if (raw) {
        const p = JSON.parse(raw);
        return Boolean(p?.isPaused);
      }
    } catch {
      // Storage read error fallback
    }
    return false;
  });

  const targetEndTimeRef = useRef(null);
  const timerRef = useRef(null);
  const storageKey = habitId ? `vritta_timer_${habitId}` : null;

  // Context callback registration (UI notification only; TimerContext authoritatively owns updateProgress)
  useEffect(() => {
    if (!context) return;
    // Purge legacy standalone storage entry to prevent stale split-brain cache
    if (storageKey && typeof window !== 'undefined') {
      try { localStorage.removeItem(storageKey); } catch {}
    }
    return context.registerTimerCallback(habitId, {
      onFinish: () => {
        // TimerContext handles Firestore progress and notifications authoritatively.
      },
    });
  }, [context, habitId, storageKey]);

  // Sync initialTargetMinutes in standalone mode when idle without useEffect cascading renders
  const [prevInitialTarget, setPrevInitialTarget] = useState(initialTargetMinutes);
  if (prevInitialTarget !== initialTargetMinutes) {
    setPrevInitialTarget(initialTargetMinutes);
    if (!context && !localTimerActive && !localIsPaused) {
      setLocalTargetMinutes(initialTargetMinutes);
      setLocalSecondsRemaining(initialTargetMinutes * 60);
    }
  }

  // Standalone tick loop (only runs if context is null)
  useEffect(() => {
    if (context || !localTimerActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setLocalTimerActive(false);
        setLocalIsPaused(false);
        setLocalSecondsRemaining(0);
        if (storageKey) {
          try { localStorage.removeItem(storageKey); } catch {}
        }
        playCompletionChime();
        if (typeof document !== 'undefined' && document.hidden) {
          sendTimerNotification('Reading Session Finished', `You completed your ${localTargetMinutes}-minute focus session!`);
        }
        onComplete?.({ durationMinutes: localTargetMinutes, elapsedSeconds: localTargetSeconds });
      } else {
        setLocalSecondsRemaining(remaining);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [context, localTimerActive, localTargetMinutes, localTargetSeconds, storageKey, onComplete]);

  // Standalone visibility sync (only runs if context is null)
  useEffect(() => {
    if (context || typeof document === 'undefined') return;

    const syncTime = () => {
      if (!localTimerActive || !targetEndTimeRef.current) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
      if (remaining <= 0) {
        setLocalSecondsRemaining(0);
        setLocalTimerActive(false);
        setLocalIsPaused(false);
        if (storageKey) {
          try { localStorage.removeItem(storageKey); } catch {}
        }
        playCompletionChime();
        onComplete?.({ durationMinutes: localTargetMinutes, elapsedSeconds: localTargetSeconds });
      } else {
        setLocalSecondsRemaining(remaining);
      }
    };

    document.addEventListener('visibilitychange', syncTime);
    window.addEventListener('focus', syncTime);

    return () => {
      document.removeEventListener('visibilitychange', syncTime);
      window.removeEventListener('focus', syncTime);
    };
  }, [context, localTimerActive, localTargetMinutes, localTargetSeconds, storageKey, onComplete]);

  // Context-driven state
  const ctxState = context ? context.getTimerState(habitId, initialTargetMinutes) : null;

  // Actions
  const startTimer = useCallback(() => {
    if (context) {
      context.startTimer(habitId, ctxState?.targetMinutes || initialTargetMinutes);
      return;
    }

    // If timer is already running in standalone mode, avoid duplicate triggers
    if (localTimerActive) {
      return;
    }

    unlockAudio();
    requestNotificationPermission().catch(() => {});

    const isResuming = Boolean(localIsPaused && localSecondsRemaining > 0 && localSecondsRemaining < localTargetSeconds);
    const remaining = isResuming ? localSecondsRemaining : localTargetSeconds;
    const endTime = Date.now() + remaining * 1000;
    targetEndTimeRef.current = endTime;

    if (isResuming) {
      playResumeCue();
    } else {
      playStartCue();
    }

    setLocalSecondsRemaining(remaining);
    setLocalTimerActive(true);
    setLocalIsPaused(false);

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          habitId,
          targetMinutes: localTargetMinutes,
          targetSeconds: localTargetSeconds,
          targetEndTime: endTime,
          isRunning: true,
          isPaused: false,
        }));
      } catch {}
    }
  }, [context, habitId, ctxState?.targetMinutes, initialTargetMinutes, localTimerActive, localIsPaused, localSecondsRemaining, localTargetSeconds, storageKey, localTargetMinutes]);

  const pauseTimer = useCallback(() => {
    if (context) {
      context.pauseTimer(habitId);
      return;
    }

    if (!localTimerActive) return;

    if (timerRef.current) clearInterval(timerRef.current);
    playPauseCue();
    setLocalTimerActive(false);
    setLocalIsPaused(true);

    const remaining = targetEndTimeRef.current
      ? Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000))
      : localSecondsRemaining;

    setLocalSecondsRemaining(remaining);

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          habitId,
          targetMinutes: localTargetMinutes,
          targetSeconds: localTargetSeconds,
          secondsRemaining: remaining,
          isRunning: false,
          isPaused: true,
        }));
      } catch {}
    }
  }, [context, habitId, localTimerActive, localSecondsRemaining, storageKey, localTargetMinutes, localTargetSeconds]);

  const resetTimer = useCallback(() => {
    if (context) {
      context.resetTimer(habitId, ctxState?.targetMinutes || initialTargetMinutes);
      return;
    }

    const canReset = localTimerActive || (localIsPaused && localSecondsRemaining < localTargetSeconds);
    if (!canReset) return;

    if (timerRef.current) clearInterval(timerRef.current);
    playResetCue();
    setLocalTimerActive(false);
    setLocalIsPaused(false);
    targetEndTimeRef.current = null;
    setLocalSecondsRemaining(localTargetSeconds);

    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }, [context, habitId, ctxState?.targetMinutes, initialTargetMinutes, localTimerActive, localIsPaused, localSecondsRemaining, localTargetSeconds, storageKey]);

  const setDuration = useCallback((mins) => {
    if (context) {
      context.setTimerDuration(habitId, mins);
      return;
    }

    if (localTimerActive || !mins || mins < 1) return;
    setLocalTargetMinutes(mins);
    setLocalSecondsRemaining(mins * 60);
  }, [context, habitId, localTimerActive]);

  // Derived values
  const targetMinutes = context ? ctxState.targetMinutes : localTargetMinutes;
  const targetSeconds = context ? ctxState.targetSeconds : localTargetSeconds;
  const secondsRemaining = context ? ctxState.secondsRemaining : localSecondsRemaining;
  const timerActive = context ? ctxState.isRunning : localTimerActive;
  const isPaused = context ? ctxState.isPaused : localIsPaused;
  const progressPercent = context
    ? ctxState.progressPercent
    : Math.min(100, Math.max(0, Math.round(((targetSeconds - secondsRemaining) / targetSeconds) * 100)));

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    targetMinutes,
    targetSeconds,
    secondsRemaining,
    timerActive,
    isPaused,
    progressPercent,
    minutes,
    seconds,
    timeFormatted,
    startTimer,
    pauseTimer,
    resetTimer,
    setDuration,
  };
}
