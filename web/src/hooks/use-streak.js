'use client';

import { useMemo } from 'react';
import { calculateStreak } from '@/utils/analytics-helpers';

/**
 * Hook for calculating the user's current streak.
 * 
 * Rules:
 * - A successful day requires >= 50% completion of scheduled, non-rest activities.
 * - Today is given grace if the day is still in progress (04:00 AM grace window).
 * - Planned rest days (e.g. Sunday movement or explicit restDays) are excluded from the denominator.
 * - Supports both array, object structures, and explicit habitOutcomes for dailyLogs entries.
 * 
 * @param {Array} habits - All user habits
 * @param {Object} dailyLogs - Map of dateStr -> completedHabitIds[] or { completedHabitIds, habitProgress, habitOutcomes }
 * @param {string} [timezone] - Optional anchor timezone (defaults to system/browser local timezone)
 * @returns {number} Current streak count
 */
export function useStreak(habits, dailyLogs, timezone) {
    const resolvedTimezone = timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
    return useMemo(() => {
        return calculateStreak(habits, dailyLogs, 30, resolvedTimezone);
    }, [habits, dailyLogs, resolvedTimezone]);
}
