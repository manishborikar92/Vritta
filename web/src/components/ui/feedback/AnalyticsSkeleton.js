'use client';

import Skeleton from './Skeleton';

/**
 * AnalyticsSkeleton — Content-only loading skeleton for the Analytics page (/analytics).
 *
 * Designed to render inside the shared ProtectedLayout shell:
 * - Tab selector skeleton
 * - 2 Stat metric cards skeleton
 * - Domain consistency highlights skeleton card
 * - Strict reduced-motion compliance via Skeleton primitive
 * - Clean semantic role="status" and aria-busy="true"
 */
export default function AnalyticsSkeleton() {
  return (
    <main
      className="max-w-2xl mx-auto px-4 py-5 sm:py-6 space-y-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading analytics"
    >
      {/* Tab toggle buttons skeleton */}
      <div className="flex bg-surface-subtle p-1 rounded-2xl border border-subtle gap-1">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>

      {/* 2 Top Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-subtle shadow-2xs space-y-2">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
        <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-subtle shadow-2xs space-y-2">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
      </div>

      {/* Domain Highlights Card Skeleton */}
      <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-subtle shadow-2xs space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>

        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3 bg-surface-subtle rounded-xl border border-subtle flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="space-y-1 min-w-0">
                <Skeleton className="h-3.5 w-36 rounded-md" />
                <Skeleton className="h-2.5 w-24 rounded" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </main>
  );
}
