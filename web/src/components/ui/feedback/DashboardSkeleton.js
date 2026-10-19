'use client';

import Skeleton from './Skeleton';

/**
 * DashboardSkeleton — Content-only loading skeleton for the Dashboard (/dashboard).
 *
 * Designed to render inside the shared ProtectedLayout shell:
 * - Exact TodayRhythmBanner height (110px mobile / 104px desktop) placeholder
 * - Habit card anatomy placeholders with category top borders and actions
 * - Strict reduced-motion compliance via Skeleton primitive
 * - Clean semantic role="status" and aria-busy="true"
 */
export default function DashboardSkeleton() {
  return (
    <main
      className="max-w-2xl mx-auto px-4 py-5 sm:py-6 space-y-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading dashboard routines"
    >
      {/* Unified Rhythm Banner Skeleton */}
      <div className="rounded-2xl border border-subtle bg-surface p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-3 w-64 rounded-md" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Section Header Skeleton */}
      <div className="flex items-center gap-3 pt-1">
        <Skeleton className="h-4 w-36 rounded-md" />
        <div className="h-px flex-1 bg-subtle" />
      </div>

      {/* Habit Card Skeletons (3 cards matching card anatomy) */}
      <div className="space-y-3 sm:space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-t-[3px] border-subtle bg-surface p-3.5 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex gap-1.5 flex-wrap">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-5 w-44 rounded-lg" />
                <Skeleton className="h-3 w-56 rounded-md" />
              </div>
              <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
            </div>

            {/* Card action/tracker panel placeholder */}
            <div className="p-3 bg-surface-subtle rounded-xl border border-subtle flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-28 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-xl flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
