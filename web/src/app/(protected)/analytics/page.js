'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Check,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Clock,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Flame,
  X,
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useSound } from '@/contexts';
import { AnalyticsSkeleton } from '@/components/ui';
import { formatDate, parseDateString } from '@/utils/date-helpers';
import {
  calculateMonthlyAnalytics,
  DAY_TO_COLUMN,
} from '@/lib/analytics/consistency-engine';

export default function AnalyticsPage() {
  const { habits, dailyLogs, fetchDailyLogs, loading, userProfile } = useData();
  const { playTabSwitchCue } = useSound();

  // User anchor timezone
  const timezone = useMemo(() => {
    return (
      userProfile?.preferences?.timezone ||
      (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') ||
      'UTC'
    );
  }, [userProfile?.preferences?.timezone]);

  // Initial month based on current local date
  const now = useMemo(() => new Date(), []);
  const initialYear = now.getFullYear();
  const initialMonth = now.getMonth() + 1; // 1-12

  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('calendar');

  const handleViewModeChange = (nextMode) => {
    if (nextMode !== viewMode) {
      setViewMode(nextMode);
      playTabSwitchCue?.();
    }
  };

  // Fetch historical logs on mount
  useEffect(() => {
    fetchDailyLogs();
  }, [fetchDailyLogs]);

  // Navigate to previous month
  const handlePrevMonth = useCallback(() => {
    playTabSwitchCue?.();
    setSelectedDate(null);
    setCurrentMonth(prevM => {
      if (prevM === 1) {
        setCurrentYear(prevY => prevY - 1);
        return 12;
      }
      return prevM - 1;
    });
  }, [playTabSwitchCue]);

  // Navigate to next month
  const handleNextMonth = useCallback(() => {
    playTabSwitchCue?.();
    setSelectedDate(null);
    setCurrentMonth(prevM => {
      if (prevM === 12) {
        setCurrentYear(prevY => prevY + 1);
        return 1;
      }
      return prevM + 1;
    });
  }, [playTabSwitchCue]);

  // Jump to today shortcut
  const handleTodayShortcut = useCallback(() => {
    playTabSwitchCue?.();
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    setCurrentYear(todayYear);
    setCurrentMonth(todayMonth);
    // Format YYYY-MM-DD
    const yStr = todayYear;
    const mStr = String(todayMonth).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yStr}-${mStr}-${dStr}`);
  }, [playTabSwitchCue]);

  // Month-based analytics calculation
  const monthlyData = useMemo(() => {
    return calculateMonthlyAnalytics(habits, dailyLogs, {
      year: currentYear,
      month: currentMonth,
      now,
      timezone,
    });
  }, [habits, dailyLogs, currentYear, currentMonth, now, timezone]);

  // Selected date evaluations lookup
  const selectedDayData = useMemo(() => {
    if (!selectedDate || !monthlyData.calendarDays) return null;
    const dayItem = monthlyData.calendarDays.find(d => d.dateStr === selectedDate);
    if (!dayItem) return null;

    // Filter evaluations to relevant scheduled, rest, or completed routines
    const relevantEvaluations = dayItem.evaluations.filter(({ evaluation }) => {
      return evaluation.isScheduled || evaluation.isRestDay || evaluation.isCompleted;
    });

    return {
      dayItem,
      evaluations: relevantEvaluations,
    };
  }, [selectedDate, monthlyData.calendarDays]);

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  const { summary } = monthlyData;
  const completionRate = summary.monthlyCompletionRate;

  return (
    <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 sm:space-y-5">
      {/* Page Heading */}
      <div className="space-y-0.5 px-0.5">
        <h1 className="text-base sm:text-lg font-bold text-main leading-snug">
          Rhythm &amp; Consistency
        </h1>
        <p className="text-2xs sm:text-xs text-muted leading-tight">
          A calm, non-punitive monthly overview of your routines and natural momentum.
        </p>
      </div>

      {/* 1. Monthly Summary Card: Calm, Non-Punitive Metrics */}
      <div className="bg-surface rounded-2xl p-3.5 sm:p-5 border border-subtle shadow-xs space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <span className="text-2xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider truncate block">
              {monthlyData.monthLabel} Overview {/* 30-Day Consistency */}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight leading-none">
              {completionRate !== null ? `${completionRate}%` : '—'}
            </div>
          </div>

          {/* Active Streak Badge */}
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
              <span className="whitespace-nowrap">{summary.currentStreak} {summary.currentStreak === 1 ? 'day' : 'days'} streak</span>
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden">
          <div
            className="bg-teal-600 dark:bg-teal-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${completionRate ?? 0}%` }}
          />
        </div>

        {/* Counts Breakdown */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1 border-t border-subtle text-center text-xs">
          <div className="p-1.5 sm:p-2 rounded-xl bg-surface-subtle min-w-0">
            <span className="text-2xs text-muted block font-medium truncate">Completed</span>
            <span className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400">
              {summary.totalCompletedOccurrences}
            </span>
          </div>
          <div className="p-1.5 sm:p-2 rounded-xl bg-surface-subtle min-w-0">
            <span className="text-2xs text-muted block font-medium truncate">Missed</span>
            <span className="text-sm sm:text-base font-bold text-rose-700 dark:text-rose-400">
              {summary.totalMissedOccurrences}
            </span>
          </div>
          <div className="p-1.5 sm:p-2 rounded-xl bg-surface-subtle min-w-0">
            <span className="text-2xs text-muted block font-medium truncate">Planned Rest</span>
            <span className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-400">
              {summary.totalRestOccurrences}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Month Calendar */}
      <div className="bg-surface rounded-2xl p-3 sm:p-5 border border-subtle shadow-xs space-y-3.5 sm:space-y-4">
        {/* Calendar Navigation Bar */}
        <div className="flex items-center justify-between gap-2">
          {/* Month & Year Title */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <CalendarIcon className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <h2 className="text-sm sm:text-base lg:text-lg font-bold text-main whitespace-nowrap truncate">
              {monthlyData.monthLabel}
            </h2>
          </div>

          {/* Controls: Prev, Today, Next */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleTodayShortcut}
              className="text-xs font-semibold px-2.5 py-1 h-9 min-h-[36px] sm:h-10 sm:min-h-[40px] rounded-xl border border-subtle bg-surface hover:bg-surface-subtle text-main transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 flex items-center justify-center"
              title="Go to today"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-9 h-9 min-w-[36px] min-h-[36px] sm:w-10 sm:h-10 sm:min-w-[40px] sm:min-h-[40px] rounded-xl border border-subtle bg-surface hover:bg-surface-subtle text-main flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              aria-label="Previous month"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-9 h-9 min-w-[36px] min-h-[36px] sm:w-10 sm:h-10 sm:min-w-[40px] sm:min-h-[40px] rounded-xl border border-subtle bg-surface hover:bg-surface-subtle text-main flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              aria-label="Next month"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="w-full">
          {/* Mon-Sun Day Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-2xs font-bold text-muted py-1.5 mb-1 border-b border-subtle">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="min-h-[18px] flex items-center justify-center truncate">
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {/* Leading Spacers for month alignment */}
            {Array.from({ length: monthlyData.firstDayColumn }, (_, i) => (
              <div key={`spacer-${i}`} className="w-full min-h-[44px] sm:min-h-[48px]" />
            ))}

            {/* Month Day Cells */}
            {monthlyData.calendarDays.map(day => {
              const isSelected = selectedDate === day.dateStr;

              let cellBg = 'bg-surface hover:bg-surface-subtle border-subtle text-main';
              let indicatorBadge = null;

              if (day.indicatorStatus === 'completed') {
                // 100% completed
                cellBg = 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-100';
                indicatorBadge = (
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                    <Check className="w-2 h-2 stroke-[3]" />
                  </span>
                );
              } else if (day.indicatorStatus === 'partial') {
                // >= 50% partial
                cellBg = 'bg-teal-50/60 dark:bg-teal-950/20 border-teal-200/60 dark:border-teal-800/40 text-teal-950 dark:text-teal-100';
                indicatorBadge = (
                  <span className="text-3xs font-bold text-teal-700 dark:text-teal-300 leading-none">
                    {day.completedCount}/{day.requiredCount}
                  </span>
                );
              } else if (day.indicatorStatus === 'all_rest') {
                // Scheduled rest day
                cellBg = 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-100';
                indicatorBadge = (
                  <span className="flex items-center gap-0.5 text-3xs font-semibold text-amber-700 dark:text-amber-300">
                    <Coffee className="w-2.5 h-2.5" />
                    <span className="hidden sm:inline">rest</span>
                  </span>
                );
              } else if (day.indicatorStatus === 'in_progress') {
                // Today / grace period
                cellBg = 'bg-surface border-teal-500 ring-1 ring-teal-500/50 text-teal-800 dark:text-teal-200';
                indicatorBadge = (
                  <span className="w-2 h-2 rounded-full border border-teal-500 bg-teal-500/40 dark:bg-teal-400/40 animate-pulse" />
                );
              } else if (day.indicatorStatus === 'missed') {
                // Automatically derived missed on past closed day
                cellBg = 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/40 text-rose-900 dark:text-rose-200';
                indicatorBadge = (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400" />
                );
              } else if (day.indicatorStatus === 'future') {
                // Future day
                cellBg = 'bg-surface/50 border-subtle/50 text-muted/60 opacity-60';
              } else {
                // Unscheduled day
                cellBg = 'bg-surface-subtle/40 border-transparent text-muted/50';
              }

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(isSelected ? null : day.dateStr);
                    playTabSwitchCue?.();
                  }}
                  className={`w-full min-h-[44px] sm:min-h-[48px] p-1 sm:p-1.5 rounded-xl border flex flex-col items-center justify-between transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${cellBg} ${
                    isSelected
                      ? 'ring-2 ring-teal-600 dark:ring-teal-400 ring-offset-2 ring-offset-surface shadow-xs font-bold z-10'
                      : ''
                  }`}
                  aria-label={`${day.dateStr}: ${
                    day.isAllRest
                      ? 'Planned Rest'
                      : day.indicatorStatus === 'completed'
                      ? 'Completed'
                      : day.indicatorStatus === 'partial'
                      ? `${day.dayRate}% completed`
                      : day.indicatorStatus === 'in_progress'
                      ? 'Today in progress'
                      : day.indicatorStatus === 'missed'
                      ? 'Missed'
                      : day.indicatorStatus === 'future'
                      ? 'Upcoming'
                      : 'Unscheduled'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className={`text-xs font-medium leading-none ${day.isToday ? 'font-bold text-teal-700 dark:text-teal-300' : ''}`}>
                    {day.dayNum}
                  </span>
                  <div className="h-4 flex items-center justify-center w-full">
                    {indicatorBadge}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Compact Plain-Language Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1.5 pt-2.5 sm:pt-3 border-t border-subtle text-2xs text-sub">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 flex items-center justify-center text-white">
              <Check className="w-2 h-2 stroke-[3]" />
            </span>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
            <span>Partial (&ge;50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Coffee className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Planned Rest</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-teal-500 bg-teal-500/30" />
            <span>Today (In Progress)</span>
          </div>
        </div>
      </div>

      {/* 4. Selected Day Detail View (Drawer) */}
      {selectedDayData && (
        <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-subtle shadow-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-subtle">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-main">
                {formatDate(selectedDate)}
              </h3>
              <p className="text-2xs text-sub">
                Scheduled routines and real statuses for this observance date.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="min-h-[44px] min-w-[44px] rounded-xl text-sub hover:text-main hover:bg-surface-subtle flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              aria-label="Close day details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {selectedDayData.evaluations.length === 0 ? (
              <p className="text-xs text-sub py-3 text-center">
                No active routines were scheduled or recorded for this date.
              </p>
            ) : (
              selectedDayData.evaluations.map(({ habit, evaluation }) => {
                const isComp = evaluation.isCompleted;
                const isRest = evaluation.isRestDay;
                const isMiss = evaluation.status === 'missed';
                const isSkip = evaluation.status === 'skipped';
                const isInProg = evaluation.status === 'in_progress';
                const dayProgress = dailyLogs?.[selectedDate]?.habitProgress?.[habit.id];

                return (
                  <div
                    key={habit.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                      isComp
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/40'
                        : isRest
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/40'
                        : isMiss
                        ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200/40 dark:border-rose-900/30'
                        : isSkip
                        ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'
                        : isInProg
                        ? 'bg-teal-50/30 dark:bg-teal-950/20 border-teal-200/40 dark:border-teal-900/30'
                        : 'bg-surface-subtle border-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Status Icon */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isComp
                            ? 'bg-emerald-600 text-white'
                            : isRest
                            ? 'bg-amber-500 text-white'
                            : isMiss
                            ? 'bg-rose-500 text-white'
                            : isSkip
                            ? 'bg-slate-400 text-white'
                            : isInProg
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-sub'
                        }`}
                      >
                        {isComp && <Check className="w-4 h-4 stroke-[3]" />}
                        {isRest && <Coffee className="w-4 h-4" />}
                        {isMiss && <span className="text-xs font-bold leading-none">&times;</span>}
                        {isSkip && <span className="text-3xs font-bold">SKIP</span>}
                        {isInProg && <Clock className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <span className="font-bold text-main block truncate">
                          {habit.title}
                        </span>
                        <span className="text-2xs text-sub block truncate">
                          {habit.category || 'General'}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill & Notes */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {dayProgress?.notes && (
                        <span className="text-3xs text-muted max-w-[140px] truncate italic">
                          &ldquo;{dayProgress.notes}&rdquo;
                        </span>
                      )}
                      <span
                        className={`text-2xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          isComp
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : isRest
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : isMiss
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                            : isSkip
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            : isInProg
                            ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800'
                            : 'bg-surface text-sub border-subtle'
                        }`}
                      >
                        {evaluation.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </main>
  );
}
