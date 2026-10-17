import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateHabitDayScenario,
  calculateHabitConsistency,
  calculateLifetimeAnalytics,
  getTimeframeDateRange,
  getContiguousDateRange,
  SUPPORTED_TIMEFRAMES,
} from '../src/lib/analytics/consistency-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

describe('Phase 4: Lifetime Analytics Engine & Truth Table', () => {
  const baseHabit = {
    id: 'habit_test_meditation',
    title: 'Daily Meditation',
    category: 'Mindfulness & Spirit',
    frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    schedule: {
      frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      restDays: ['Sun'],
    },
    lifecycle: {
      trackingHorizon: {
        startDate: '2026-04-01',
        status: 'verified_creation',
      },
    },
  };

  describe('1. 8-Scenario Analytics Truth Table Evaluation', () => {
    it('Scenario 1: Scheduled day with recorded completion extends streak and counts in both denoms', () => {
      const dailyLog = {
        date: '2026-04-06', // Monday
        completedHabitIds: ['habit_test_meditation'],
        habitOutcomes: {
          habit_test_meditation: { status: 'completed' },
        },
      };

      const result = evaluateHabitDayScenario(baseHabit, '2026-04-06', 'Mon', dailyLog, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 1);
      assert.equal(result.status, 'completed');
      assert.equal(result.numerator, 1);
      assert.equal(result.verifiedDenom, 1);
      assert.equal(result.adherenceDenom, 1);
      assert.equal(result.streakEffect, 'extends');
    });

    it('Scenario 2: Scheduled day with explicit skip/miss breaks streak and counts in verified denom as 0', () => {
      const skipLog = {
        date: '2026-04-07', // Tuesday
        habitOutcomes: {
          habit_test_meditation: { status: 'skipped', reason: 'Resting voice' },
        },
      };

      const result = evaluateHabitDayScenario(baseHabit, '2026-04-07', 'Tue', skipLog, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 2);
      assert.equal(result.status, 'skipped');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 1);
      assert.equal(result.adherenceDenom, 1);
      assert.equal(result.streakEffect, 'breaks');
    });

    it('Scenario 3: Past unrecorded scheduled day is automatically classified as missed', () => {
      // Past day with no log entry -> automatically derived as missed
      const result = evaluateHabitDayScenario(baseHabit, '2026-04-08', 'Wed', null, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 3);
      assert.equal(result.status, 'missed');
      assert.equal(result.isMissed, true);
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 1, 'Automatically derived missed days count in eligible denominator');
      assert.equal(result.adherenceDenom, 1, 'Automatically derived missed days count against overall adherence');
      assert.equal(result.streakEffect, 'breaks');
    });

    it('Scenario 4: Planned rest day bridges streak and is excluded from all failure denominators', () => {
      const result = evaluateHabitDayScenario(baseHabit, '2026-04-05', 'Sun', null, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 4);
      assert.equal(result.status, 'rest');
      assert.equal(result.isRestDay, true);
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'bridges', 'Rest days must non-punitively bridge streak');
    });

    it('Scenario 5: Unscheduled day is neutral and excluded from denoms', () => {
      const weekdayOnlyHabit = {
        ...baseHabit,
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        schedule: { frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      };

      const result = evaluateHabitDayScenario(weekdayOnlyHabit, '2026-04-04', 'Sat', null, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 5);
      assert.equal(result.status, 'unscheduled');
      assert.equal(result.streakEffect, 'neutral');
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
    });

    it('Scenario 6: Ongoing current day / grace window is pending and maintains streak without break', () => {
      const result = evaluateHabitDayScenario(baseHabit, '2026-04-10', 'Fri', null, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 6);
      assert.equal(result.status, 'in_progress');
      assert.equal(result.isPending, true);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'maintains', 'Active day observance window must maintain streak');
    });

    it('Scenario 7: Date prior to habit tracking horizon is neutral and never penalized as 0%', () => {
      const result = evaluateHabitDayScenario(baseHabit, '2026-03-25', 'Wed', null, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 7);
      assert.equal(result.status, 'prior_to_tracking');
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'neutral');
    });

    it('Scenario 8: Date following habit archive/deletion is neutral and ceased', () => {
      const archivedHabit = {
        ...baseHabit,
        archivedAt: '2026-04-08T12:00:00.000Z',
      };

      const result = evaluateHabitDayScenario(archivedHabit, '2026-04-09', 'Thu', null, {
        currentObservanceDate: '2026-04-10',
        timezone: 'UTC',
      });

      assert.equal(result.scenario, 8);
      assert.equal(result.status, 'archived');
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'neutral');
    });
  });

  describe('2. Dual Consistency Metrics & Mathematical Guarantees', () => {
    it('should calculate Verified Consistency as Completed / Eligible Scheduled Days with automatic missed derivation', () => {
      // 3 scheduled days: 2 completed, 1 past unrecorded (derived as missed)
      const dailyLogs = {
        '2026-04-01': { completedHabitIds: [baseHabit.id] }, // Wed - Completed
        '2026-04-02': { completedHabitIds: [baseHabit.id] }, // Thu - Completed
        // 2026-04-03: Fri - Past Unrecorded (derived as missed)
      };

      const metrics = calculateHabitConsistency(baseHabit, dailyLogs, {
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        now: new Date('2026-04-04T12:00:00Z'),
        timezone: 'UTC',
      });

      // 3 eligible days: 2 completed, 1 automatically derived missed => 67% consistency
      assert.equal(metrics.rates.verifiedConsistencyRate, 67);
      assert.equal(metrics.rates.effectiveAdherenceRate, 67);
    });

    it('should return null (not 0% or NaN) when there are zero scheduled eligible activities', () => {
      // Future date range has zero closed past occurrences
      const metrics = calculateHabitConsistency(baseHabit, {}, {
        startDate: '2026-04-05',
        endDate: '2026-04-07',
        now: new Date('2026-04-04T12:00:00Z'),
        timezone: 'UTC',
      });

      assert.equal(metrics.rates.verifiedConsistencyRate, null, 'Verified consistency must be null when eligible days is 0');
    });

    it('should correctly account for explicit skips in verified denominator', () => {
      // 2 recorded days: 1 completed, 1 explicitly skipped
      const dailyLogs = {
        '2026-04-01': { completedHabitIds: [baseHabit.id] },
        '2026-04-02': { habitOutcomes: { [baseHabit.id]: { status: 'skipped' } } },
      };

      const metrics = calculateHabitConsistency(baseHabit, dailyLogs, {
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        now: new Date('2026-04-03T12:00:00Z'),
        timezone: 'UTC',
      });

      // 1 completed / 2 recorded = 50%
      assert.equal(metrics.rates.verifiedConsistencyRate, 50);
      assert.equal(metrics.rates.historicalCoverageRatio, 100);
      assert.equal(metrics.rates.effectiveAdherenceRate, 50);
    });
  });

  describe('3. Rest-Day Streak Bridging', () => {
    it('should bridge streaks across planned rest days (Sunday)', () => {
      // Friday completed, Saturday completed, Sunday rest, Monday completed
      const dailyLogs = {
        '2026-04-03': { completedHabitIds: [baseHabit.id] }, // Fri
        '2026-04-04': { completedHabitIds: [baseHabit.id] }, // Sat
        // 2026-04-05: Sun (Planned Rest Day)
        '2026-04-06': { completedHabitIds: [baseHabit.id] }, // Mon
      };

      const metrics = calculateHabitConsistency(baseHabit, dailyLogs, {
        startDate: '2026-04-03',
        endDate: '2026-04-06',
        now: new Date('2026-04-07T12:00:00Z'),
        timezone: 'UTC',
      });

      // 3 completed days + 1 bridged rest day = active streak of 3
      assert.equal(metrics.streaks.currentStreak, 3);
      assert.equal(metrics.streaks.longestStreak, 3);
    });

    it('should break streaks on unrecorded past scheduled days', () => {
      const dailyLogs = {
        '2026-04-01': { completedHabitIds: [baseHabit.id] }, // Wed
        // 2026-04-02: Thu (Unrecorded past closed day)
        '2026-04-03': { completedHabitIds: [baseHabit.id] }, // Fri
      };

      const metrics = calculateHabitConsistency(baseHabit, dailyLogs, {
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        now: new Date('2026-04-04T12:00:00Z'),
        timezone: 'UTC',
      });

      // Break on Thu means current streak is only 1 (Friday)
      assert.equal(metrics.streaks.currentStreak, 1);
      assert.equal(metrics.streaks.longestStreak, 1);
    });
  });

  describe('4. Timeframe Date Range Generation', () => {
    const fixedNow = new Date('2026-04-15T10:00:00Z');

    it('should generate exact 7-day range for 7D', () => {
      const range = getTimeframeDateRange('7D', { now: fixedNow, timezone: 'UTC' });
      assert.equal(range.timeframe, '7D');
      assert.equal(range.startDate, '2026-04-09');
      assert.equal(range.endDate, '2026-04-15');
      const dates = getContiguousDateRange(range.startDate, range.endDate);
      assert.equal(dates.length, 7);
    });

    it('should generate exact 30-day range for 30D', () => {
      const range = getTimeframeDateRange('30D', { now: fixedNow, timezone: 'UTC' });
      assert.equal(range.timeframe, '30D');
      assert.equal(range.startDate, '2026-03-17');
      assert.equal(range.endDate, '2026-04-15');
      const dates = getContiguousDateRange(range.startDate, range.endDate);
      assert.equal(dates.length, 30);
    });

    it('should generate exact 90-day range for 90D', () => {
      const range = getTimeframeDateRange('90D', { now: fixedNow, timezone: 'UTC' });
      assert.equal(range.timeframe, '90D');
      const dates = getContiguousDateRange(range.startDate, range.endDate);
      assert.equal(dates.length, 90);
    });

    it('should start on Jan 1 of current year for YTD', () => {
      const range = getTimeframeDateRange('YTD', { now: fixedNow, timezone: 'UTC' });
      assert.equal(range.timeframe, 'YTD');
      assert.equal(range.startDate, '2026-01-01');
      assert.equal(range.endDate, '2026-04-15');
    });

    it('should bound Lifetime timeframe to habit tracking horizon', () => {
      const range = getTimeframeDateRange('Lifetime', {
        habits: [baseHabit],
        now: fixedNow,
        timezone: 'UTC',
      });
      assert.equal(range.timeframe, 'Lifetime');
      assert.equal(range.startDate, '2026-04-01');
      assert.equal(range.endDate, '2026-04-15');
    });

    it('should respect custom date ranges for Custom', () => {
      const range = getTimeframeDateRange('Custom', {
        customStartDate: '2026-02-01',
        customEndDate: '2026-02-28',
        now: fixedNow,
        timezone: 'UTC',
      });
      assert.equal(range.timeframe, 'Custom');
      assert.equal(range.startDate, '2026-02-01');
      assert.equal(range.endDate, '2026-02-28');
    });
  });

  describe('5. Multi-Habit Aggregate Analytics', () => {
    it('should aggregate metrics across multiple habits and categories', () => {
      const habitA = {
        id: 'habit_a',
        title: 'Morning Yoga',
        category: 'Health & Fitness',
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        lifecycle: { trackingHorizon: { startDate: '2026-04-01' } },
      };
      const habitB = {
        id: 'habit_b',
        title: 'Reading Philosophy',
        category: 'Learning & Growth',
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        lifecycle: { trackingHorizon: { startDate: '2026-04-01' } },
      };

      const dailyLogs = {
        '2026-04-01': { completedHabitIds: ['habit_a', 'habit_b'] },
        '2026-04-02': { completedHabitIds: ['habit_a'] },
      };

      const summary = calculateLifetimeAnalytics([habitA, habitB], dailyLogs, {
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        timeframe: 'Custom',
        customStartDate: '2026-04-01',
        customEndDate: '2026-04-02',
        now: new Date('2026-04-03T12:00:00Z'),
        timezone: 'UTC',
      });

      assert.equal(summary.aggregate.completedActivities, 3);
      assert.equal(summary.aggregate.recordedActivities, 4); // 3 completed + 1 automatically derived missed
      assert.equal(summary.aggregate.verifiedConsistencyRate, 75);
      assert.equal(summary.categories.length, 2);
    });
  });

  describe('6. Analytics Page Static & Accessibility Invariants', () => {
    const pagePath = path.join(webRoot, 'src', 'app', '(protected)', 'analytics', 'page.js');

    it('should verify analytics page exists and has valid source', () => {
      assert.ok(fs.existsSync(pagePath), 'analytics/page.js must exist');
      const content = fs.readFileSync(pagePath, 'utf8');
      assert.ok(content.includes('export default function AnalyticsPage'), 'Must export AnalyticsPage');
    });

    it('should enforce WCAG AAA min 44x44px touch targets on calendar day buttons', () => {
      const content = fs.readFileSync(pagePath, 'utf8');
      assert.ok(
        content.includes('min-h-[44px]') && (content.includes('min-w-[44px]') || content.includes('w-full')),
        'Calendar day buttons must specify min-h-[44px] and responsive width for WCAG touch compliance'
      );
    });

    it('should verify month-based navigation controls (Previous, Next, and Today)', () => {
      const content = fs.readFileSync(pagePath, 'utf8');
      assert.ok(content.includes('handlePrevMonth'), 'Must provide handlePrevMonth navigation');
      assert.ok(content.includes('handleNextMonth'), 'Must provide handleNextMonth navigation');
      assert.ok(content.includes('handleTodayShortcut'), 'Must provide handleTodayShortcut shortcut');
      assert.ok(content.includes('calculateMonthlyAnalytics'), 'Must use calculateMonthlyAnalytics');
    });

    it('should render monthly overview summary with completion rate and useful counts', () => {
      const content = fs.readFileSync(pagePath, 'utf8');
      assert.ok(content.includes('Overview'), 'Must display Overview header');
      assert.ok(content.includes('totalCompletedOccurrences'), 'Must display completed occurrences count');
      assert.ok(content.includes('totalMissedOccurrences'), 'Must display missed occurrences count');
      assert.ok(content.includes('totalRestOccurrences'), 'Must display planned rest occurrences count');
      assert.ok(content.includes('currentStreak'), 'Must display current streak');
    });

    it('should include selected-day drawer for inspecting scheduled routine statuses and notes', () => {
      const content = fs.readFileSync(pagePath, 'utf8');
      assert.ok(
        content.includes('selectedDayData'),
        'Must support inspecting selected day details'
      );
      assert.ok(
        content.includes('setSelectedDate(null)'),
        'Must support closing day details drawer'
      );
    });
  });
});
