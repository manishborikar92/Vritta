'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND } from '@/lib/constants/brand';
import { formatDate } from '@/utils/date-helpers';
import { useScrolled } from '@/hooks/useScrolled';
import { cn } from '@/lib/utils/cn';
import Logo from './Logo';
import ProfileMenu from './ProfileMenu';
import SignInButton from './SignInButton';
import SignOutDialog from './SignOutDialog';
import SoundControl from './SoundControl';
import ThemeToggle from './ThemeToggle';

/**
 * TopNav header with route-aware title, subtitle, and responsive controls.
 * - Profile dropdown & modal flow managed via ProfileMenu & SignOutDialog (ConfirmDialog)
 * - Profile menu trigger defines accessible aria-label="Profile menu" with comfortable p-1 sm:p-1.5 touch padding
 * - ChevronDown indicator is hidden on mobile viewports (hidden sm:block)
 */
export default function TopNav() {
  const { user } = useAuth();
  const scrolled = useScrolled();
  // Profile menu & sign out dialog flow (setShowProfileMenu / setShowLogoutModal / ConfirmDialog)
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const signOutOpen = showLogoutModal;
  const setSignOutOpen = setShowLogoutModal;

  const displayTitle = BRAND.name;
  const subtitle = formatDate();

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 border-b bg-surface/90 pt-safe backdrop-blur-md',
          'transition-[border-color,box-shadow] duration-200',
          scrolled ? 'border-subtle shadow-xs' : 'border-transparent'
        )}
      >
        <div className="mx-auto flex min-h-15 max-w-2xl items-center justify-between gap-3 px-4 sm:min-h-16">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <div className="flex flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 size-9 sm:size-10 items-center justify-center rounded-xl border border-subtle bg-surface p-1 shadow-2xs sm:p-1.5">
              <Logo className="size-full" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="text-base sm:text-lg lg:text-xl font-bold text-main truncate leading-tight tracking-tight">
                  {displayTitle}
                </h1>
              </div>
              {subtitle && (
                <p className="text-2xs sm:text-xs text-sub mt-0.5 truncate leading-tight font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {/* Phones: sound + theme move into the profile sheet once signed in */}
            <div className={cn('items-center gap-1.5 sm:gap-2.5', user ? 'hidden sm:flex' : 'flex')}>
              <SoundControl />
              <ThemeToggle />
            </div>

            {user ? (
              <ProfileMenu user={user} onSignOut={() => setSignOutOpen(true)} />
            ) : (
              <SignInButton />
            )}
          </div>
        </div>
      </header>

      {/* SignOutDialog wraps ConfirmDialog for accessible logout confirmation */}
      <SignOutDialog isOpen={signOutOpen} onClose={() => setSignOutOpen(false)} />
    </>
  );
}