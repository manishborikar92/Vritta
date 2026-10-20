'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { onSnapshot } from 'firebase/firestore';
import {
    getHabitsQuery,
    createHabit,
    updateHabitDoc,
    deleteHabitDoc,
    swapHabitsSortOrder,
} from '@/lib/firebase/firestore';
import { getDayOfWeek, sortHabits } from '@/utils/date-helpers';

/**
 * Hook for managing habits — CRUD operations, real-time sync, and idempotent seeding.
 * @param {import('firebase/auth').User | null} user
 * @returns {Object} Habits state and mutation functions
 */
export function useHabits(user) {
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const isInitialMount = useRef(true);

    const dayOfWeek = getDayOfWeek();

    // Real-time listener for user's habits
    useEffect(() => {
        if (!user) {
            if (isInitialMount.current) {
                isInitialMount.current = false;
                Promise.resolve().then(() => setLoading(false));
            }
            return;
        }

        isInitialMount.current = false;
        const habitsQuery = getHabitsQuery(user.uid);

        const unsubscribe = onSnapshot(habitsQuery, (snapshot) => {
            const habitsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                };
            });
            // Canonical ordering based on sortOrder (first added, first displayed)
            habitsData.sort(sortHabits);
            setHabits(habitsData);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching habits:', err);
            setError('Failed to load habits');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Today's habits filtered by active day of week (or everyday if frequency not set)
    const todaysHabits = useMemo(() => {
        return habits.filter(habit => {
            if (!habit.frequency || habit.frequency === 'daily' || !Array.isArray(habit.frequency) || habit.frequency.length === 0) return true;
            return habit.frequency.includes(dayOfWeek);
        });
    }, [habits, dayOfWeek]);

    // Add a new habit
    const addHabit = useCallback(async (habitData) => {
        if (!user) return;
        return createHabit(user.uid, habitData);
    }, [user]);

    // Update an existing habit
    const updateHabit = useCallback(async (habitId, habitData) => {
        if (!user) return;
        return updateHabitDoc(habitId, habitData);
    }, [user]);

    // Delete a habit
    const deleteHabit = useCallback(async (habitId) => {
        if (!user) return;
        return deleteHabitDoc(habitId);
    }, [user]);

    // Reorder habit (direction: 'up' | 'down') via atomic Firestore transaction
    const reorderHabit = useCallback(async (habitId, direction) => {
        if (!user || !habitId) return;
        const currentIndex = habits.findIndex(h => h.id === habitId);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= habits.length) return;

        const currentHabit = habits[currentIndex];
        const targetHabit = habits[targetIndex];

        return swapHabitsSortOrder(currentHabit.id, targetHabit.id, {
            direction,
            expectedCurrentOrder: currentHabit.sortOrder,
            expectedTargetOrder: targetHabit.sortOrder,
        });
    }, [user, habits]);

    return {
        habits,
        todaysHabits,
        loading,
        error,
        addHabit,
        updateHabit,
        deleteHabit,
        reorderHabit,
    };
}
