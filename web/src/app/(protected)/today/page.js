'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useData } from '@/contexts/DataContext';
import { HabitTrackerCard } from '@/components/habits';
import {
  TodaySkeleton,
  TodayRhythmBanner,
} from '@/components/ui';
import { BRAND } from '@/lib/constants/brand';
import { Compass } from 'lucide-react';
import { getTodayString } from '@/utils/date-helpers';

const EMPTY_PROGRESS = Object.freeze({});

export default function TodayPage() {
  const {
    habits,
    todaysHabits,
    todayLog,
    todayProgress,
    userProfile,
    loading,
    error,
    toggleHabit,
    updateProgress,
    updateProfile,
  } = useData();

  // Universal Habit Card Renderer (Phase 3 Unified Habit Card Architecture)
  // Replaces disparate specialized branches with universal feature-driven HabitTrackerCard.
  const renderHabitCard = useCallback((habit) => {
    const isCompleted = todayLog.includes(habit.id);
    const progress = todayProgress[habit.id] || EMPTY_PROGRESS;

    return (
      <HabitTrackerCard
        key={habit.id}
        habit={habit}
        isCompleted={isCompleted}
        progress={progress}
        onToggle={toggleHabit}
        onUpdateProgress={updateProgress}
        userProfile={userProfile}
        onUpdateProfile={updateProfile}
        date={getTodayString()}
      />
    );
  }, [todayLog, todayProgress, userProfile, updateProgress, toggleHabit, updateProfile]);

  if (loading) {
    return <TodaySkeleton />;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-5 sm:py-6 space-y-5">
      {/* Unified Today's Rhythm Banner */}
      <TodayRhythmBanner />

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Empty state: If no habits exist in account */}
      {habits.length === 0 ? (
        <div className="text-center py-12 px-4 bg-surface rounded-2xl border border-subtle shadow-2xs space-y-4">
          <div className="w-14 h-14 bg-teal-50 dark:bg-teal-950/60 rounded-2xl flex items-center justify-center mx-auto text-teal-700 dark:text-teal-400 shadow-2xs">
            <Compass className="w-7 h-7" />
          </div>
          <div className="max-w-sm mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-main">Welcome to {BRAND.name}</h3>
            <p className="text-xs text-sub leading-relaxed">
              Build your daily rhythm by exploring recommended foundation routines or creating custom habits.
            </p>
          </div>
          <Link
            href="/habits"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-teal-700 dark:bg-teal-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-teal-800 dark:hover:bg-teal-500 transition-colors shadow-2xs mx-auto"
          >
            Open Routine Manager
          </Link>
        </div>
      ) : todaysHabits.length === 0 ? (
        <div className="text-center py-12 px-4 bg-surface rounded-2xl border border-subtle shadow-2xs space-y-2">
          <p className="text-sm font-bold text-main">No activities scheduled for today.</p>
          <p className="text-xs text-sub">Enjoy your unscheduled day! Take rest and recharge.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todaysHabits.map(renderHabitCard)}
        </div>
      )}
    </main>
  );
}
