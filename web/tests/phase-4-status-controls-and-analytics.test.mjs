import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateHabitDayScenario,
  calculateHabitConsistency,
  calculateLifetimeAnalytics,
} from '../src/lib/analytics/consistency-engine.js';

const ROOT_DIR = path.resolve(process.cwd());

function readWebFile(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

describe('Phase 4: Status Controls Semantics, Persistence & Analytics Engine', () => {
  const baseHabit = {
    id: 'habit_run_daily',
    title: 'Morning Run',
    category: 'Physical Health',
    schedule: {
      type: 'days_of_week',
      activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      restDays: ['Sun'],
    },
    trackingStartDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00Z',
  };

  describe('1. Authoritative Truth Table Scenarios (11-Point Matrix)', () => {
    it('Scenario 1: Completed day extends streak and increments numerators and denominators', () => {
      const log = {
        completedHabitIds: ['habit_run_daily'],
        habitOutcomes: {
          habit_run_daily: { status: 'completed' },
        },
      };

      const result = evaluateHabitDayScenario(baseHabit, '2026-10-06', 'Tue', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 1);
      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.isCompleted, true);
      assert.strictEqual(result.isRestDay, false);
      assert.strictEqual(result.numerator, 1);
      assert.strictEqual(result.verifiedDenom, 1);
      assert.strictEqual(result.adherenceDenom, 1);
      assert.strictEqual(result.streakEffect, 'extends');
    });

    it('Scenario 4 (Override): Deliberate Rest Day Override bridges streaks and is excluded from failure denominators', () => {
      const log = {
        completedHabitIds: [],
        habitOutcomes: {
          habit_run_daily: { status: 'rest', reason: 'Deliberate muscle recovery' },
        },
      };

      // Tuesday is normally scheduled active day, but user chose "Rest Today"
      const result = evaluateHabitDayScenario(baseHabit, '2026-10-06', 'Tue', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 4);
      assert.strictEqual(result.status, 'rest');
      assert.strictEqual(result.label, 'Rest Day (Override)');
      assert.strictEqual(result.isCompleted, false);
      assert.strictEqual(result.isRestDay, true);
      assert.strictEqual(result.numerator, 0);
      assert.strictEqual(result.verifiedDenom, 0, 'Must be excluded from verified denominator');
      assert.strictEqual(result.adherenceDenom, 0, 'Must be excluded from adherence denominator');
      assert.strictEqual(result.streakEffect, 'bridges', 'Must bridge streak continuity');
    });

    it('Scenario 4 (Planned): Recurring Planned Rest Day (e.g. Sunday) bridges streaks and is excluded from denominators', () => {
      const log = {
        completedHabitIds: [],
        habitOutcomes: {},
      };

      const result = evaluateHabitDayScenario(baseHabit, '2026-10-04', 'Sun', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 4);
      assert.strictEqual(result.status, 'rest');
      assert.strictEqual(result.label, 'Planned Rest');
      assert.strictEqual(result.isRestDay, true);
      assert.strictEqual(result.verifiedDenom, 0);
      assert.strictEqual(result.adherenceDenom, 0);
      assert.strictEqual(result.streakEffect, 'bridges');
    });

    it('Scenario 2 (Skip): Explicit Skip Today breaks streak and is counted in verified & adherence denominators', () => {
      const log = {
        completedHabitIds: [],
        habitOutcomes: {
          habit_run_daily: { status: 'skipped', reason: 'Travel day' },
        },
      };

      const result = evaluateHabitDayScenario(baseHabit, '2026-10-06', 'Tue', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 2);
      assert.strictEqual(result.status, 'skipped');
      assert.strictEqual(result.label, 'Skipped Today');
      assert.strictEqual(result.isCompleted, false);
      assert.strictEqual(result.isRestDay, false);
      assert.strictEqual(result.numerator, 0);
      assert.strictEqual(result.verifiedDenom, 1, 'Must count in verified denominator');
      assert.strictEqual(result.adherenceDenom, 1, 'Must count in adherence denominator');
      assert.strictEqual(result.streakEffect, 'breaks');
    });

    it('Scenario 2 (Missed): Explicit Mark as Missed breaks streak and is counted in verified & adherence denominators', () => {
      const log = {
        completedHabitIds: [],
        habitOutcomes: {
          habit_run_daily: { status: 'missed' },
        },
      };

      const result = evaluateHabitDayScenario(baseHabit, '2026-10-06', 'Tue', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 2);
      assert.strictEqual(result.status, 'missed');
      assert.strictEqual(result.label, 'Missed');
      assert.strictEqual(result.isCompleted, false);
      assert.strictEqual(result.isMissed, true);
      assert.strictEqual(result.numerator, 0);
      assert.strictEqual(result.verifiedDenom, 1);
      assert.strictEqual(result.adherenceDenom, 1);
      assert.strictEqual(result.streakEffect, 'breaks');
    });

    it('Scenario 3 (Automatic Missed Derivation): Past closed unrecorded day is automatically classified as missed', () => {
      const log = undefined; // No log entry for past Tuesday

      const result = evaluateHabitDayScenario(baseHabit, '2026-10-06', 'Tue', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 3);
      assert.strictEqual(result.status, 'missed');
      assert.strictEqual(result.label, 'Missed');
      assert.strictEqual(result.isCompleted, false);
      assert.strictEqual(result.isMissed, true);
      assert.strictEqual(result.numerator, 0);
      assert.strictEqual(result.verifiedDenom, 1, 'Automatically derived missed counts in eligible denominator');
      assert.strictEqual(result.adherenceDenom, 1, 'Automatically derived missed counts in adherence denominator');
      assert.strictEqual(result.streakEffect, 'breaks');
    });

    it('Scenario 6 (In Progress / Grace): Today is open, maintains streak, and is excluded from closed denominators', () => {
      const log = undefined;

      const result = evaluateHabitDayScenario(baseHabit, '2026-10-10', 'Sat', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 6);
      assert.strictEqual(result.status, 'in_progress');
      assert.strictEqual(result.isPending, true);
      assert.strictEqual(result.verifiedDenom, 0);
      assert.strictEqual(result.adherenceDenom, 0);
      assert.strictEqual(result.streakEffect, 'maintains');
    });

    it('Scenario 9 (Future): Future dates beyond observance are neutral', () => {
      const log = undefined;

      const result = evaluateHabitDayScenario(baseHabit, '2026-10-12', 'Mon', log, {
        currentObservanceDate: '2026-10-10',
      });

      assert.strictEqual(result.scenario, 9);
      assert.strictEqual(result.status, 'future');
      assert.strictEqual(result.isPending, true);
      assert.strictEqual(result.verifiedDenom, 0);
      assert.strictEqual(result.adherenceDenom, 0);
      assert.strictEqual(result.streakEffect, 'neutral');
    });
  });

  describe('2. Streak Continuity & Rest Day Bridging Proof', () => {
    it('should bridge streak across deliberate rest day overrides without penalty', () => {
      // 5-day timeline:
      // Oct 05 (Mon): Completed
      // Oct 06 (Tue): Completed
      // Oct 07 (Wed): Deliberate Rest Day Override ('rest')
      // Oct 08 (Thu): Completed
      // Oct 09 (Fri): Completed
      const dailyLogs = {
        '2026-10-05': { completedHabitIds: ['habit_run_daily'], habitOutcomes: { habit_run_daily: { status: 'completed' } } },
        '2026-10-06': { completedHabitIds: ['habit_run_daily'], habitOutcomes: { habit_run_daily: { status: 'completed' } } },
        '2026-10-07': { completedHabitIds: [], habitOutcomes: { habit_run_daily: { status: 'rest' } } },
        '2026-10-08': { completedHabitIds: ['habit_run_daily'], habitOutcomes: { habit_run_daily: { status: 'completed' } } },
        '2026-10-09': { completedHabitIds: ['habit_run_daily'], habitOutcomes: { habit_run_daily: { status: 'completed' } } },
      };

      const metrics = calculateHabitConsistency(baseHabit, dailyLogs, {
        startDate: '2026-10-05',
        endDate: '2026-10-09',
        now: new Date('2026-10-09T20:00:00Z'),
        timezone: 'UTC',
      });

      // Deliberate rest day on Wednesday must bridge the streak!
      // Total active streak = 4 completed days (2 before + 2 after) bridged seamlessly
      assert.strictEqual(metrics.streaks.currentStreak, 4);
      assert.strictEqual(metrics.streaks.longestStreak, 4);

      // Verified consistency: 4 completed / 4 recorded scheduled days = 100%
      assert.strictEqual(metrics.rates.verifiedConsistencyRate, 100);

      // Rest count = 1
      assert.strictEqual(metrics.counts.restDaysCount, 1);
    });

    it('should break streak on explicit Skip Today and reset current streak', () => {
      // Oct 05: Completed
      // Oct 06: Skipped ('skipped')
      // Oct 07: Completed
      const dailyLogs = {
        '2026-10-05': { completedHabitIds: ['habit_run_daily'], habitOutcomes: { habit_run_daily: { status: 'completed' } } },
        '2026-10-06': { completedHabitIds: [], habitOutcomes: { habit_run_daily: { status: 'skipped' } } },
        '2026-10-07': { completedHabitIds: ['habit_run_daily'], habitOutcomes: { habit_run_daily: { status: 'completed' } } },
      };

      const metrics = calculateHabitConsistency(baseHabit, dailyLogs, {
        startDate: '2026-10-05',
        endDate: '2026-10-07',
        now: new Date('2026-10-07T20:00:00Z'),
        timezone: 'UTC',
      });

      // Skip broke streak: current streak is only Oct 07 (1 day)
      assert.strictEqual(metrics.streaks.currentStreak, 1);
      // Longest streak was 1 day
      assert.strictEqual(metrics.streaks.longestStreak, 1);

      // Verified rate: 2 completed / 3 recorded = 67%
      assert.strictEqual(metrics.rates.verifiedConsistencyRate, 67);
    });
  });

  describe('3. Component Architecture & UI Invariants', () => {
    it('DashboardHabitCard simplifies completion contract: primary circular checkbox is the single toggle, removing manual Rest/Skip/Missed action menus', () => {
      const cardSource = readWebFile('src/components/habits/DashboardHabitCard.js');

      // Elimination of manual outcome action menu
      assert.ok(!cardSource.includes("handleSetOutcome('rest'"), 'Must NOT have Rest Today action handler');
      assert.ok(!cardSource.includes("handleSetOutcome('skipped'"), 'Must NOT have Skip Today action handler');
      assert.ok(!cardSource.includes("handleSetOutcome('missed'"), 'Must NOT have Mark as Missed action handler');
      assert.ok(!cardSource.includes("handleSetOutcome(null"), 'Must NOT have Reset / Clear Status action handler');
      assert.ok(!cardSource.includes('MoreVertical'), 'Must NOT have action menu icon');

      // Primary circular toggle button is the sole toggle
      assert.ok(cardSource.includes('handlePrimaryToggle'), 'Must use primary circular checkbox as sole toggle');
      assert.ok(cardSource.includes('min-w-[44px] min-h-[44px]'), 'Primary checkbox must enforce WCAG min 44x44px touch target');

      // Planned rest recognition from schedule
      assert.ok(cardSource.includes('isPlannedRest'), 'Must evaluate planned rest from schedule');
      assert.ok(cardSource.includes('Planned Rest'), 'Must display Planned Rest when scheduled');
    });

    it('Firestore module must cleanly persist rest outcome and clear habitOutcomes on completion reversal', () => {
      const firestoreSource = readWebFile('src/lib/firebase/firestore.js');

      // Rest outcome in setDailyHabitOutcome
      assert.ok(firestoreSource.includes("status: 'rest'"), 'Must support status: rest in setDailyHabitOutcome');

      // Deletion of outcome on null
      assert.ok(firestoreSource.includes('deleteField()'), 'Must use deleteField to clear outcomes');

      // Completion reversal fix in updateDailyHabitProgress
      assert.ok(
        firestoreSource.includes('updatePayload[`habitOutcomes.${habitId}`] = deleteField()'),
        'Must remove habitOutcome entry when completion is reversed (isFullyCompleted === false)'
      );

      // Historical log mapping
      assert.ok(
        firestoreSource.includes('habitOutcomes: data.habitOutcomes || {}'),
        'fetchHistoricalLogs must include habitOutcomes'
      );
    });

    it('Analytics Page must implement month-based calendar-first experience without timeframe selectors', () => {
      const pageSource = readWebFile('src/app/(protected)/analytics/page.js');

      // Month navigation controls
      assert.ok(pageSource.includes('handlePrevMonth'), 'Must provide previous month navigation');
      assert.ok(pageSource.includes('handleNextMonth'), 'Must provide next month navigation');
      assert.ok(pageSource.includes('handleTodayShortcut'), 'Must provide Today shortcut');

      // Summary counts
      assert.ok(pageSource.includes('totalCompletedOccurrences'), 'Must calculate total completed occurrences');
      assert.ok(pageSource.includes('totalMissedOccurrences'), 'Must calculate total missed occurrences');
      assert.ok(pageSource.includes('totalRestOccurrences'), 'Must calculate total rest occurrences');

      // Touch targets
      assert.ok(pageSource.includes('min-h-[44px]'), 'Must enforce WCAG touch targets');
    });
  });
});
