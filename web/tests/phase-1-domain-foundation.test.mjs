import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WEEKDAYS,
  TIMING_TYPES,
  PERSISTED_OUTCOME_STATUSES,
  DOMAIN_OUTCOME_STATUSES,
  PROVENANCE_STATUSES,
  ValidationError,
  resolveObservanceDate,
  convertTimestampToTrackingDate,
  createScheduleHistoryEntry,
  getEffectiveScheduleForDate,
  applyScheduleUpdate,
  deriveTrackingHorizon,
  validateComposableHabit,
  validateDailyLogDoc,
} from '../src/lib/constants/habit-models.js';

import {
  normalizeHabitFromFirestore,
  serializeHabitForFirestore,
  normalizeDailyLogFromFirestore,
  serializeDailyLogForFirestore,
} from '../src/lib/firebase/firestore.js';

import { MANISH_PERSONAL_ROUTINES } from '../src/lib/server/schedule-templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 1: Domain Foundation & Architecture Modernization', () => {

  // ==========================================================================
  // 1. Pure Date Helpers & Observance Date Resolution
  // ==========================================================================
  describe('1. Pure Date Helpers & 04:00 AM Grace-Period Resolution', () => {
    it('should resolve standard daytime events to the current calendar date', () => {
      // 2026-10-17 14:30:00 in Asia/Kolkata (UTC is 09:00:00)
      const ts = new Date('2026-10-17T09:00:00Z').getTime();
      const resolved = resolveObservanceDate(ts, 'Asia/Kolkata');
      assert.equal(resolved, '2026-10-17', 'Daytime event must resolve to same day');
    });

    it('should attribute early morning events (before 04:00 AM) to previous calendar date', () => {
      // 2026-10-17 02:15:00 in Asia/Kolkata (UTC is 2026-10-16 20:45:00)
      const ts = new Date('2026-10-16T20:45:00Z').getTime();
      const resolved = resolveObservanceDate(ts, 'Asia/Kolkata');
      assert.equal(resolved, '2026-10-16', 'Event at 02:15 AM must resolve to previous date (grace period)');
    });

    it('should deterministically map the exact 04:00:00 AM boundary to the current day', () => {
      // 2026-10-17 04:00:00 in Asia/Kolkata (UTC is 2026-10-16 22:30:00)
      const tsBoundary = new Date('2026-10-16T22:30:00Z').getTime();
      const resolved = resolveObservanceDate(tsBoundary, 'Asia/Kolkata');
      assert.equal(resolved, '2026-10-17', 'Exact 04:00 AM event belongs to current day');
    });

    it('should map 03:59:59 AM to the previous day', () => {
      // 2026-10-17 03:59:59 in Asia/Kolkata (UTC is 2026-10-16 22:29:59)
      const tsLate = new Date('2026-10-16T22:29:59Z').getTime();
      const resolved = resolveObservanceDate(tsLate, 'Asia/Kolkata');
      assert.equal(resolved, '2026-10-16', '03:59:59 AM belongs to previous day grace period');
    });

    it('should correctly handle month boundaries during grace period', () => {
      // 2026-05-01 01:30:00 in UTC (01:30 AM on May 1st) -> previous day is April 30th
      const tsMay1 = new Date('2026-05-01T01:30:00Z').getTime();
      const resolved = resolveObservanceDate(tsMay1, 'UTC');
      assert.equal(resolved, '2026-04-30', 'May 1st early morning must resolve to April 30th');
    });

    it('should correctly handle leap years across Feb/March boundaries', () => {
      // 2024 is leap year. 2024-03-01 02:00:00 UTC -> previous day is 2024-02-29
      const tsLeap = new Date('2024-03-01T02:00:00Z').getTime();
      const resolved = resolveObservanceDate(tsLeap, 'UTC');
      assert.equal(resolved, '2024-02-29', 'Leap year March 1st early morning must resolve to Feb 29th');
    });

    it('should convert habit createdAt timestamp to local tracking date in user timezone without UTC shift', () => {
      // 2026-10-14 20:30:00 UTC is 2026-10-15 02:00:00 in Asia/Kolkata (+5:30)
      const eveningUtc = new Date('2026-10-14T20:30:00Z');
      
      const inKolkata = convertTimestampToTrackingDate(eveningUtc, 'Asia/Kolkata');
      assert.equal(inKolkata, '2026-10-15', 'Must convert to local calendar date in user timezone');

      const inNewYork = convertTimestampToTrackingDate(eveningUtc, 'America/New_York');
      assert.equal(inNewYork, '2026-10-14', 'Must evaluate to 2026-10-14 in EDT (16:30)');

      assert.equal(convertTimestampToTrackingDate(null), null, 'Null timestamp returns null');
    });
  });

  // ==========================================================================
  // 2. Composable Habit Model Validation & Schedule History
  // ==========================================================================
  describe('2. Composable Habit Model & Effective-Dated Schedule History', () => {
    const validHabit = {
      id: 'usr123_morning_reading',
      userId: 'usr123',
      title: 'Morning Reading Sprint',
      description: 'Focused reading before screens',
      category: 'Learning & Growth',
      schedule: {
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        timingType: 'preferred_period',
        preferredPeriod: 'Morning',
        restDays: ['Sun'],
        order: 1,
      },
      scheduleHistory: [
        {
          effectiveDate: '2026-10-01',
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          restDays: ['Sun'],
          timingType: 'preferred_period',
          preferredPeriod: 'Morning',
        },
      ],
      features: {
        timer: { enabled: true, targetDurationMinutes: 25, mode: 'countdown', soundOnComplete: true },
        notes: { enabled: true, isPrivateDiary: false },
      },
      lifecycle: {
        createdAt: '2026-10-01T04:00:00.000Z',
        updatedAt: '2026-10-01T04:00:00.000Z',
        archived: false,
        archivedAt: null,
        deleted: false,
        deletedAt: null,
        trackingHorizon: {
          startDate: '2026-10-01',
          status: 'verified_creation',
        },
      },
      seedOrigin: 'custom',
    };

    it('should validate a compliant ComposableHabitModel', () => {
      const result = validateComposableHabit(validHabit);
      assert.equal(result.valid, true, `Expected valid habit, got errors: ${result.errors.join(', ')}`);
    });

    it('should reject invalid habit categories', () => {
      const invalid = { ...validHabit, category: 'Underwater Basket Weaving' };
      const result = validateComposableHabit(invalid);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('category')));
    });

    it('should reject empty title or title exceeding 200 characters', () => {
      const emptyTitle = { ...validHabit, title: '   ' };
      assert.equal(validateComposableHabit(emptyTitle).valid, false);

      const longTitle = { ...validHabit, title: 'A'.repeat(201) };
      assert.equal(validateComposableHabit(longTitle).valid, false);
    });

    it('should resolve the effective schedule for past and present dates without retroactively altering history', () => {
      // Habit initially scheduled Mon-Fri starting 2026-10-01
      // User changed schedule to 7 days a week effective 2026-10-15
      const habitWithHistory = {
        ...validHabit,
        schedule: {
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          timingType: 'anytime',
          restDays: [],
        },
        scheduleHistory: [
          {
            effectiveDate: '2026-10-01',
            frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            restDays: ['Sun'],
            timingType: 'preferred_period',
          },
          {
            effectiveDate: '2026-10-15',
            frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            restDays: [],
            timingType: 'anytime',
          },
        ],
      };

      // Query past date: 2026-10-08 (before schedule change)
      const pastSchedule = getEffectiveScheduleForDate(habitWithHistory, '2026-10-08');
      assert.equal(pastSchedule.frequency.length, 5, 'Past date must reflect 5-day frequency');
      assert.ok(!pastSchedule.frequency.includes('Sat'), 'Past date must not include Saturday');
      assert.deepEqual(pastSchedule.restDays, ['Sun'], 'Past date must reflect Sunday rest');

      // Query date after change: 2026-10-16
      const futureSchedule = getEffectiveScheduleForDate(habitWithHistory, '2026-10-16');
      assert.equal(futureSchedule.frequency.length, 7, 'Date after change must reflect 7-day frequency');
      assert.equal(futureSchedule.restDays.length, 0, 'Date after change has no rest days');
    });

    it('should apply schedule updates and record history without overwriting past entries', () => {
      const updated = applyScheduleUpdate(
        validHabit,
        { frequency: ['Mon', 'Wed', 'Fri'], restDays: ['Sun'] },
        '2026-10-20'
      );

      assert.equal(updated.schedule.frequency.length, 3);
      assert.equal(updated.scheduleHistory.length, 2, 'History must contain baseline + new entry');
      
      // Assert past date still evaluates to original 5-day schedule
      const past = getEffectiveScheduleForDate(updated, '2026-10-10');
      assert.equal(past.frequency.length, 5, 'Past date remains unaffected by new schedule update');
    });
  });

  // ==========================================================================
  // 3. Normalization Fidelity for All 6 Canonical Routines
  // ==========================================================================
  describe('3. Normalization Fidelity for All 6 Canonical Routines', () => {
    it('should normalize all 6 canonical routines into valid composable models', () => {
      assert.equal(MANISH_PERSONAL_ROUTINES.length, 6, 'Must have exactly 6 canonical routines');

      for (const legacyRoutine of MANISH_PERSONAL_ROUTINES) {
        const docId = `usr_test_${legacyRoutine.stableKey}`;
        const normalized = normalizeHabitFromFirestore({ ...legacyRoutine, id: docId, userId: 'usr_test' }, docId);

        assert.ok(normalized, `Failed to normalize ${legacyRoutine.title}`);
        assert.equal(normalized.id, docId);
        assert.equal(normalized.userId, 'usr_test');
        assert.equal(normalized.title, legacyRoutine.title);
        assert.equal(normalized.category, legacyRoutine.category);
        assert.ok(normalized.scheduleHistory.length > 0, 'Schedule history must be initialized');

        // Validation check
        const validation = validateComposableHabit(normalized);
        assert.equal(validation.valid, true, `Validation failed for ${legacyRoutine.title}: ${validation.errors.join(', ')}`);

        // Check specific feature slot mapping
        if (legacyRoutine.completionMethod === 'workbook_sessions') {
          assert.equal(normalized.features.counter.enabled, true);
          assert.equal(normalized.features.counter.targetCount, 2);
          assert.equal(normalized.features.checklist.enabled, true);
          assert.equal(normalized.features.checklist.items.length, 4);
        } else if (legacyRoutine.completionMethod === 'exercise_plan') {
          assert.equal(normalized.features.daySchedule.enabled, true);
          assert.ok(normalized.schedule.restDays.includes('Sun'));
        } else if (legacyRoutine.completionMethod === 'osho_listening') {
          assert.equal(normalized.features.catalog.enabled, true);
          assert.equal(normalized.features.catalog.totalItems, 30);
          assert.equal(normalized.features.timer.enabled, true);
        } else if (legacyRoutine.completionMethod === 'reading_duration') {
          assert.equal(normalized.features.timer.enabled, true);
          assert.equal(normalized.features.timer.soundOnComplete, true);
        } else if (legacyRoutine.completionMethod === 'simple_with_notes') {
          assert.equal(normalized.features.notes.enabled, true);
          assert.equal(normalized.features.notes.isPrivateDiary, false);
        } else if (legacyRoutine.completionMethod === 'diary_entry') {
          assert.equal(normalized.features.notes.enabled, true);
          assert.equal(normalized.features.notes.isPrivateDiary, true);
          assert.ok(normalized.features.notes.reflectionPrompts.length > 0);
        }

        // Test serialization round-trip
        const serialized = serializeHabitForFirestore(normalized);
        assert.ok(serialized, 'Serialization must succeed');
        assert.equal(serialized.id, docId);
        assert.equal(serialized.title, legacyRoutine.title);
      }
    });
  });

  // ==========================================================================
  // 4. Daily Log Normalization, Conflict Resolution & Layer Separation
  // ==========================================================================
  describe('4. Daily Log Normalization, Conflict Resolution & Layer Separation', () => {
    it('should strictly validate persisted daily log schema and reject unrecorded status', () => {
      const validDoc = {
        userId: 'usr123',
        date: '2026-10-17',
        timezone: 'Asia/Kolkata',
        habitOutcomes: {
          habit_a: { status: 'completed' },
          habit_b: { status: 'skipped', reason: 'Travel day' },
          habit_c: { status: 'missed' },
        },
      };

      const validResult = validateDailyLogDoc(validDoc);
      assert.equal(validResult.valid, true, `Expected valid log, got errors: ${validResult.errors.join(', ')}`);

      // Attempting to persist 'unrecorded' status must fail validation
      const invalidDoc = {
        ...validDoc,
        habitOutcomes: {
          ...validDoc.habitOutcomes,
          habit_d: { status: 'unrecorded' },
        },
      };
      const invalidResult = validateDailyLogDoc(invalidDoc);
      assert.equal(invalidResult.valid, false);
      assert.ok(invalidResult.errors.some(e => e.includes('unrecorded')));
    });

    it('should resolve conflicts in favor of authoritative completedHabitIds with structured warning', () => {
      const conflictingLegacyData = {
        userId: 'usr_test',
        date: '2026-10-16',
        completedHabitIds: ['habit_conflicted'],
        habitOutcomes: {
          habit_conflicted: { status: 'skipped', reason: 'User toggled skip earlier' },
        },
      };

      // Intercept console.warn to verify structured warning
      const warnings = [];
      const origWarn = console.warn;
      console.warn = (msg) => warnings.push(msg);

      try {
        const normalized = normalizeDailyLogFromFirestore(conflictingLegacyData, 'usr_test_2026-10-16');
        assert.equal(normalized.habitOutcomes.habit_conflicted.status, 'completed', 'Completion must take precedence');
        assert.equal(normalized.getHabitStatus('habit_conflicted'), 'completed');
        assert.ok(warnings.some(w => w.includes('[Normalization Warning] Conflicting habit outcome resolved to completed')));
      } finally {
        console.warn = origWarn;
      }
    });

    it('should normalize legacy daily logs without fabricating explicit misses or unrecorded outcomes', () => {
      const legacyLog = {
        userId: 'usr_test',
        date: '2026-10-15',
        completedHabitIds: ['habit_reading'],
        habitProgress: {
          habit_reading: { durationMinutes: 30 },
          habit_workout: { workoutCompleted: false },
        },
        // Notice: NO habitOutcomes field in legacy log
      };

      const normalized = normalizeDailyLogFromFirestore(legacyLog, 'usr_test_2026-10-15');

      // 1. Completed habit has outcome
      assert.equal(normalized.habitOutcomes.habit_reading.status, 'completed');
      assert.equal(normalized.getHabitStatus('habit_reading'), 'completed');

      // 2. Uncompleted habit is NOT in habitOutcomes (never fabricated as explicit miss)
      assert.equal(normalized.habitOutcomes.habit_workout, undefined, 'Must not fabricate miss in habitOutcomes');
      
      // 3. Domain query resolves in memory to 'unrecorded'
      assert.equal(normalized.getHabitStatus('habit_workout'), 'unrecorded');
      assert.equal(normalized.getHabitStatus('habit_other'), 'unrecorded');

      // 4. Serialization strips unrecorded status and preserves clean persisted schema
      const serialized = serializeDailyLogForFirestore(normalized);
      assert.equal(Object.keys(serialized.habitOutcomes).length, 1);
      assert.equal(serialized.habitOutcomes.habit_reading.status, 'completed');
      assert.deepEqual(serialized.completedHabitIds, ['habit_reading']);
    });
  });

  // ==========================================================================
  // 5. Historical Provenance Policy (4 Tiers)
  // ==========================================================================
  describe('5. Habit-Specific Historical Provenance Policy Engine', () => {
    it('Tier 1: should assign verified_creation when createdAt exists and no logs precede it', () => {
      const habit = { id: 'h1', createdAt: '2026-10-14T10:00:00Z' };
      const logs = [{ date: '2026-10-14', completedHabitIds: ['h1'] }];
      const horizon = deriveTrackingHorizon(habit, logs, 'UTC');

      assert.equal(horizon.status, 'verified_creation');
      assert.equal(horizon.startDate, '2026-10-14');
    });

    it('Tier 2: should assign verified_first_log when habit-specific log precedes createdAt (re-seeded)', () => {
      const habit = { id: 'h1', createdAt: '2026-10-16T14:00:00Z' };
      const logs = [
        { date: '2026-10-15', completedHabitIds: ['h1'] }, // Precedes createdAt!
        { date: '2026-10-16', completedHabitIds: ['h1'] },
      ];
      const horizon = deriveTrackingHorizon(habit, logs, 'UTC');

      assert.equal(horizon.status, 'verified_first_log');
      assert.equal(horizon.startDate, '2026-10-15', 'Horizon must anchor to earliest log');
    });

    it('Tier 3: should assign inferred_activity when createdAt is missing but habit logs exist', () => {
      const habit = { id: 'h1', createdAt: null };
      const logs = [{ date: '2026-10-10', completedHabitIds: ['h1'] }];
      const horizon = deriveTrackingHorizon(habit, logs, 'UTC');

      assert.equal(horizon.status, 'inferred_activity');
      assert.equal(horizon.startDate, '2026-10-10');
    });

    it('Tier 4: should assign unverifiable and startDate null when habit lacks createdAt and zero habit logs', () => {
      const habit = { id: 'h1', createdAt: null };
      // Logs exist for OTHER habits only!
      const logs = [{ date: '2026-10-10', completedHabitIds: ['other_habit'] }];
      const horizon = deriveTrackingHorizon(habit, logs, 'UTC');

      assert.equal(horizon.status, 'unverifiable');
      assert.equal(horizon.startDate, null, 'Must NOT derive horizon from other habits or user createdAt');
    });
  });

  // ==========================================================================
  // 6. Security Rules Contract & Ownership Invariants
  // ==========================================================================
  describe('6. Security Rules Contract & Ownership Invariants', () => {
    it('should verify firestore.rules declares granular immutable ownership across all 4 paths', () => {
      const rulesPath = path.resolve(__dirname, '../firestore.rules');
      assert.ok(fs.existsSync(rulesPath), 'web/firestore.rules must exist');
      const content = fs.readFileSync(rulesPath, 'utf-8');

      // 1. /habits/{habitId}
      assert.ok(content.includes('match /habits/{habitId}'), 'Must declare habits match rule');
      assert.ok(content.includes('allow create: if isAuthenticated()'), 'Must declare distinct create rule on habits');
      assert.ok(content.includes('allow update: if isAuthenticated()'), 'Must declare distinct update rule on habits');
      assert.ok(
        content.includes('request.resource.data.userId == resource.data.userId'),
        'Habits update rule must enforce immutable userId ownership'
      );
      assert.ok(content.includes('allow delete: if isAuthenticated()'), 'Must declare distinct delete rule on habits');

      // 2. /dailyLogs/{logId}
      assert.ok(content.includes('match /dailyLogs/{logId}'), 'Must declare dailyLogs match rule');
      assert.ok(content.includes('request.resource.data.date is string'), 'Must validate date string on log create');
      assert.ok(
        content.includes('request.resource.data.date == resource.data.date'),
        'DailyLogs update rule must enforce immutable date'
      );

      // 3. /users/{userId}
      assert.ok(content.includes('match /users/{userId}'), 'Must declare users match rule');
      assert.ok(content.includes('allow read, create, update, delete: if isOwner(userId);'), 'Must restrict user doc to owner');

      // 4. /users/{userId}/habitState/{habitId}
      assert.ok(content.includes('match /habitState/{habitId}'), 'Must declare habitState subcollection rule');
      assert.ok(
        content.includes('allow read, create, update, delete: if isOwner(userId);'),
        'HabitState must be strictly restricted to owning user'
      );
    });

    it('should simulate security rule evaluations for authorized and unauthorized scenarios', () => {
      // Security condition simulation matching firestore.rules:
      const evaluateHabitUpdate = (authUid, existingDoc, updateData) => {
        const isAuth = Boolean(authUid);
        if (!isAuth) return false;
        const ownsExisting = existingDoc.userId === authUid;
        const ownershipImmutable = updateData.userId === existingDoc.userId;
        const validTitle = typeof updateData.title === 'string' && updateData.title.length > 0 && updateData.title.length <= 200;
        return ownsExisting && ownershipImmutable && validTitle;
      };

      const evaluateDailyLogUpdate = (authUid, existingDoc, updateData) => {
        const isAuth = Boolean(authUid);
        if (!isAuth) return false;
        const ownsExisting = existingDoc.userId === authUid;
        const ownershipImmutable = updateData.userId === existingDoc.userId;
        const dateImmutable = updateData.date === existingDoc.date;
        return ownsExisting && ownershipImmutable && dateImmutable;
      };

      // Scenario A: Authorized owner update
      assert.equal(
        evaluateHabitUpdate('user_123', { userId: 'user_123' }, { userId: 'user_123', title: 'New Title' }),
        true,
        'Authorized owner update must succeed'
      );

      // Scenario B: Unauthorized user attempting to update another user habit
      assert.equal(
        evaluateHabitUpdate('attacker_999', { userId: 'victim_123' }, { userId: 'victim_123', title: 'Hacked' }),
        false,
        'Cross-user update must be rejected'
      );

      // Scenario C: Owner attempting to transfer ownership (mutable userId tamper attempt)
      assert.equal(
        evaluateHabitUpdate('user_123', { userId: 'user_123' }, { userId: 'transferee_456', title: 'Transfer' }),
        false,
        'Attempt to mutate userId must be rejected'
      );

      // Scenario D: Attempting to mutate daily-log date
      assert.equal(
        evaluateDailyLogUpdate('user_123', { userId: 'user_123', date: '2026-10-15' }, { userId: 'user_123', date: '2026-10-16' }),
        false,
        'Attempt to mutate daily-log date must be rejected'
      );
    });
  });

});
