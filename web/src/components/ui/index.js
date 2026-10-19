/**
 * Central UI Component Barrel for Vritta
 *
 * Explicitly exports categorized foundational UI primitives:
 * - navigation: TopNav, BottomNav, ProfileMenu
 * - dialogs: BottomSheet, ConfirmDialog, SignOutDialog
 * - feedback: LoadingSpinner, Skeleton, TodaySkeleton, HabitsSkeleton, InsightsSkeleton
 * - controls: SignInButton, SoundControl, ThemeToggle
 * - display: Avatar, Logo
 * - banners: TodayRhythmBanner
 */

// Navigation
export { default as TopNav } from './navigation/TopNav';
export { default as BottomNav } from './navigation/BottomNav';
export { default as ProfileMenu } from './navigation/ProfileMenu';
export { TodayNavIcon, HabitsNavIcon, InsightsNavIcon } from './navigation/NavIcons';


// Dialogs & Overlays
export { default as BottomSheet } from './dialogs/BottomSheet';
export { default as ConfirmDialog } from './dialogs/ConfirmDialog';
export { default as SignOutDialog } from './dialogs/SignOutDialog';

// Feedback & Loading States
export { default as LoadingSpinner } from './feedback/LoadingSpinner';
export { default as Skeleton } from './feedback/Skeleton';
export { default as TodaySkeleton } from './feedback/TodaySkeleton';
export { default as HabitsSkeleton } from './feedback/HabitsSkeleton';
export { default as InsightsSkeleton } from './feedback/InsightsSkeleton';

// Controls & Preferences
export { default as SignInButton } from './controls/SignInButton';
export { default as SoundControl } from './controls/SoundControl';
export { default as ThemeToggle } from './controls/ThemeToggle';

// Display & Identity
export { default as Avatar } from './display/Avatar';
export { default as Logo } from './display/Logo';

// Banners & Summary Cards
export { default as TodayRhythmBanner } from './banners/TodayRhythmBanner';
