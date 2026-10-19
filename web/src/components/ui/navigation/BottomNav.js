'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSound } from '@/contexts/SoundContext';
import { NAV_ITEMS, isRouteActive } from '@/lib/constants/navigation';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';
import { cn } from '@/utils/cn';

function NavTab({ href, label, Icon, active, onClick }) {
  return (
    <li className="min-w-0 flex-1">
      <Link
        href={href}
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className="group flex min-h-14 min-w-[56px] py-1.5 w-full select-none items-center justify-center rounded-xl focus-visible:-outline-offset-2"
      >
        {/* Pill indicator behind the icon only (Material 3 / iOS style) */}
        <span className="relative flex h-8 w-16 items-center justify-center">
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-0 rounded-full transition-all duration-200 ease-out motion-reduce:transition-none',
              active
                ? 'scale-100 bg-accent-subtle/60 opacity-100'
                : 'scale-x-50 scale-y-75 bg-surface-subtle opacity-0 group-hover:scale-100 group-hover:opacity-100 group-active:scale-100 group-active:opacity-100'
            )}
          />
          <Icon
            aria-hidden="true"
            className={cn(
              'relative size-5.5 transition-[color,transform] motion-safe:group-active:scale-90',
              active ? 'stroke-[2.3] text-accent' : 'stroke-[1.8] text-muted group-hover:text-main'
            )}
          />
        </span>
        <span className="sr-only">{label}</span>
      </Link>
    </li>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { playTabSwitchCue } = useSound();
  const keyboardOpen = useKeyboardOpen();

  const handleClick = (e, href, active) => {
    // Re-tapping the current tab scrolls to top instead of navigating
    if (pathname === href) {
      e.preventDefault();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    if (!isRouteActive(pathname, href)) {
      playTabSwitchCue?.();
      navigator.vibrate?.(8); // light haptic tick (Android; ignored on iOS)
    }
  };

  return (
    <nav
      aria-label="Main navigation"
      aria-hidden={keyboardOpen || undefined}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t border-subtle/90 bg-surface/95 pb-safe backdrop-blur-md',
        'transition-transform duration-200 motion-reduce:transition-none',
        keyboardOpen ? 'pointer-events-none translate-y-full' : 'translate-y-0'
      )}
    >
      <ul className="mx-auto flex max-w-2xl items-stretch gap-1 px-2 py-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isRouteActive(pathname, href);
          return (
            <NavTab
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={active}
              onClick={(e) => handleClick(e, href, active)}
            />
          );
        })}
      </ul>
    </nav>
  );
}