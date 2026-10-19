'use client';

import { BRAND } from '@/lib/constants/brand';
import Logo from '../display/Logo';

const SIZES = {
  sm: 'w-9 h-9 p-2',
  md: 'w-14 h-14 p-3',
  lg: 'w-20 h-20 p-4',
};

/**
 * LoadingSpinner — Brand-aligned loading indicator for auth splash and global states.
 */
export default function LoadingSpinner({
  size = 'md',
  message = 'Mindful Routine Companion',
  className = '',
  fullscreen = true,
}) {
  const containerClasses = fullscreen
    ? `fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas/90 backdrop-blur-xs ${className}`
    : `flex flex-col items-center justify-center py-12 ${className}`;

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      {/* Concentric vessel: parent padding defines the exact orbit gap */}
      <div className="relative flex items-center justify-center p-1.5">
        <div
          className="absolute inset-0 rounded-full border border-subtle border-t-teal-600 dark:border-t-teal-400 motion-safe:animate-[spin_1.6s_linear_infinite] motion-reduce:border-t-subtle"
          aria-hidden="true"
        />

        <div
          className={`relative z-10 flex items-center justify-center rounded-full bg-surface border border-subtle shadow-2xs ${SIZES[size] || SIZES.md}`}
        >
          <Logo className="w-full h-full" />
        </div>
      </div>

      {size !== 'sm' && (
        <div className="mt-4 text-center">
          <p className="text-sm font-medium tracking-tight text-main">
            {BRAND.name}
          </p>
          {message && (
            <p className="mt-0.5 text-xs text-main/60">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}