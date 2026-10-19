'use client';

import { memo } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

/**
 * TodayRhythmBanner: Unified, responsive hero summary banner on the Dashboard.
 * 
 * Consolidates streak tracking, supportive coaching philosophy, daily completion
 * metrics, and progress visualization into a single, cohesive, mobile-first card.
 */
function TodayRhythmBanner({
  streak: propStreak,
  todayStats: propTodayStats,
  loading: propLoading,
}) {
  const data = useData();
  const streak = propStreak !== undefined ? propStreak : (data?.streak ?? 0);
  const todayStats = propTodayStats !== undefined ? propTodayStats : (data?.todayStats ?? {
    total: 0,
    completed: 0,
    percentage: 0,
    isSunday: false,
  });
  const loading = propLoading !== undefined ? propLoading : (data?.loading ?? false);

  if (loading) {
    return (
      <div
        className="p-3 sm:p-4 bg-slate-100/70 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 animate-pulse"
        role="status"
        aria-label="Loading rhythm progress"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
          </div>
          <div className="h-5 sm:h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20 sm:w-24" />
        </div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-48 mt-2" />
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2.5" />
      </div>
    );
  }

  const allCompletedToday = todayStats.total > 0 && todayStats.completed >= todayStats.total;

  const coachingMessage = todayStats.isSunday
    ? 'Sunday restoration: Planned rest maintains your long-term consistency.'
    : streak > 0
    ? 'Consistency over rigidity. Every completed session anchors the habit.'
    : 'Begin gently today. Preferred times are soft guides, not deadlines.';

  // Format single unified completion metric without duplication
  const metricTextMobile = todayStats.total > 0
    ? `${todayStats.completed}/${todayStats.total} • ${todayStats.percentage}%`
    : todayStats.isSunday
    ? 'Planned Rest'
    : 'Rest Day';

  const metricTextDesktop = todayStats.total > 0
    ? `${todayStats.completed} of ${todayStats.total} done • ${todayStats.percentage}%`
    : todayStats.isSunday
    ? 'Planned Rest Day'
    : 'No activities today';

  return (
    <section
      aria-label="Today's Rhythm and Progress"
      className="p-3 sm:p-4 bg-gradient-to-r from-amber-50/60 via-surface to-teal-50/50 dark:from-amber-950/20 dark:via-surface dark:to-teal-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 shadow-2xs transition-colors"
    >
      {/* Row 1: Streak Headline (Left) & Unified Completion Badge (Right) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-main whitespace-nowrap">
            {streak} {streak === 1 ? 'Day' : 'Days'} Steady Rhythm
          </span>
        </div>

        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-2xs sm:text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-teal-200 dark:border-teal-800/60 whitespace-nowrap">
            <span className="sm:hidden">{metricTextMobile}</span>
            <span className="hidden sm:inline">{metricTextDesktop}</span>
          </span>
        </div>
      </div>

      {/* Row 2: Supportive Coaching Message */}
      <p className="text-2xs text-sub leading-relaxed mt-1 line-clamp-2">
        {coachingMessage}
      </p>

      {/* Row 3: Compact Progress Bar */}
      <div
        className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden mt-2"
        role="progressbar"
        aria-valuenow={todayStats.percentage}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Today's routine completion progress"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            allCompletedToday
              ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
              : 'bg-gradient-to-r from-teal-600 to-teal-400 dark:from-teal-500 dark:to-teal-300'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, todayStats.percentage))}%` }}
        />
      </div>

      {/* Row 4: All Planned Activities Completed (Celebration State) */}
      {allCompletedToday && (
        <div className="mt-2 flex items-center gap-1.5 text-2xs sm:text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>All planned activities completed for today! Relax and enjoy your evening.</span>
        </div>
      )}
    </section>
  );
}

export default memo(TodayRhythmBanner);
