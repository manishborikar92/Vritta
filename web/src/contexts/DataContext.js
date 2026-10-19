'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHabits } from '@/hooks/use-habits';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { useStreak } from '@/hooks/use-streak';
import { fetchUserProfile, saveUserProfile } from '@/lib/firebase/firestore';
import { getUserTimezone } from '@/lib/constants/habit-models';

const DataContext = createContext({});

/**
 * DataProvider composes domain-specific hooks and profile state into a single context.
 * Provides both binary toggles and rich, activity-specific progress tracking.
 */
export function DataProvider({ children }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);

  const {
    habits,
    todaysHabits,
    loading: habitsLoading,
    error,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabit,
    seedHabits,
  } = useHabits(user);

  const {
    dailyLogs,
    todayLog,
    todayProgress,
    todayStats,
    toggleHabit,
    updateProgress,
    setHabitOutcome,
    fetchDailyLogs,
  } = useDailyLogs(user, todaysHabits, habits);

  const streak = useStreak(habits, dailyLogs);

  // Fetch long-term user profile & preferences (e.g. 12-week exercise plan, Osho series)
  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setUserProfile(null));
      return;
    }

    let isMounted = true;
    fetchUserProfile(user.uid).then(profile => {
      if (isMounted && profile) {
        setUserProfile(profile);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Save profile updates (e.g. activating exercise plan or updating series talk count)
  const updateProfile = useCallback(async (data) => {
    if (!user) return;
    setUserProfile(prev => ({ ...(prev || {}), ...data }));
    return saveUserProfile(user.uid, data);
  }, [user]);

  const value = useMemo(() => ({
    // State
    habits,
    dailyLogs,
    todayLog,
    todayProgress,
    userProfile,
    userTimezone: getUserTimezone(userProfile),
    loading: habitsLoading,
    error,
    // Computed
    todaysHabits,
    todayStats,
    streak,
    // Actions
    toggleHabit,
    updateProgress,
    setHabitOutcome,
    updateProfile,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabit,
    seedHabits,
    fetchDailyLogs,
  }), [
    habits,
    dailyLogs,
    todayLog,
    todayProgress,
    userProfile,
    habitsLoading,
    error,
    todaysHabits,
    todayStats,
    streak,
    toggleHabit,
    updateProgress,
    setHabitOutcome,
    updateProfile,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabit,
    seedHabits,
    fetchDailyLogs,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
