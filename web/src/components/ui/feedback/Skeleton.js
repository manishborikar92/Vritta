'use client';

/**
 * Skeleton — Core loading placeholder primitive for Vritta.
 *
 * Implements:
 * - Semantic surface token styling (bg-slate-200/70 dark:bg-slate-800/70)
 * - Strict reduced-motion compliance: motion-safe:animate-pulse, motion-reduce:animate-none
 * - Layout-matching placeholder geometry
 */
export default function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`bg-slate-200/70 dark:bg-slate-800/70 rounded-xl motion-safe:animate-pulse motion-reduce:animate-none transition-colors ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
