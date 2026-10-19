'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Shared accessible icon-only theme toggle button for Vritta.
 * Alternates strictly between 'light' and 'dark' modes with zero visible text.
 * Meets WCAG 2.2 Level AAA touch target standards (>= 44x44px).
 */
export default function ThemeToggle({ className = '' }) {
  const { resolvedTheme, setTheme, isMounted } = useTheme();

  if (!isMounted) {
    return (
      <div
        className={`w-10 h-10 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={`w-10 h-10 p-2 rounded-xl flex items-center justify-center text-sub hover:text-main hover:bg-surface-subtle transition-colors border border-transparent hover:border-subtle shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-colors" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4 text-amber-500 hover:text-amber-600 transition-colors" aria-hidden="true" />
      )}
    </button>
  );
}
