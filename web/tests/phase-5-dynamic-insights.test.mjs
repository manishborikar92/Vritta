import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isHabitScheduledOnDay,
  isHabitRestDay,
  isHabitRequiredOnDay,
  calculateDayMetrics,
  calculateStreak,
  calculateDynamicAnalytics,
} from '../src/utils/analytics-helpers.js';
import { getDateString, getDaysAgo } from '../src/utils/date-helpers.js';
import { CANONICAL_ROUTINES } from '../src/lib/server/schedule-templates.js';
import { CATEGORY_CONFIG, getCategoryConfig } from '../src/lib/constants/categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 5: Dynamic Insights & Non-Punitive Analytics Engine', () => {

  describe('1. Schedule Recurrence & Frequency Invariants', () => {
    it('should schedule habits with empty or missing frequency on all 7 days', () => {
      const dailyHabit1 = { id: 'h1', title: 'Daily Reading', frequency: [] };
      const dailyHabit2 = { id: 'h2', title: 'Daily Walk' }; // missing frequency
      const dailyHabit3 = { id: 'h3', title: 'Meditation', frequency: null };

      const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (const day of allDays) {
        assert.equal(isHabitScheduledOnDay(dailyHabit1, day), true, `h1 should be scheduled on ${day}`);
        assert.equal(isHabitScheduledOnDay(dailyHabit2, day), true, `h2 should be scheduled on ${day}`);
        assert.equal(isHabitScheduledOnDay(dailyHabit3, day), true, `h3 should be scheduled on ${day}`);
      }
    });

    it('should schedule custom weekday habits strictly on specified days', () => {
      const mwfHabit = {
        id: 'h_mwf',
        title: 'Gym Strength',
        frequency: ['Mon', 'Wed', 'Fri'],
      };

      assert.equal(isHabitScheduledOnDay(mwfHabit, 'Mon'), true);
      assert.equal(isHabitScheduledOnDay(mwfHabit, 'Tue'), false);
      assert.equal(isHabitScheduledOnDay(mwfHabit, 'Wed'), true);
      assert.equal(isHabitScheduledOnDay(mwfHabit, 'Thu'), false);
      assert.equal(isHabitScheduledOnDay(mwfHabit, 'Fri'), true);
      assert.equal(isHabitScheduledOnDay(mwfHabit, 'Sat'), false);
      assert.equal(isHabitScheduledOnDay(mwfHabit, 'Sun'), false);
    });

    it('should return false for null or undefined habit inputs', () => {
      assert.equal(isHabitScheduledOnDay(null, 'Mon'), false);
      assert.equal(isHabitScheduledOnDay(undefined, 'Mon'), false);
      assert.equal(isHabitScheduledOnDay({ id: 'h' }, null), false);
    });
  });

  describe('2. Planned Rest Day Scoping & Confining', () => {
    it('should recognize Sunday rest for canonical exercise plan routines', () => {
      const canonicalPlan = {
        id: 'canon_ex',
        stableKey: 'canonical_exercise_plan',
        category: 'Movement & Strength',
        completionMethod: 'exercise_plan',
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      };

      assert.equal(isHabitRestDay(canonicalPlan, 'Sun'), true, 'Sunday must be rest day for canonical plan');
      assert.equal(isHabitRequiredOnDay(canonicalPlan, 'Sun'), false, 'Canonical plan must not be required on Sun');
      assert.equal(isHabitRestDay(canonicalPlan, 'Mon'), false, 'Monday must not be rest day');
      assert.equal(isHabitRequiredOnDay(canonicalPlan, 'Mon'), true, 'Canonical plan must be required on Mon');
    });

    it('should NOT treat custom Movement & Strength habits as Sunday rest unless configured', () => {
      const customDailyPushups = {
        id: 'custom_pushups',
        title: 'Daily Pushups',
        category: 'Movement & Strength',
        completionMethod: 'simple_checkbox', // not exercise_plan, no canonical key
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      };

      assert.equal(
        isHabitRestDay(customDailyPushups, 'Sun'),
        false,
        'Custom movement habit must NOT default to Sunday rest'
      );
      assert.equal(
        isHabitRequiredOnDay(customDailyPushups, 'Sun'),
        true,
        'Custom movement habit must be required on Sunday'
      );
    });

    it('should respect explicit rest days configured in metadata.restDays for any category', () => {
      const readingWithMidweekRest = {
        id: 'h_read',
        title: 'Deep Reading',
        category: 'Reading',
        completionMethod: 'reading_duration',
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        metadata: {
          restDays: ['Wed', 'Sun'],
        },
      };

      assert.equal(isHabitRestDay(readingWithMidweekRest, 'Wed'), true);
      assert.equal(isHabitRestDay(readingWithMidweekRest, 'Sun'), true);
      assert.equal(isHabitRestDay(readingWithMidweekRest, 'Mon'), false);
      assert.equal(isHabitRequiredOnDay(readingWithMidweekRest, 'Wed'), false);
      assert.equal(isHabitRequiredOnDay(readingWithMidweekRest, 'Mon'), true);
    });
  });

  describe('3. Daily Metrics & Non-Punitive Denominator Rules', () => {
    it('should exclude unscheduled and rest-day habits from the required denominator', () => {
      const habits = [
        { id: 'h1', title: 'Daily 1', frequency: ['Mon', 'Wed'] },
        { id: 'h2', title: 'Daily 2', frequency: ['Tue', 'Thu'] },
        {
          id: 'h3',
          title: 'Movement',
          category: 'Movement & Strength',
          completionMethod: 'exercise_plan',
          stableKey: 'canonical_exercise_plan',
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        },
      ];

      // On Sunday: h1 & h2 unscheduled; h3 is on planned rest.
      const sundayMetrics = calculateDayMetrics(habits, [], 'Sun');
      assert.equal(sundayMetrics.scheduledCount, 0, 'No habits required on Sunday');
      assert.equal(sundayMetrics.isAllRest, true, 'Sunday is pure rest');
      assert.equal(sundayMetrics.rate, 100, 'Pure rest day receives 100% supportive rate');

      // On Tuesday: h2 is scheduled (required). h3 is scheduled (required). h1 is unscheduled.
      // Denominator should be 2. If user completes h2: rate = 1/2 = 50%
      const tuesdayMetrics = calculateDayMetrics(habits, ['h2'], 'Tue');
      assert.equal(tuesdayMetrics.scheduledCount, 2);
      assert.equal(tuesdayMetrics.completedCount, 1);
      assert.equal(tuesdayMetrics.rate, 50);
      assert.equal(tuesdayMetrics.isAllRest, false);
    });

    it('should handle days with zero scheduled habits gracefully', () => {
      const habits = [
        { id: 'h1', title: 'Weekday Only', frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      ];

      const satMetrics = calculateDayMetrics(habits, [], 'Sat');
      assert.equal(satMetrics.rate, null);
      assert.equal(satMetrics.scheduledCount, 0);
      assert.equal(satMetrics.completedCount, 0);
    });
  });

  describe('4. Streak Calculation & Supportive Grace Period', () => {
    it('should maintain streak when completion rate is >= 50%', () => {
      const habits = [
        { id: 'h1', title: 'Habit 1', frequency: [] },
        { id: 'h2', title: 'Habit 2', frequency: [] },
      ];

      // Logs where only 1 of 2 habits is done (50% fulfillment)
      const dailyLogs = {};

      // Yesterday and 2 days ago completed 50%
      const day1 = getDateString(getDaysAgo(1));
      const day2 = getDateString(getDaysAgo(2));
      dailyLogs[day1] = { completedHabitIds: ['h1'] };
      dailyLogs[day2] = { completedHabitIds: ['h2'] };

      const streak = calculateStreak(habits, dailyLogs, 5);
      assert.ok(streak >= 2, `Expected streak >= 2 with 50% completion, got ${streak}`);
    });

    it('should grant grace to today (i=0) without breaking streak', () => {
      const habits = [
        { id: 'h1', title: 'Habit 1', frequency: [] },
      ];

      const dailyLogs = {};
      const yesterday = getDateString(getDaysAgo(1));
      dailyLogs[yesterday] = { completedHabitIds: ['h1'] };
      // Today is empty (in progress)

      const streak = calculateStreak(habits, dailyLogs, 5);
      assert.equal(streak, 1, 'Today in progress should not break streak from yesterday');
    });

    it('should break streak when a past day has < 50% completion', () => {
      const habits = [
        { id: 'h1', title: 'Habit 1', frequency: [] },
        { id: 'h2', title: 'Habit 2', frequency: [] },
      ];

      const dailyLogs = {};
      const day1 = getDateString(getDaysAgo(1));
      const day2 = getDateString(getDaysAgo(2)); // Skipped (0%)
      const day3 = getDateString(getDaysAgo(3)); // Done (100%)

      dailyLogs[day1] = { completedHabitIds: ['h1', 'h2'] };
      dailyLogs[day2] = { completedHabitIds: [] };
      dailyLogs[day3] = { completedHabitIds: ['h1', 'h2'] };

      const streak = calculateStreak(habits, dailyLogs, 5);
      assert.equal(streak, 1, 'Streak should stop at day 2 failure');
    });
  });

  describe('5. Dynamic Category Consistency Highlights', () => {
    it('should dynamically derive categories from user habits without hardcoding', () => {
      const customHabits = [
        {
          id: 'hab_water',
          title: 'Drink 2L Water',
          category: 'Health & Fitness',
          completionMethod: 'simple_checkbox',
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        },
        {
          id: 'hab_journal',
          title: 'Evening Reflection',
          category: 'Reflection & Journaling',
          completionMethod: 'simple_checkbox',
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        },
      ];

      const dailyLogs = {};
      const analytics = calculateDynamicAnalytics(customHabits, dailyLogs, 30);

      assert.equal(analytics.categories.length, 2, 'Should derive exactly 2 categories');
      const catNames = analytics.categories.map(c => c.category);
      assert.ok(catNames.includes('Health & Fitness'));
      assert.ok(catNames.includes('Reflection & Journaling'));

      const healthCat = analytics.categories.find(c => c.category === 'Health & Fitness');
      assert.equal(healthCat.label, 'Health & Fitness');
      assert.equal(healthCat.iconName, 'Activity');
      assert.equal(healthCat.habitCount, 1);
    });

    it('should correctly format canonical personalized schedule routines', () => {
      const habitsWithIds = CANONICAL_ROUTINES.map((r, idx) => ({ ...r, id: `canon_${idx}` }));
      const dailyLogs = {};

      const analytics = calculateDynamicAnalytics(habitsWithIds, dailyLogs, 30);

      assert.ok(analytics.categories.length >= 4, 'Should contain personal routine categories');
      const movementCat = analytics.categories.find(c => c.category === 'Health & Fitness');
      assert.ok(movementCat, 'Health & Fitness category must be present');
      assert.equal(movementCat.badge, 'Sunday Rest Protected', 'Should flag Sunday rest protection');
      assert.equal(movementCat.metricUnit, 'sessions completed');

      const learningCat = analytics.categories.find(c => c.category === 'Learning & Growth');
      assert.ok(learningCat, 'Learning & Growth category must be present');
      assert.equal(learningCat.metricUnit, 'sessions logged');
    });

    it('should handle zero habits gracefully with empty state data', () => {
      const analytics = calculateDynamicAnalytics([], {}, 30);
      assert.equal(analytics.totalActiveDays, 0);
      assert.equal(analytics.completedDays, 0);
      assert.equal(analytics.totalCompletions, 0);
      assert.equal(analytics.avgRate, 0);
      assert.deepEqual(analytics.categories, []);
    });
  });

  describe('6. Design System & Prohibited Color Audit', () => {
    it('should verify zero occurrences of prohibited colors in analytics files', () => {
      const filesToAudit = [
        path.join(__dirname, '../src/app/(protected)/analytics/page.js'),
        path.join(__dirname, '../src/utils/analytics-helpers.js'),
      ];

      const prohibitedTokens = ['purple', 'indigo', 'blue-600'];

      for (const filePath of filesToAudit) {
        assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf-8');

        for (const token of prohibitedTokens) {
          const regex = new RegExp(`\\b${token}\\b`, 'i');
          const matches = content.match(regex);
          assert.equal(
            matches,
            null,
            `Prohibited color token "${token}" found in ${path.basename(filePath)}`
          );
        }
      }
    });

    it('should verify CATEGORY_CONFIG contains zero prohibited color tokens', () => {
      const categoriesFilePath = path.join(__dirname, '../src/lib/constants/categories.js');
      const content = fs.readFileSync(categoriesFilePath, 'utf-8');
      const prohibitedTokens = ['purple', 'indigo', 'blue-600'];

      for (const token of prohibitedTokens) {
        const regex = new RegExp(`\\b${token}\\b`, 'i');
        const matches = content.match(regex);
        assert.equal(
          matches,
          null,
          `Prohibited color token "${token}" found in categories.js`
        );
      }
    });
  });
});
