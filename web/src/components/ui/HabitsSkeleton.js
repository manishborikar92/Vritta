'use client';

import Skeleton from './Skeleton';

/**
 * HabitsSkeleton — Content-only loading skeleton for the Routine Manager (/habits).
 *
 * Designed to render inside the shared ProtectedLayout shell:
 * - HabitManagerCard anatomy placeholders with category top borders and tag chips
 * - Bottom clearance (pb-32 sm:pb-36) matching the active Routine Manager
 * - Strict reduced-motion compliance via Skeleton primitive
 * - Clean semantic role="status" and aria-busy="true"
 */
export default function HabitsSkeleton() {
  return (
    <main
      className="max-w-2xl mx-auto px-4 py-5 sm:py-6 space-y-3 pb-32 sm:pb-36"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading routine manager"
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-surface rounded-2xl p-4 sm:p-5 shadow-2xs border border-subtle border-t-[3px] space-y-3"
        >
          {/* Header row: Categories, Tags, and Action placeholders */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-8 rounded" />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
          </div>

          {/* Title and description */}
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-52 rounded-lg" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </div>

          {/* Timing and recurrence footer badges */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </main>
  );
}
