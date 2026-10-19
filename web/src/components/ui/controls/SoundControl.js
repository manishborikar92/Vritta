'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '@/contexts/SoundContext';

/**
 * Accessible direct sound toggle button for Vritta.
 * Alternates directly between enabled and muted states with zero popovers.
 * Meets WCAG 2.2 Level AA touch target standards (w-10 h-10, 40x40px).
 */
export default function SoundControl({ className = '' }) {
  const { soundEnabled, toggleSound, isMounted } = useSound();

  if (!isMounted) {
    return (
      <div
        className={`w-10 h-10 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const label = soundEnabled ? 'Mute sounds' : 'Enable sounds';

  return (
    <button
      type="button"
      onClick={toggleSound}
      className={`w-10 h-10 p-2 rounded-xl flex items-center justify-center text-sub hover:text-main hover:bg-surface-subtle transition-colors border border-transparent hover:border-subtle shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      aria-label={label}
      title={label}
    >
      {soundEnabled ? (
        <Volume2 className="w-4 h-4 text-teal-700 dark:text-teal-400 transition-colors" aria-hidden="true" />
      ) : (
        <VolumeX className="w-4 h-4 text-stone-400 dark:text-stone-500 transition-colors" aria-hidden="true" />
      )}
    </button>
  );
}
