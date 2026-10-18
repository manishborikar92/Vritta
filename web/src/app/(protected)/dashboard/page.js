'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useData } from '@/contexts/DataContext';
import {
  DashboardHabitCard,
  TodayRhythmBanner,
} from '@/components/habits';
import { DashboardSkeleton } from '@/components/ui';
import { BRAND } from '@/lib/constants/brand';
import { Compass } from 'lucide-react';
import { getTodayString } from '@/utils/date-helpers';

const EMPTY_PROGRESS = Object.freeze({});

export default function DashboardPage() {

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

  // Standardized daily timing rhythm grouping: Morning / Afternoon / Evening / Before Bed / Flexible
  const groupedHabits = useMemo(() => {
    const morning = [];
    const afternoon = [];
    const evening = [];
    const beforeBed = [];
    const flexible = [];

    todaysHabits.forEach(habit => {
      const timingType = habit.timingType || '';
      const period = String(habit.preferredPeriod || habit.time || '').toLowerCase();
      const relative = String(habit.relativeTiming || '').toLowerCase();

      // 1. Flexible / Anytime
      if (
        timingType === 'anytime' ||
        period === 'flexible' ||
        (!period && !relative && timingType !== 'exact')
      ) {
        flexible.push(habit);
      } else if (
        relative.includes('bed') ||
        period.includes('bed') ||
        period.includes('night') ||
        relative.includes('night')
      ) {
        beforeBed.push(habit);
      } else if (
        period.includes('morning') ||
        relative.includes('waking') ||
        relative.includes('breakfast')
      ) {
        morning.push(habit);
      } else if (
        period.includes('afternoon') ||
        period.includes('midday') ||
        relative.includes('lunch')
      ) {
        afternoon.push(habit);
      } else if (
        period.includes('evening') ||
        relative.includes('evening') ||
        relative.includes('wind-down') ||
        relative.includes('dinner')
      ) {
        evening.push(habit);
      } else if (timingType === 'exact' && habit.time) {
        const timeStr = String(habit.time).toUpperCase().trim();
        if (timeStr.includes('AM')) {
          const match = timeStr.match(/^(\d{1,2})/);
          const hour = match ? parseInt(match[1], 10) : 8;
          if (hour === 12) {
            beforeBed.push(habit);
          } else {
            morning.push(habit);
          }
        } else if (timeStr.includes('PM')) {
          const match = timeStr.match(/^(\d{1,2})/);
          const hour = match ? parseInt(match[1], 10) : 12;
          if (hour === 12 || hour < 5) {
            afternoon.push(habit);
          } else if (hour < 9) {
            evening.push(habit);
          } else {
            beforeBed.push(habit);
          }
        } else {
          flexible.push(habit);
        }
      } else {
        flexible.push(habit);
      }
    });

    return { morning, afternoon, evening, beforeBed, flexible };
  }, [todaysHabits]);

  // Universal Habit Card Renderer (Phase 3 Unified Habit Card Architecture)
  // Replaces disparate specialized branches with universal feature-driven DashboardHabitCard.
  const renderHabitCard = useCallback((habit) => {
    const isCompleted = todayLog.includes(habit.id);
    const progress = todayProgress[habit.id] || EMPTY_PROGRESS;

    return (
      <DashboardHabitCard
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
    return <DashboardSkeleton />;
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
          <div className="space-y-6">
            {/* 1. Flexible / Anytime */}
            {groupedHabits.flexible.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-sub uppercase tracking-wider">
                    Flexible / Anytime
                  </span>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                </div>
                <div className="space-y-3">
                  {groupedHabits.flexible.map(renderHabitCard)}
                </div>
              </section>
            )}

            {/* 2. Morning Routines */}
            {groupedHabits.morning.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                    Morning
                  </span>
                  <div className="h-px bg-amber-200 dark:bg-amber-900/50 flex-1" />
                </div>
                <div className="space-y-3">
                  {groupedHabits.morning.map(renderHabitCard)}
                </div>
              </section>
            )}

            {/* 3. Afternoon Preferred */}
            {groupedHabits.afternoon.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                    Afternoon
                  </span>
                  <div className="h-px bg-teal-200 dark:bg-teal-900/50 flex-1" />
                </div>
                <div className="space-y-3">
                  {groupedHabits.afternoon.map(renderHabitCard)}
                </div>
              </section>
            )}

            {/* 4. Evening */}
            {groupedHabits.evening.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                    Evening
                  </span>
                  <div className="h-px bg-teal-200 dark:bg-teal-900/50 flex-1" />
                </div>
                <div className="space-y-3">
                  {groupedHabits.evening.map(renderHabitCard)}
                </div>
              </section>
            )}

            {/* 5. Before Bed */}
            {groupedHabits.beforeBed.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Before Bed
                  </span>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                </div>
                <div className="space-y-3">
                  {groupedHabits.beforeBed.map(renderHabitCard)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
  );
}
