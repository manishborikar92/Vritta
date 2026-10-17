import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_ROUTINES } from '../src/lib/server/schedule-templates.js';
import {
  calculateDayMetrics,
  calculateStreak,
  isHabitRestDay,
  isHabitRequiredOnDay,
} from '../src/utils/analytics-helpers.js';

describe('Analytics Rest-Day Denominator & Streak Logic', () => {
  it('should exclude Sunday exercise from completion denominator', () => {
    const habitsWithIds = CANONICAL_ROUTINES.map((r, idx) => ({ ...r, id: `habit_${idx}` }));

    const exerciseHabit = habitsWithIds.find(h => h.completionMethod === 'exercise_plan');
    const otherHabits = habitsWithIds.filter(h => h.id !== exerciseHabit.id);
    const otherHabitIds = otherHabits.map(h => h.id);

    // Verify helper rest detection
    assert.equal(isHabitRestDay(exerciseHabit, 'Sun'), true, 'Exercise habit must be rest day on Sun');
    assert.equal(isHabitRequiredOnDay(exerciseHabit, 'Sun'), false, 'Exercise habit must not be required on Sun');

    // On Sunday, user completed all 5 other habits, but did NOT do any workout (as it is planned rest)
    const sundayMetrics = calculateDayMetrics(habitsWithIds, otherHabitIds, 'Sun');

    assert.equal(sundayMetrics.requiredCount, 5, 'Denominator on Sunday must be 5 (excluding exercise), not 6');
    assert.equal(sundayMetrics.completedCount, 5, 'Completed count must be 5');
    assert.equal(sundayMetrics.rate, 100, 'Completion rate must be 100%, not penalized for planned rest');
    assert.equal(sundayMetrics.hasPlannedRest, true, 'Sunday must indicate planned rest');
  });

  it('should include exercise in denominator on Monday workout day', () => {
    const habitsWithIds = CANONICAL_ROUTINES.map((r, idx) => ({ ...r, id: `habit_${idx}` }));
    const exerciseHabit = habitsWithIds.find(h => h.completionMethod === 'exercise_plan');
    const otherHabits = habitsWithIds.filter(h => h.id !== exerciseHabit.id);
    const otherHabitIds = otherHabits.map(h => h.id);

    // Verify helper on Monday
    assert.equal(isHabitRestDay(exerciseHabit, 'Mon'), false, 'Exercise habit must not be rest on Mon');
    assert.equal(isHabitRequiredOnDay(exerciseHabit, 'Mon'), true, 'Exercise habit must be required on Mon');

    // On Monday, if user skips exercise, requiredCount is 6 and completed is 5
    const mondayMetrics = calculateDayMetrics(habitsWithIds, otherHabitIds, 'Mon');

    assert.equal(mondayMetrics.requiredCount, 6, 'Denominator on Monday must be 6 (including workout)');
    assert.equal(mondayMetrics.completedCount, 5);
    assert.equal(mondayMetrics.rate, Math.round((5 / 6) * 100)); // 83%
  });

  it('should not break streak on a day with >= 50% completion of scheduled non-rest activities', () => {
    const habitsWithIds = CANONICAL_ROUTINES.map((r, idx) => ({ ...r, id: `habit_${idx}` }));
    const halfCompletedIds = [habitsWithIds[0].id, habitsWithIds[1].id, habitsWithIds[2].id];

    const metrics = calculateDayMetrics(habitsWithIds, halfCompletedIds, 'Wed');
    assert.ok(metrics.rate >= 50, '3 of 6 is 50%, maintaining consistency rhythm');
  });
});
