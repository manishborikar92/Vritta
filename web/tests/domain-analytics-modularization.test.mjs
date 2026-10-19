import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SUPPORTED_TIMEFRAMES,
  DAY_TO_COLUMN,
  formatDateInTimezone,
  getContiguousDateRange,
  getTimeframeDateRange,
  isHabitCompletedInLog,
  evaluateHabitDayScenario,
  calculateHabitConsistency,
  calculateLifetimeAnalytics,
  calculateMonthlyAnalytics,
} from '../src/domain/analytics/index.js';

import * as domainIndex from '../src/domain/index.js';
import * as consistencyEngine from '../src/lib/analytics/consistency-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

describe('Domain Analytics Subsystem Modularization & Calculation Invariants', () => {
  describe('1. Architectural Export Parity & Facade Integrity', () => {
    it('should export all 10 analytics functions & constants from domain/analytics/index.js', () => {
      assert.ok(Array.isArray(SUPPORTED_TIMEFRAMES), 'SUPPORTED_TIMEFRAMES must be array');
      assert.deepEqual(SUPPORTED_TIMEFRAMES, ['7D', '30D', '90D', 'YTD', 'Lifetime', 'Custom']);
      assert.equal(DAY_TO_COLUMN.Mon, 0);
      assert.equal(DAY_TO_COLUMN.Sun, 6);
      assert.equal(typeof formatDateInTimezone, 'function');
      assert.equal(typeof getContiguousDateRange, 'function');
      assert.equal(typeof getTimeframeDateRange, 'function');
      assert.equal(typeof isHabitCompletedInLog, 'function');
      assert.equal(typeof evaluateHabitDayScenario, 'function');
      assert.equal(typeof calculateHabitConsistency, 'function');
      assert.equal(typeof calculateLifetimeAnalytics, 'function');
      assert.equal(typeof calculateMonthlyAnalytics, 'function');
    });

    it('should expose analytics module through central domain/index.js', () => {
      assert.equal(domainIndex.evaluateHabitDayScenario, evaluateHabitDayScenario);
      assert.equal(domainIndex.calculateLifetimeAnalytics, calculateLifetimeAnalytics);
      assert.equal(domainIndex.calculateMonthlyAnalytics, calculateMonthlyAnalytics);
      assert.equal(domainIndex.getTimeframeDateRange, getTimeframeDateRange);
    });

    it('should ensure consistency-engine.js facade has 100% identical references', () => {
      assert.equal(consistencyEngine.evaluateHabitDayScenario, evaluateHabitDayScenario);
      assert.equal(consistencyEngine.calculateLifetimeAnalytics, calculateLifetimeAnalytics);
      assert.equal(consistencyEngine.calculateMonthlyAnalytics, calculateMonthlyAnalytics);
      assert.equal(consistencyEngine.calculateHabitConsistency, calculateHabitConsistency);
      assert.equal(consistencyEngine.getTimeframeDateRange, getTimeframeDateRange);
      assert.equal(consistencyEngine.SUPPORTED_TIMEFRAMES, SUPPORTED_TIMEFRAMES);
    });

    it('should verify physical files exist in web/src/domain/analytics/', () => {
      const files = [
        'src/domain/analytics/timeframe.js',
        'src/domain/analytics/truth-table.js',
        'src/domain/analytics/consistency.js',
        'src/domain/analytics/calendar-grid.js',
        'src/domain/analytics/index.js',
      ];
      for (const rel of files) {
        assert.ok(fs.existsSync(path.join(webRoot, rel)), `File must exist: ${rel}`);
      }
    });
  });

  describe('2. Truth Table 8-Scenario Calculation Fidelity', () => {
    const testHabit = {
      id: 'h_deep_work',
      title: 'Deep Work Block',
      category: 'Work & Career',
      schedule: {
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        restDays: ['Sat', 'Sun'],
      },
      lifecycle: {
        trackingHorizon: {
          startDate: '2026-10-01',
          status: 'verified_creation',
        },
      },
    };

    const options = {
      currentObservanceDate: '2026-10-15',
      timezone: 'UTC',
    };

    it('Scenario 1: Scheduled day with recorded completion', () => {
      const result = evaluateHabitDayScenario(
        testHabit,
        '2026-10-05', // Mon
        'Mon',
        { completedHabitIds: ['h_deep_work'] },
        options
      );
      assert.equal(result.scenario, 1);
      assert.equal(result.status, 'completed');
      assert.equal(result.numerator, 1);
      assert.equal(result.verifiedDenom, 1);
      assert.equal(result.adherenceDenom, 1);
      assert.equal(result.streakEffect, 'extends');
    });

    it('Scenario 2: Scheduled day with explicit skipped outcome', () => {
      const result = evaluateHabitDayScenario(
        testHabit,
        '2026-10-06', // Tue
        'Tue',
        { habitOutcomes: { h_deep_work: { status: 'skipped' } } },
        options
      );
      assert.equal(result.scenario, 2);
      assert.equal(result.status, 'skipped');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 1);
      assert.equal(result.adherenceDenom, 1);
      assert.equal(result.streakEffect, 'breaks');
    });

    it('Scenario 3: Past scheduled day without record (derived missed)', () => {
      const result = evaluateHabitDayScenario(
        testHabit,
        '2026-10-07', // Wed (past closed date relative to 2026-10-15)
        'Wed',
        {},
        options
      );
      assert.equal(result.scenario, 3);
      assert.equal(result.status, 'missed');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 1);
      assert.equal(result.adherenceDenom, 1);
      assert.equal(result.streakEffect, 'breaks');
    });

    it('Scenario 4: Planned rest day bridges streaks and is excluded from denoms', () => {
      const result = evaluateHabitDayScenario(
        testHabit,
        '2026-10-11', // Sun
        'Sun',
        {},
        options
      );
      assert.equal(result.scenario, 4);
      assert.equal(result.status, 'rest');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'bridges');
    });

    it('Scenario 5: Unscheduled day is neutral and excluded from denoms', () => {
      const weekendOnlyHabit = {
        ...testHabit,
        schedule: { frequency: ['Sat', 'Sun'], restDays: [] },
      };
      const result = evaluateHabitDayScenario(
        weekendOnlyHabit,
        '2026-10-07', // Wed
        'Wed',
        {},
        options
      );
      assert.equal(result.scenario, 5);
      assert.equal(result.status, 'unscheduled');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'neutral');
    });

    it('Scenario 6: Ongoing current observance date maintains streak (grace period)', () => {
      const result = evaluateHabitDayScenario(
        testHabit,
        '2026-10-15', // Current observance date
        'Thu',
        {},
        options
      );
      assert.equal(result.scenario, 6);
      assert.equal(result.status, 'in_progress');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'maintains');
    });

    it('Scenario 7: Date prior to tracking horizon is neutral and zeroed', () => {
      const result = evaluateHabitDayScenario(
        testHabit,
        '2026-09-20', // Prior to tracking horizon '2026-10-01'
        'Sun',
        {},
        options
      );
      assert.equal(result.scenario, 7);
      assert.equal(result.status, 'prior_to_tracking');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'neutral');
    });

    it('Scenario 8: Dates following archive timestamp are neutral', () => {
      const archivedHabit = {
        ...testHabit,
        archivedAt: '2026-10-10T12:00:00Z',
      };
      const result = evaluateHabitDayScenario(
        archivedHabit,
        '2026-10-12', // After archive
        'Mon',
        {},
        options
      );
      assert.equal(result.scenario, 8);
      assert.equal(result.status, 'archived');
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'neutral');
    });

    it('Scenario 9: Future dates beyond observance are upcoming and pending', () => {
      const result = evaluateHabitDayScenario(
        testHabit,
        '2026-10-20', // Future date
        'Tue',
        {},
        options
      );
      assert.equal(result.scenario, 9);
      assert.equal(result.status, 'future');
      assert.equal(result.isPending, true);
      assert.equal(result.numerator, 0);
      assert.equal(result.verifiedDenom, 0);
      assert.equal(result.adherenceDenom, 0);
      assert.equal(result.streakEffect, 'neutral');
    });
  });

  describe('3. Timeframe & Monthly Aggregation Precision', () => {
    it('should derive contiguous date range accurately', () => {
      const range = getContiguousDateRange('2026-10-01', '2026-10-05');
      assert.deepEqual(range, [
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
      ]);
    });

    it('should derive 7D, 30D, and YTD timeframe ranges', () => {
      const now = new Date('2026-10-19T10:00:00Z');
      const r7D = getTimeframeDateRange('7D', { now, timezone: 'UTC' });
      assert.equal(r7D.timeframe, '7D');
      assert.equal(r7D.endDate, '2026-10-19');
      assert.equal(r7D.startDate, '2026-10-13');

      const r30D = getTimeframeDateRange('30D', { now, timezone: 'UTC' });
      assert.equal(r30D.timeframe, '30D');
      assert.equal(r30D.endDate, '2026-10-19');
      assert.equal(r30D.startDate, '2026-09-20');

      const rYTD = getTimeframeDateRange('YTD', { now, timezone: 'UTC' });
      assert.equal(rYTD.timeframe, 'YTD');
      assert.equal(rYTD.startDate, '2026-01-01');
      assert.equal(rYTD.endDate, '2026-10-19');
    });

    it('should compute calculateMonthlyAnalytics accurately', () => {
      const habits = [{
        id: 'h1',
        title: 'Meditation',
        category: 'Mindfulness & Spirit',
        schedule: { frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], restDays: ['Sun'] },
        lifecycle: { trackingHorizon: { startDate: '2026-10-01', status: 'verified_creation' } },
      }];
      const dailyLogs = {
        '2026-10-01': { completedHabitIds: ['h1'] },
        '2026-10-02': { completedHabitIds: ['h1'] },
      };

      const result = calculateMonthlyAnalytics(habits, dailyLogs, {
        year: 2026,
        month: 10,
        now: new Date('2026-10-05T12:00:00Z'),
        timezone: 'UTC',
      });

      assert.equal(result.year, 2026);
      assert.equal(result.month, 10);
      assert.equal(result.firstDayColumn, 3); // 2026-10-01 was Thursday (col 3)
      assert.equal(result.calendarDays.length, 31);
      assert.equal(result.summary.totalCompletedOccurrences, 2);
    });
  });
});
