'use client';

import { useId, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useDismissable } from '@/hooks/useDismissable';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import Avatar from '../display/Avatar';
import BottomSheet from '../dialogs/BottomSheet';
import SoundControl from '../controls/SoundControl';
import ThemeToggle from '../controls/ThemeToggle';

const MOBILE_QUERY = '(max-width: 639px)';

/** Anchored dropdown on tablet/desktop, bottom sheet on phones. */
export default function ProfileMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();

  const name = user.displayName || 'User';

  useDismissable(
    rootRef,
    (reason) => {
      setOpen(false);
      if (reason === 'escape') triggerRef.current?.focus();
    },
    open && !isMobile
  );

  const handleSignOut = () => {
    setOpen(false);
    onSignOut();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        aria-expanded={open}
        aria-controls={open && !isMobile ? panelId : undefined}
        aria-haspopup={isMobile ? 'dialog' : undefined}
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-transparent transition-colors hover:bg-surface-subtle sm:justify-start sm:rounded-xl sm:p-1.5 sm:hover:border-subtle"
      >
        <Avatar key={user.photoURL} photoURL={user.photoURL} name={user.displayName} size={34} />
        <div className="hidden min-w-0 text-left sm:block">
          <p className="max-w-30 truncate text-xs leading-tight font-semibold text-main">{name}</p>
          <p className="max-w-30 truncate text-2xs text-muted" title={user.email}>
            {user.email}
          </p>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'hidden size-3.5 text-muted transition-transform sm:block',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Tablet / desktop */}
      {open && !isMobile && (
        <div
          id={panelId}
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-subtle bg-surface shadow-lg"
        >
          <div className="border-b border-subtle px-3.5 py-3">
            <p className="truncate text-xs font-bold text-main">{name}</p>
            <p className="truncate text-2xs text-muted" title={user.email}>
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-danger transition-colors hover:bg-danger-subtle focus-visible:bg-danger-subtle focus-visible:outline-none"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      )}

      {/* Phones */}
      <BottomSheet open={open && isMobile} onClose={() => setOpen(false)} label="Account">
        <div className="px-4 pt-2.5 pb-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-subtle" aria-hidden="true" />

          <div className="flex items-center gap-3 border-b border-subtle pb-4">
            <Avatar key={user.photoURL} photoURL={user.photoURL} name={user.displayName} size={48} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-main">{name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>

          <div className="border-b border-subtle py-2">
            <div className="flex min-h-12 items-center justify-between">
              <span className="text-sm font-medium text-main">Sound</span>
              <SoundControl />
            </div>
            <div className="flex min-h-12 items-center justify-between">
              <span className="text-sm font-medium text-main">Theme</span>
              <ThemeToggle />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger-subtle text-sm font-semibold text-danger transition-colors active:opacity-80"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
