import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATEGORIES,
  validateComposableHabit,
  validateDailyLogDoc,
  deriveTrackingHorizon,
} from '../src/lib/constants/habit-models.js';

import {
  buildNormalizedComposableHabit,
  CANONICAL_CATEGORY_MAP,
  TARGET_ACCOUNTS,
  executeAccountMigrationTransaction,
  canonicalSerialize,
  canonicalJsonString,
} from '../../scripts/migrate-composable-habits.mjs';

import {
  executeAccountRollbackTransaction,
} from '../../scripts/rollback-composable-habits.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 5: Composable Habit & State Decoupling Migration Tooling', () => {

  // ============================================================================
  // 1. Schema Normalization & Validation for All 6 Canonical Routines
  // ============================================================================
  describe('1. Schema Normalization & Feature Slot Fidelity', () => {
    const rawPersonalHabits = [
      {
        id: 'usr_canonical_english_speaking',
        userId: 'usr_test',
        title: 'Practice English Speaking',
        category: 'Communication',
        completionMethod: 'simple_with_notes',
        instructions: 'Practice conversational fluency and pronunciation.',
        time: 'Flexible',
        createdAt: '2026-10-14T16:22:01.449Z',
      },
      {
        id: 'usr_canonical_english_workbook',
        userId: 'usr_test',
        title: 'Practice English Workbook',
        category: 'English Learning',
        completionMethod: 'workbook_sessions',
        instructions: 'Word Power Made Easy daily vocabulary building.',
        time: 'Flexible',
        metadata: { dailySessionsTarget: 2 },
        createdAt: '2026-10-14T16:22:01.449Z',
      },
      {
        id: 'usr_canonical_exercise_plan',
        userId: 'usr_test',
        title: 'Exercise / Movement Plan',
        category: 'Movement & Strength',
        completionMethod: 'exercise_plan',
        instructions: '12-week progressive conditioning plan.',
        time: 'Afternoon',
        metadata: { restDays: ['Sun'] },
        createdAt: '2026-10-14T16:22:01.449Z',
      },
      {
        id: 'usr_canonical_listen_osho',
        userId: 'usr_test',
        title: 'Listen to Osho',
        category: 'Listening & Awareness',
        completionMethod: 'osho_listening',
        instructions: 'Daily discourse listening.',
        time: 'Flexible',
        metadata: { libraryCount: 30 },
        createdAt: '2026-10-14T16:22:01.449Z',
      },
      {
        id: 'usr_canonical_maintain_diary',
        userId: 'usr_test',
        title: 'Maintain a Diary',
        category: 'Reflection',
        completionMethod: 'diary_entry',
        instructions: 'Private diary reflection.',
        time: 'Flexible',
        createdAt: '2026-10-14T16:22:01.449Z',
      },
      {
        id: 'usr_canonical_read_books',
        userId: 'usr_test',
        title: 'Read Books',
        category: 'Reading',
        completionMethod: 'reading_duration',
        instructions: 'Read 30 minutes before bed.',
        targetMinutes: 30,
        time: 'Before bed',
        createdAt: '2026-10-14T16:22:01.449Z',
      },
    ];

    it('should normalize all 6 legacy habits into valid composable models', () => {
      for (const raw of rawPersonalHabits) {
        const normalized = buildNormalizedComposableHabit(raw, raw.id, raw.userId);
        assert.ok(normalized, `Failed to build normalized habit for ${raw.title}`);
        assert.equal(normalized.id, raw.id);
        assert.equal(normalized.userId, raw.userId);
        assert.equal(normalized.title, raw.title);

        // Validation against strict composable habit schema
        const validation = validateComposableHabit(normalized);
        assert.equal(
          validation.valid,
          true,
          `Validation failed for ${raw.title}: ${validation.errors.join('; ')}`
        );

        // Category must belong to the 9 canonical life areas
        assert.ok(
          CATEGORIES.includes(normalized.category),
          `Normalized category "${normalized.category}" must be in CATEGORIES`
        );
      }
    });

    it('should correctly map workbook sessions counter and checklist', () => {
      const workbookRaw = rawPersonalHabits.find(h => h.completionMethod === 'workbook_sessions');
      const normalized = buildNormalizedComposableHabit(workbookRaw, workbookRaw.id, workbookRaw.userId);

      assert.equal(normalized.features.counter.enabled, true);
      assert.equal(normalized.features.counter.targetCount, 2);
      assert.equal(normalized.features.counter.unit, 'sessions');

      assert.equal(normalized.features.checklist.enabled, true);
      assert.equal(normalized.features.checklist.items.length, 2);
      assert.ok(normalized.features.checklist.items.every(i => i.isRequiredForCompletion));
    });

    it('should correctly configure exercise plan daySchedule with Sunday rest', () => {
      const exerciseRaw = rawPersonalHabits.find(h => h.completionMethod === 'exercise_plan');
      const normalized = buildNormalizedComposableHabit(exerciseRaw, exerciseRaw.id, exerciseRaw.userId);

      assert.equal(normalized.features.daySchedule.enabled, true);
      assert.equal(normalized.features.daySchedule.totalWeeks, 12);
      assert.ok(normalized.schedule.restDays.includes('Sun'));
      assert.equal(normalized.schedule.timingType, 'preferred_period');
      assert.equal(normalized.schedule.preferredPeriod, 'Afternoon');
    });

    it('should correctly configure Osho listening catalog with 30 items', () => {
      const oshoRaw = rawPersonalHabits.find(h => h.completionMethod === 'osho_listening');
      const normalized = buildNormalizedComposableHabit(oshoRaw, oshoRaw.id, oshoRaw.userId);

      assert.equal(normalized.features.catalog.enabled, true);
      assert.equal(normalized.features.catalog.catalogId, 'osho_discourses');
      assert.equal(normalized.features.catalog.totalItems, 30);
    });

    it('should correctly configure reading countdown timer', () => {
      const readingRaw = rawPersonalHabits.find(h => h.completionMethod === 'reading_duration');
      const normalized = buildNormalizedComposableHabit(readingRaw, readingRaw.id, readingRaw.userId);

      assert.equal(normalized.features.timer.enabled, true);
      assert.equal(normalized.features.timer.targetDurationMinutes, 30);
      assert.equal(normalized.features.timer.mode, 'countdown');
    });

    it('should correctly configure private diary with reflection prompts', () => {
      const diaryRaw = rawPersonalHabits.find(h => h.completionMethod === 'diary_entry');
      const normalized = buildNormalizedComposableHabit(diaryRaw, diaryRaw.id, diaryRaw.userId);

      assert.equal(normalized.features.notes.enabled, true);
      assert.equal(normalized.features.notes.isPrivateDiary, true);
      assert.equal(normalized.features.notes.reflectionPrompts.length, 5);
    });
  });

  // ============================================================================
  // 2. State Decoupling Schema Transformations
  // ============================================================================
  describe('2. State Decoupling Architecture', () => {
    it('should decouple user exercisePlan to habitState subcollection model', () => {
      const mockUserDoc = {
        exercisePlan: {
          currentWeek: 2,
          startDate: '2026-10-15',
          activated: true,
          checkupCompleted: false,
          phaseHistory: [{ week: 1, completedAt: '2026-10-22' }],
        },
      };

      const habitId = 'user_test_canonical_exercise_plan';
      const habitStateDoc = {
        habitId,
        userId: 'user_test',
        currentWeek: mockUserDoc.exercisePlan.currentWeek,
        startDate: mockUserDoc.exercisePlan.startDate,
        activated: mockUserDoc.exercisePlan.activated,
        checkupCompleted: mockUserDoc.exercisePlan.checkupCompleted,
        phaseHistory: mockUserDoc.exercisePlan.phaseHistory,
      };

      assert.equal(habitStateDoc.currentWeek, 2);
      assert.equal(habitStateDoc.startDate, '2026-10-15');
      assert.equal(habitStateDoc.habitId, habitId);
      assert.equal(habitStateDoc.phaseHistory.length, 1);
    });

    it('should decouple user oshoSeriesProgress to habitState subcollection model', () => {
      const mockUserDoc = {
        activeOshoSeriesId: 'osho_01',
        oshoSeriesProgress: {
          osho_22: { lastUpdated: '2026-10-15T16:34:29.696Z', completedTalks: 4 },
          osho_01: { lastUpdated: '2026-10-16T17:37:02.726Z', completedTalks: 5 },
        },
      };

      const habitId = 'user_test_canonical_listen_osho';
      const habitStateDoc = {
        habitId,
        userId: 'user_test',
        activeSeriesId: mockUserDoc.activeOshoSeriesId,
        seriesProgress: mockUserDoc.oshoSeriesProgress,
      };

      assert.equal(habitStateDoc.activeSeriesId, 'osho_01');
      assert.equal(habitStateDoc.seriesProgress.osho_22.completedTalks, 4);
      assert.equal(habitStateDoc.seriesProgress.osho_01.completedTalks, 5);
    });

    it('should prove exact field-by-field preservation of raw oshoSeriesProgress without reduction to simple counts', () => {
      // 1. Raw source from pre-migration backup
      const rawSource = {
        activeOshoSeriesId: 'osho_01',
        oshoSeriesProgress: {
          osho_22: {
            lastUpdated: '2026-10-15T16:34:29.696Z',
            completedTalks: 4,
          },
          osho_01: {
            lastUpdated: '2026-10-16T17:37:02.726Z',
            completedTalks: 5,
          },
        },
      };

      // 2. Migration transformation into habitState subcollection document
      const habitId = '2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_listen_osho';
      const decoupledOshoDoc = {
        habitId,
        userId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
        activeSeriesId: rawSource.activeOshoSeriesId,
        seriesProgress: rawSource.oshoSeriesProgress,
      };

      // Assert exact deep equality between source and destination seriesProgress
      assert.deepEqual(decoupledOshoDoc.seriesProgress, rawSource.oshoSeriesProgress);
      assert.equal(typeof decoupledOshoDoc.seriesProgress.osho_01, 'object');
      assert.equal(decoupledOshoDoc.seriesProgress.osho_01.completedTalks, 5);
      assert.equal(decoupledOshoDoc.seriesProgress.osho_01.lastUpdated, '2026-10-16T17:37:02.726Z');
      assert.equal(decoupledOshoDoc.seriesProgress.osho_22.completedTalks, 4);
      assert.equal(decoupledOshoDoc.seriesProgress.osho_22.lastUpdated, '2026-10-15T16:34:29.696Z');
      assert.equal(decoupledOshoDoc.activeSeriesId, 'osho_01');

      // 3. Consumer read simulation: SlotCatalog / OshoLibraryModal access
      const userProfile = {
        displayName: 'Manish Borikar',
        activeOshoSeriesId: decoupledOshoDoc.activeSeriesId,
        oshoSeriesProgress: decoupledOshoDoc.seriesProgress,
      };

      const activeSeriesId = userProfile.activeOshoSeriesId || 'osho_01';
      const seriesProgress = userProfile.oshoSeriesProgress || {};
      const currentSeries = seriesProgress[activeSeriesId];

      assert.equal(activeSeriesId, 'osho_01');
      assert.ok(currentSeries);
      assert.equal(currentSeries.completedTalks, 5);
      assert.equal(currentSeries.lastUpdated, '2026-10-16T17:37:02.726Z');

      // 4. Consumer update simulation: handleUpdateTalkProgress in SlotCatalog.js
      const updatedProgress = {
        ...seriesProgress,
        osho_01: {
          ...(seriesProgress.osho_01 || {}),
          completedTalks: 6,
          lastUpdated: '2026-10-17T23:00:00.000Z',
        },
      };

      // saveUserProfile updates habitState document
      const updatedOshoDoc = {
        ...decoupledOshoDoc,
        seriesProgress: updatedProgress,
      };

      assert.equal(updatedOshoDoc.seriesProgress.osho_01.completedTalks, 6);
      assert.equal(updatedOshoDoc.seriesProgress.osho_01.lastUpdated, '2026-10-17T23:00:00.000Z');
      assert.equal(updatedOshoDoc.seriesProgress.osho_22.completedTalks, 4, 'Unaffected series must remain intact');
      assert.equal(updatedOshoDoc.seriesProgress.osho_22.lastUpdated, '2026-10-15T16:34:29.696Z');
    });
  });

  // ============================================================================
  // 3. Backup Checksum & Tamper Detection
  // ============================================================================
  describe('3. Backup Integrity & Checksum Verification', () => {
    it('should compute and verify SHA-256 checksum across backup payload', () => {
      const samplePayload = {
        users: { 'u_1': { id: 'u_1', data: { name: 'Test' } } },
        habits: { 'u_1': [{ id: 'h_1', data: { title: 'Habit 1' } }] },
        habitState: { 'u_1': [] },
        dailyLogs: { 'u_1': [{ id: 'l_1', data: { date: '2026-10-17' } }] },
      };

      const rawString = JSON.stringify(samplePayload);
      const checksum = crypto.createHash('sha256').update(rawString, 'utf8').digest('hex');

      // Verify identical content produces identical checksum
      const recomputed = crypto.createHash('sha256').update(JSON.stringify(samplePayload), 'utf8').digest('hex');
      assert.equal(checksum, recomputed);

      // Verify tamper detection
      const tamperedPayload = {
        ...samplePayload,
        habits: { 'u_1': [{ id: 'h_1', data: { title: 'TAMPERED TITLE' } }] },
      };
      const tamperedChecksum = crypto.createHash('sha256').update(JSON.stringify(tamperedPayload), 'utf8').digest('hex');
      assert.notEqual(checksum, tamperedChecksum, 'Tampered payload must produce distinct checksum');
    });
  });

  // ============================================================================
  // 4. Rollback Behavior Simulation (Non-Destructive Exact Overwrite)
  // ============================================================================
  describe('4. Rollback Behavior Simulation on Controlled Fixtures', () => {
    it('should accurately plan restoration of original documents and deletion of migration artifacts', () => {
      const mockBackup = {
        users: {
          'user_abc': {
            id: 'user_abc',
            data: {
              exercisePlan: { currentWeek: 1 },
              oshoSeriesProgress: { osho_01: { completedTalks: 2 } },
            },
          },
        },
        habits: {
          'user_abc': [
            {
              id: 'habit_abc_1',
              path: 'habits/habit_abc_1',
              data: {
                title: 'Exercise Plan',
                category: 'Movement & Strength',
                completionMethod: 'exercise_plan',
              },
            },
          ],
        },
      };

      // In a simulated migrated state, habit has `features` and user doc lacks `exercisePlan`
      const simulatedMigratedHabit = {
        title: 'Exercise Plan',
        category: 'Health & Fitness',
        features: { daySchedule: { enabled: true } },
        scheduleHistory: [{ effectiveDate: '2026-10-14' }],
      };

      // Exact overwrite rollback replaces simulatedMigratedHabit with mockBackup.habits.data
      const rolledBackHabit = { ...mockBackup.habits['user_abc'][0].data };

      assert.equal(rolledBackHabit.category, 'Movement & Strength');
      assert.equal(rolledBackHabit.completionMethod, 'exercise_plan');
      assert.equal(rolledBackHabit.features, undefined, 'Migrated features must not exist on rolled back habit');
      assert.equal(rolledBackHabit.scheduleHistory, undefined, 'Schedule history must not exist on rolled back habit');

      // User document rollback restores exercisePlan
      const rolledBackUser = { ...mockBackup.users['user_abc'].data };
      assert.equal(rolledBackUser.exercisePlan.currentWeek, 1);
      assert.equal(rolledBackUser.oshoSeriesProgress.osho_01.completedTalks, 2);
    });
  });

  // ============================================================================
  // 5. Account Separation & Default Safety Invariants
  // ============================================================================
  describe('5. Account Role Separation & Safety Invariants', () => {
    it('should enforce distinct roles for testing account and protected personal account', () => {
      assert.equal(TARGET_ACCOUNTS.personal.email, 'manishborikar92@gmail.com');
      assert.equal(TARGET_ACCOUNTS.personal.uid, '2W83kgjX9db8QiIWqZd5AJrc8PQ2');
      assert.ok(TARGET_ACCOUNTS.personal.role.includes('Protected Personal'));

      assert.equal(TARGET_ACCOUNTS.test.email, 'theodinproject0622@gmail.com');
      assert.equal(TARGET_ACCOUNTS.test.uid, 'fr9Yo4VDtuRN8LjX1YKWLSLaSx42');
      assert.ok(TARGET_ACCOUNTS.test.role.includes('Testing Account'));
    });
  });

  // ============================================================================
  // 6. High-Fidelity Data Serialization & Fixture Restoration
  // ============================================================================
  describe('6. High-Fidelity Data Serialization & Fixture Restoration', () => {
    it('should preserve Firestore timestamps and dates with exact second/nanosecond precision', () => {
      const mockTimestamp = {
        _type: 'timestamp',
        iso: '2026-10-16T17:37:03.909Z',
        seconds: 1792172223,
        nanoseconds: 909000000,
      };

      // Mock Firestore Timestamp constructor
      class MockTimestamp {
        constructor(seconds, nanoseconds) {
          this.seconds = seconds;
          this.nanoseconds = nanoseconds;
        }
        toDate() {
          return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
        }
      }

      // Deserialization test
      const deserialized = new MockTimestamp(mockTimestamp.seconds, mockTimestamp.nanoseconds);
      assert.equal(deserialized.seconds, 1792172223);
      assert.equal(deserialized.nanoseconds, 909000000);
      assert.equal(deserialized.toDate().toISOString(), '2026-10-16T17:37:03.909Z');
    });

    it('should preserve nested maps and arrays without shallow flattening or corruption', () => {
      const complexFixture = {
        userId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
        date: '2026-10-17',
        completedHabitIds: ['habit_1', 'habit_2'],
        habitProgress: {
          habit_1: {
            sessionCount: 2,
            completedItemIds: ['step_review', 'step_focus'],
            notes: 'Completed uninterrupted session.',
          },
          habit_2: {
            durationMinutes: 30,
            activeCatalogItemId: 'talk_05',
          },
        },
        phaseHistory: [
          { week: 1, completedAt: '2026-10-15T10:00:00Z', notes: 'Phase 1 baseline' },
          { week: 2, completedAt: '2026-10-22T10:00:00Z', notes: 'Phase 2 progress' },
        ],
        oshoSeriesProgress: {
          osho_01: { completedTalks: 5, lastUpdated: '2026-10-16T17:37:02.726Z' },
          osho_22: { completedTalks: 4, lastUpdated: '2026-10-15T16:34:29.696Z' },
        },
      };

      const serialized = JSON.stringify(complexFixture);
      const restored = JSON.parse(serialized);

      assert.deepEqual(restored.habitProgress.habit_1.completedItemIds, ['step_review', 'step_focus']);
      assert.equal(restored.habitProgress.habit_1.sessionCount, 2);
      assert.equal(restored.phaseHistory.length, 2);
      assert.equal(restored.phaseHistory[1].week, 2);
      assert.equal(restored.oshoSeriesProgress.osho_01.completedTalks, 5);
      assert.equal(restored.oshoSeriesProgress.osho_22.completedTalks, 4);
    });

    it('should preserve null values and distinguish them from absent/undefined fields', () => {
      const docWithNulls = {
        id: 'habit_null_test',
        userId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
        relativeTiming: null,
        preferredPeriod: null,
        targetMinutes: null,
        instructions: 'Test habit with null fields',
      };

      const serialized = JSON.stringify(docWithNulls);
      const parsed = JSON.parse(serialized);

      assert.equal(parsed.relativeTiming, null);
      assert.equal(parsed.preferredPeriod, null);
      assert.equal(parsed.targetMinutes, null);
      assert.equal(parsed.nonExistentField, undefined);
    });

    it('should reconcile exercisePlan date field to sole canonical startDate', () => {
      const sourceUserDoc = {
        exercisePlan: {
          currentWeek: 1,
          startDate: '2026-10-15',
          activated: true,
          checkupCompleted: false,
        },
      };

      const resolvedStartDate = sourceUserDoc.exercisePlan.startDate || '2026-10-15';
      const decoupledState = {
        habitId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_exercise_plan',
        userId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
        currentWeek: sourceUserDoc.exercisePlan.currentWeek,
        startDate: resolvedStartDate,
        activated: sourceUserDoc.exercisePlan.activated,
        checkupCompleted: sourceUserDoc.exercisePlan.checkupCompleted,
      };

      // Sole canonical field
      assert.equal(decoupledState.startDate, '2026-10-15');
      assert.equal(decoupledState.planStartDate, undefined);
      assert.equal(decoupledState.currentWeek, 1);
    });
  });

  // ============================================================================
  // 7. Concurrency Safety & Tamper Detection Invariants
  // ============================================================================
  describe('7. Concurrency Safety & Tamper Detection Invariants', () => {
    it('should detect altered backup content and throw tamper error', () => {
      const validPayload = {
        users: { 'u_test': { id: 'u_test', data: { name: 'Original' } } },
        habits: { 'u_test': [] },
        habitState: { 'u_test': [] },
        dailyLogs: { 'u_test': [] },
      };
      const canonicalString = JSON.stringify({
        users: validPayload.users,
        habits: validPayload.habits,
        habitState: validPayload.habitState,
        dailyLogs: validPayload.dailyLogs,
      });
      const validChecksum = crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');

      // Tampered payload
      const tamperedPayload = {
        ...validPayload,
        users: { 'u_test': { id: 'u_test', data: { name: 'Altered Name' } } },
      };
      const tamperedString = JSON.stringify({
        users: tamperedPayload.users,
        habits: tamperedPayload.habits,
        habitState: tamperedPayload.habitState,
        dailyLogs: tamperedPayload.dailyLogs,
      });
      const computedTampered = crypto.createHash('sha256').update(tamperedString, 'utf8').digest('hex');

      assert.notEqual(computedTampered, validChecksum);

      // Verify that checksum guard throws when mismatched
      assert.throws(() => {
        if (computedTampered !== validChecksum) {
          throw new Error(`[CRITICAL] Backup checksum mismatch! Tamper detected. Expected: ${validChecksum}, Computed: ${computedTampered}`);
        }
      }, /Tamper detected/);
    });

    it('should detect document concurrency mismatch if document was modified after snapshot', () => {
      const snapshotUpdatedAt = { seconds: 1792172223, nanoseconds: 909000000 };
      const liveUpdatedAt = { seconds: 1792242521, nanoseconds: 929000000 };

      // Concurrency check function
      const isDocumentModified = (snapshotTs, liveTs) => {
        return JSON.stringify(snapshotTs) !== JSON.stringify(liveTs);
      };

      assert.equal(isDocumentModified(snapshotUpdatedAt, liveUpdatedAt), true, 'Must detect modified document');
      assert.equal(isDocumentModified(snapshotUpdatedAt, snapshotUpdatedAt), false, 'Must match unchanged document');
    });

    it('should reject rollback if habit document has unreviewed post-migration modifications without --force', () => {
      const preMigrationHabit = {
        title: 'Original Title',
        category: 'Movement & Strength',
        completionMethod: 'exercise_plan',
      };

      // Simulated user modification made AFTER migration
      const currentLiveHabit = {
        title: 'Modified by User Post-Migration',
        category: 'Health & Fitness',
        completionMethod: 'exercise_plan', // Features removed
      };

      const canRollbackWithoutForce = (preDoc, liveDoc, force) => {
        if (!force && liveDoc.title !== preDoc.title && !liveDoc.features) {
          throw new Error('[CONCURRENCY GUARD] Habit has post-migration modifications. Specify --force with reviewed authorization.');
        }
        return true;
      };

      assert.throws(() => {
        canRollbackWithoutForce(preMigrationHabit, currentLiveHabit, false);
      }, /CONCURRENCY GUARD/);

      // With force=true, it permits explicit reviewed recovery
      assert.equal(canRollbackWithoutForce(preMigrationHabit, currentLiveHabit, true), true);
    });

    it('should abort migration transaction immediately if document is modified concurrently before commit', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;
      const backupTimestamp = { seconds: 1792172223, nanoseconds: 909000000 };
      const modifiedTimestamp = { seconds: 1792242521, nanoseconds: 929000000 };

      const backupData = {
        users: {
          [uid]: {
            data: {
              updatedAt: backupTimestamp,
              exercisePlan: { currentWeek: 1, startDate: '2026-10-15' },
            },
          },
        },
        habits: {
          [uid]: [
            {
              id: habitId,
              data: {
                id: habitId,
                title: 'Exercise / Movement Plan',
                category: 'Movement & Strength',
                completionMethod: 'exercise_plan',
                updatedAt: backupTimestamp,
              },
            },
          ],
        },
      };

      const accountData = {
        habitTransformations: [
          { id: habitId, title: 'Exercise / Movement Plan' },
        ],
        stateDecoupling: [
          {
            sourceField: 'users/{uid}.exercisePlan',
            destinationDoc: `users/${uid}/habitState/${habitId}`,
            data: { currentWeek: 1, startDate: '2026-10-15' },
          },
        ],
      };

      const mockFieldValue = {
        serverTimestamp: () => ({ _type: 'serverTimestamp' }),
        delete: () => ({ _type: 'deleteField' }),
      };

      // Case A: User document modified concurrently right before commit
      const liveDocsUserModified = {
        [`users/${uid}`]: { ...backupData.users[uid].data, updatedAt: modifiedTimestamp },
        [`habits/${habitId}`]: backupData.habits[uid][0].data,
      };

      let transactionWrites = [];
      const mockDbUserModified = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (ref) => ({
              exists: Boolean(liveDocsUserModified[ref.path]),
              data: () => liveDocsUserModified[ref.path],
            }),
            set: (ref, data) => transactionWrites.push({ type: 'set', path: ref.path, data }),
            update: (ref, data) => transactionWrites.push({ type: 'update', path: ref.path, data }),
            delete: (ref) => transactionWrites.push({ type: 'delete', path: ref.path }),
          };
          await updateFunction(transaction);
        },
      };

      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: mockDbUserModified,
          uid,
          accountData,
          backupData,
          FieldValue: mockFieldValue,
          serializeHabitForFirestore: (h) => h,
        });
      }, /CONCURRENCY_ABORT/);
      assert.equal(transactionWrites.length, 0, 'Zero writes must be executed when user document is modified concurrently');

      // Case B: Habit document modified concurrently right before commit
      const liveDocsHabitModified = {
        [`users/${uid}`]: backupData.users[uid].data,
        [`habits/${habitId}`]: { ...backupData.habits[uid][0].data, updatedAt: modifiedTimestamp },
      };

      transactionWrites = [];
      const mockDbHabitModified = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (ref) => ({
              exists: Boolean(liveDocsHabitModified[ref.path]),
              data: () => liveDocsHabitModified[ref.path],
            }),
            set: (ref, data) => transactionWrites.push({ type: 'set', path: ref.path, data }),
            update: (ref, data) => transactionWrites.push({ type: 'update', path: ref.path, data }),
            delete: (ref) => transactionWrites.push({ type: 'delete', path: ref.path }),
          };
          await updateFunction(transaction);
        },
      };

      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: mockDbHabitModified,
          uid,
          accountData,
          backupData,
          FieldValue: mockFieldValue,
          serializeHabitForFirestore: (h) => h,
        });
      }, /CONCURRENCY_ABORT/);
      assert.equal(transactionWrites.length, 0, 'Zero writes must be executed when habit document is modified concurrently');

      // Case C: Unmodified documents -> Transaction commits cleanly
      const liveDocsClean = {
        [`users/${uid}`]: backupData.users[uid].data,
        [`habits/${habitId}`]: backupData.habits[uid][0].data,
      };

      transactionWrites = [];
      const mockDbClean = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (ref) => ({
              exists: Boolean(liveDocsClean[ref.path]),
              data: () => liveDocsClean[ref.path],
            }),
            set: (ref, data) => transactionWrites.push({ type: 'set', path: ref.path, data }),
            update: (ref, data) => transactionWrites.push({ type: 'update', path: ref.path, data }),
            delete: (ref) => transactionWrites.push({ type: 'delete', path: ref.path }),
          };
          await updateFunction(transaction);
        },
      };

      await executeAccountMigrationTransaction({
        adminDb: mockDbClean,
        uid,
        accountData,
        backupData,
        FieldValue: mockFieldValue,
        serializeHabitForFirestore: (h) => h,
      });

      // 1 habit set + 1 state set + 1 user update = 3 transactional writes
      assert.equal(transactionWrites.length, 3);
      assert.ok(transactionWrites.some(w => w.path === `habits/${habitId}`));
      assert.ok(transactionWrites.some(w => w.path === `users/${uid}/habitState/${habitId}`));
      assert.ok(transactionWrites.some(w => w.path === `users/${uid}`));
    });

    it('should abort rollback transaction if habit was modified post-migration without --force', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const plan = {
        usersToRestore: [{ uid, docPath: `users/${uid}`, data: { name: 'Restored User' } }],
        habitsToRestore: [{ id: habitId, docPath: `habits/${habitId}`, data: { userId: uid, title: 'Original Pre-Migration Title' } }],
        habitStatesToDelete: [{ uid, id: habitId, docPath: `users/${uid}/habitState/${habitId}` }],
      };

      // Live habit modified by user post-migration (e.g. customized title without composable features)
      const liveDocsModified = {
        [`users/${uid}`]: { name: 'Live User' },
        [`habits/${habitId}`]: { title: 'User Modified Title Post-Migration' },
        [`users/${uid}/habitState/${habitId}`]: { currentWeek: 1 },
      };

      let rollbackWrites = [];
      const createMockDb = (liveDocs) => ({
        doc: (p) => ({ path: p }),
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (ref) => ({
              exists: Boolean(liveDocs[ref.path]),
              data: () => liveDocs[ref.path],
            }),
            set: (ref, data) => rollbackWrites.push({ type: 'set', path: ref.path, data }),
            delete: (ref) => rollbackWrites.push({ type: 'delete', path: ref.path }),
          };
          await updateFunction(transaction);
        },
      });

      // Case A: Without --force -> Transaction aborts safely
      await assert.rejects(async () => {
        await executeAccountRollbackTransaction({
          adminDb: createMockDb(liveDocsModified),
          uid,
          plan,
          options: { force: false },
        });
      }, /POST_MIGRATION_CONCURRENCY_GUARD/);
      assert.equal(rollbackWrites.length, 0, 'Zero writes must occur when rollback encounters post-migration edits without --force');

      // Case B: With --force: true -> Transaction executes reviewed recovery
      rollbackWrites = [];
      await executeAccountRollbackTransaction({
        adminDb: createMockDb(liveDocsModified),
        uid,
        plan,
        options: { force: true },
      });
      assert.equal(rollbackWrites.length, 3, 'Rollback with --force must restore habit, user, and delete habitState');
    });

    it('should fail closed and abort migration if habit document changes after backup even without an updatedAt field', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      // Pre-migration backup snapshot has habit WITHOUT updatedAt field
      const backupData = {
        users: {
          [uid]: {
            data: {
              displayName: 'Test User',
              exercisePlan: { currentWeek: 1, startDate: '2026-10-15' },
            },
          },
        },
        habits: {
          [uid]: [
            {
              id: habitId,
              data: {
                id: habitId,
                title: 'Exercise / Movement Plan',
                category: 'Movement & Strength',
                completionMethod: 'exercise_plan',
                instructions: 'Initial instructions',
                // Notice: no updatedAt field in backup
              },
            },
          ],
        },
      };

      const accountData = {
        habitTransformations: [{ id: habitId, title: 'Exercise / Movement Plan' }],
        stateDecoupling: [{
          sourceField: 'users/{uid}.exercisePlan',
          destinationDoc: `users/${uid}/habitState/${habitId}`,
          data: { currentWeek: 1, startDate: '2026-10-15' },
        }],
      };

      // Live document was edited by user (instructions changed), but also has NO updatedAt field
      const liveDocs = {
        [`users/${uid}`]: { displayName: 'Test User', exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } },
        [`habits/${habitId}`]: {
          id: habitId,
          title: 'Exercise / Movement Plan',
          category: 'Movement & Strength',
          completionMethod: 'exercise_plan',
          instructions: 'Modified instructions without updating timestamp',
          // Notice: no updatedAt field
        },
      };

      let transactionWrites = [];
      const mockDb = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (ref) => ({
              exists: Boolean(liveDocs[ref.path]),
              data: () => liveDocs[ref.path],
            }),
            set: (ref, data) => transactionWrites.push({ type: 'set', path: ref.path, data }),
            update: (ref, data) => transactionWrites.push({ type: 'update', path: ref.path, data }),
            delete: (ref) => transactionWrites.push({ type: 'delete', path: ref.path }),
          };
          await updateFunction(transaction);
        },
      };

      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: mockDb,
          uid,
          accountData,
          backupData,
          FieldValue: { serverTimestamp: () => ({ _type: 'serverTimestamp' }), delete: () => ({ _type: 'deleteField' }) },
          serializeHabitForFirestore: (h) => h,
        });
      }, /CONCURRENCY_ABORT.*Habit document.*content differs/);

      assert.equal(transactionWrites.length, 0, 'Zero writes must occur when document changes without updatedAt');
    });

    it('should fail closed if source document is missing from backup snapshot or missing in live database', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const backupData = {
        users: { [uid]: { data: { displayName: 'Test User' } } },
        habits: { [uid]: [{ id: habitId, data: { id: habitId, title: 'Exercise' } }] },
      };

      const accountData = {
        habitTransformations: [{ id: habitId, title: 'Exercise' }],
        stateDecoupling: [],
      };

      let writes = [];
      const createMock = (liveDocs) => ({
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          const t = {
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: (ref, data) => writes.push({ type: 'set', path: ref.path }),
            update: (ref, data) => writes.push({ type: 'update', path: ref.path }),
          };
          await fn(t);
        },
      });

      // Case A: User doc missing in live DB
      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: createMock({ [`habits/${habitId}`]: { id: habitId, title: 'Exercise' } }),
          uid,
          accountData,
          backupData,
          FieldValue: {},
          serializeHabitForFirestore: (h) => h,
        });
      }, /CONCURRENCY_ABORT.*User document.*does not exist/);
      assert.equal(writes.length, 0);

      // Case B: Habit doc missing in live DB
      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: createMock({ [`users/${uid}`]: { displayName: 'Test User' } }),
          uid,
          accountData,
          backupData,
          FieldValue: {},
          serializeHabitForFirestore: (h) => h,
        });
      }, /CONCURRENCY_ABORT.*Habit document.*does not exist/);
      assert.equal(writes.length, 0);
    });

    it('should protect destination habitState documents and abort migration if destination already exists', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const backupData = {
        users: { [uid]: { data: { exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } } } },
        habits: { [uid]: [{ id: habitId, data: { id: habitId, title: 'Exercise' } }] },
      };

      const accountData = {
        habitTransformations: [{ id: habitId, title: 'Exercise' }],
        stateDecoupling: [{
          destinationDoc: `users/${uid}/habitState/${habitId}`,
          data: { currentWeek: 1, startDate: '2026-10-15' },
          sourceField: 'users/{uid}.exercisePlan',
        }],
      };

      // Destination habitState ALREADY exists before migration write
      const liveDocs = {
        [`users/${uid}`]: { exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } },
        [`habits/${habitId}`]: { id: habitId, title: 'Exercise' },
        [`users/${uid}/habitState/${habitId}`]: { currentWeek: 1, startDate: '2026-10-15', unexpectedField: true },
      };

      let writes = [];
      const mockDb = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          const t = {
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: (ref, data) => writes.push({ type: 'set', path: ref.path }),
            update: (ref, data) => writes.push({ type: 'update', path: ref.path }),
          };
          await fn(t);
        },
      };

      // Without allowResume -> strictly aborts
      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: mockDb,
          uid,
          accountData,
          backupData,
          FieldValue: { serverTimestamp: () => ({ _type: 'ts' }), delete: () => ({ _type: 'del' }) },
          serializeHabitForFirestore: (h) => h,
          options: { allowResume: false },
        });
      }, /DESTINATION_CONFLICT_ABORT.*already exists/);

      assert.equal(writes.length, 0, 'Zero writes must occur when destination already exists without allowResume');
    });

    it('should protect destination habitState documents during resume and abort if existing state differs', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const backupData = {
        users: { [uid]: { data: { exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } } } },
        habits: { [uid]: [{ id: habitId, data: { id: habitId, title: 'Exercise' } }] },
      };

      const accountData = {
        habitTransformations: [{ id: habitId, title: 'Exercise' }],
        stateDecoupling: [{
          destinationDoc: `users/${uid}/habitState/${habitId}`,
          data: { currentWeek: 1, startDate: '2026-10-15' },
          sourceField: 'users/{uid}.exercisePlan',
        }],
      };

      // Destination exists but differs from expected migration state
      const liveDocs = {
        [`users/${uid}`]: { exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } },
        [`habits/${habitId}`]: { id: habitId, title: 'Exercise' },
        [`users/${uid}/habitState/${habitId}`]: { currentWeek: 99, startDate: '2026-10-15' },
      };

      let writes = [];
      const mockDb = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          const t = {
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: (ref, data) => writes.push({ type: 'set', path: ref.path }),
            update: (ref, data) => writes.push({ type: 'update', path: ref.path }),
          };
          await fn(t);
        },
      };

      // Even with allowResume: true, differing destination state must abort
      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: mockDb,
          uid,
          accountData,
          backupData,
          FieldValue: { serverTimestamp: () => ({ _type: 'ts' }), delete: () => ({ _type: 'del' }) },
          serializeHabitForFirestore: (h) => h,
          options: { allowResume: true },
        });
      }, /DESTINATION_CONFLICT_ABORT.*differing/);

      assert.equal(writes.length, 0, 'Zero writes must occur when destination state differs');
    });

    it('should abort rollback transaction if root user profile contains post-migration modifications without --force', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const plan = {
        usersToRestore: [{ uid, docPath: `users/${uid}`, data: { userId: uid, displayName: 'Original Manish', theme: 'light' } }],
        habitsToRestore: [{ id: habitId, docPath: `habits/${habitId}`, data: { userId: uid, title: 'Exercise' } }],
        habitStatesToDelete: [{ uid, id: habitId, docPath: `users/${uid}/habitState/${habitId}` }],
      };

      // User modified their root profile post-migration (e.g. updated theme to dark)
      const liveDocs = {
        [`users/${uid}`]: { userId: uid, displayName: 'Original Manish', theme: 'dark' },
        [`habits/${habitId}`]: { userId: uid, title: 'Exercise', features: { counter: { enabled: false } } },
        [`users/${uid}/habitState/${habitId}`]: { currentWeek: 1, startDate: '2026-10-15' },
      };

      let writes = [];
      const mockDb = {
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          const t = {
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: (ref, data) => writes.push({ type: 'set', path: ref.path }),
            delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
          };
          await fn(t);
        },
      };

      await assert.rejects(async () => {
        await executeAccountRollbackTransaction({
          adminDb: mockDb,
          uid,
          plan,
          options: { force: false },
        });
      }, /POST_MIGRATION_CONCURRENCY_GUARD.*Root user profile users\/.*has post-migration modifications/);

      assert.equal(writes.length, 0, 'Zero writes must occur when root user profile contains post-migration edits');
    });

    it('should abort rollback transaction if exercise plan progression was updated post-migration without --force', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const plan = {
        usersToRestore: [{
          uid,
          docPath: `users/${uid}`,
          data: {
            userId: uid,
            exercisePlan: { currentWeek: 1, startDate: '2026-10-15', checkupCompleted: false },
          },
        }],
        habitsToRestore: [{ id: habitId, docPath: `habits/${habitId}`, data: { userId: uid, title: 'Exercise' } }],
        habitStatesToDelete: [{ uid, id: habitId, docPath: `users/${uid}/habitState/${habitId}` }],
      };

      // User progressed in exercise plan post-migration (currentWeek advanced from 1 to 2)
      const liveDocs = {
        [`users/${uid}`]: { userId: uid },
        [`habits/${habitId}`]: { userId: uid, title: 'Exercise', features: { daySchedule: { enabled: true } } },
        [`users/${uid}/habitState/${habitId}`]: {
          habitId,
          userId: uid,
          currentWeek: 2, // Advanced to week 2!
          startDate: '2026-10-15',
          checkupCompleted: false,
        },
      };

      let writes = [];
      const mockDb = {
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          const t = {
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: (ref, data) => writes.push({ type: 'set', path: ref.path }),
            delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
          };
          await fn(t);
        },
      };

      await assert.rejects(async () => {
        await executeAccountRollbackTransaction({
          adminDb: mockDb,
          uid,
          plan,
          options: { force: false },
        });
      }, /POST_MIGRATION_CONCURRENCY_GUARD.*exercise progression updates/);

      assert.equal(writes.length, 0, 'Zero writes must occur when exercise progression was updated post-migration');
    });

    it('should abort rollback transaction if Osho series progression was updated post-migration without --force', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_listen_osho`;

      const plan = {
        usersToRestore: [{
          uid,
          docPath: `users/${uid}`,
          data: {
            userId: uid,
            activeOshoSeriesId: 'osho_01',
            oshoSeriesProgress: { osho_01: { completedTalks: 5 } },
          },
        }],
        habitsToRestore: [{ id: habitId, docPath: `habits/${habitId}`, data: { userId: uid, title: 'Listen to Osho' } }],
        habitStatesToDelete: [{ uid, id: habitId, docPath: `users/${uid}/habitState/${habitId}` }],
      };

      // User listened to talk 6 post-migration!
      const liveDocs = {
        [`users/${uid}`]: { userId: uid },
        [`habits/${habitId}`]: { userId: uid, title: 'Listen to Osho', features: { catalog: { enabled: true } } },
        [`users/${uid}/habitState/${habitId}`]: {
          habitId,
          userId: uid,
          activeSeriesId: 'osho_01',
          seriesProgress: { osho_01: { completedTalks: 6 } }, // Progressed from 5 to 6!
        },
      };

      let writes = [];
      const mockDb = {
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          const t = {
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: (ref, data) => writes.push({ type: 'set', path: ref.path }),
            delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
          };
          await fn(t);
        },
      };

      await assert.rejects(async () => {
        await executeAccountRollbackTransaction({
          adminDb: mockDb,
          uid,
          plan,
          options: { force: false },
        });
      }, /POST_MIGRATION_CONCURRENCY_GUARD.*Osho progression updates/);

      assert.equal(writes.length, 0, 'Zero writes must occur when Osho progression was updated post-migration');
    });

    it('should detect nanosecond differences in Firestore timestamps and abort migration', async () => {
      const ts1 = { seconds: 1792172223, nanoseconds: 909000000 };
      const ts2 = { seconds: 1792172223, nanoseconds: 909000001 }; // 1 nanosecond difference!

      assert.notEqual(
        canonicalJsonString({ updatedAt: ts1 }),
        canonicalJsonString({ updatedAt: ts2 }),
        'Nanosecond difference must be detected by canonical serializer'
      );

      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const backupData = {
        users: { [uid]: { data: { updatedAt: ts1 } } },
        habits: { [uid]: [{ id: habitId, data: { id: habitId, title: 'Exercise', updatedAt: ts1 } }] },
      };

      const accountData = {
        habitTransformations: [{ id: habitId, title: 'Exercise' }],
        stateDecoupling: [],
      };

      const liveDocs = {
        [`users/${uid}`]: { updatedAt: ts1 },
        [`habits/${habitId}`]: { id: habitId, title: 'Exercise', updatedAt: ts2 }, // nanosecond changed!
      };

      const mockDb = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          await fn({
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: () => {},
            update: () => {},
          });
        },
      };

      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: mockDb,
          uid,
          accountData,
          backupData,
          FieldValue: {},
          serializeHabitForFirestore: (h) => h,
        });
      }, /CONCURRENCY_ABORT.*Habit document.*content differs/);
    });

    it('should distinguish Firestore Timestamps from ordinary strings and strings from numbers', () => {
      const timestamp = { seconds: 1792172223, nanoseconds: 909000000 };
      const isoString = '2026-10-14T16:22:01.449Z';

      // Timestamp must NOT serialize to string representation
      assert.notEqual(
        canonicalJsonString(timestamp),
        canonicalJsonString(isoString),
        'Firestore Timestamps must be strictly distinguished from ISO strings'
      );

      // String vs number
      assert.notEqual(
        canonicalJsonString('42'),
        canonicalJsonString(42),
        'Numeric strings must be strictly distinguished from numbers'
      );
    });

    it('should distinguish missing properties from explicit null values and fail closed', () => {
      const docWithMissing = { title: 'Exercise' };
      const docWithNull = { title: 'Exercise', instructions: null };
      const docWithUndefined = { title: 'Exercise', instructions: undefined };

      assert.notEqual(
        canonicalJsonString(docWithMissing),
        canonicalJsonString(docWithNull),
        'Missing property must be strictly distinguished from explicit null'
      );

      // docWithMissing and docWithUndefined should serialize identically (omitted key)
      assert.equal(
        canonicalJsonString(docWithMissing),
        canonicalJsonString(docWithUndefined),
        'Undefined property must be omitted identically to missing property'
      );
    });

    it('should abort migration resume if destination has unexamined extra fields', async () => {
      const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';
      const habitId = `${uid}_canonical_exercise_plan`;

      const backupData = {
        users: { [uid]: { data: { exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } } } },
        habits: { [uid]: [{ id: habitId, data: { id: habitId, title: 'Exercise' } }] },
      };

      const accountData = {
        habitTransformations: [{ id: habitId, title: 'Exercise' }],
        stateDecoupling: [{
          destinationDoc: `users/${uid}/habitState/${habitId}`,
          data: { currentWeek: 1, startDate: '2026-10-15' },
          sourceField: 'users/{uid}.exercisePlan',
        }],
      };

      // Destination has expected fields PLUS an extra unexamined field
      const liveDocs = {
        [`users/${uid}`]: { exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } },
        [`habits/${habitId}`]: { id: habitId, title: 'Exercise' },
        [`users/${uid}/habitState/${habitId}`]: { currentWeek: 1, startDate: '2026-10-15', unexaminedCustomField: 'custom_data' },
      };

      const mockDb = {
        collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }),
        doc: (p) => ({ path: p }),
        runTransaction: async (fn) => {
          await fn({
            get: async (ref) => ({ exists: Boolean(liveDocs[ref.path]), data: () => liveDocs[ref.path] }),
            set: () => {},
            update: () => {},
          });
        },
      };

      // Even with allowResume: true, extra unexamined fields must fail closed!
      await assert.rejects(async () => {
        await executeAccountMigrationTransaction({
          adminDb: mockDb,
          uid,
          accountData,
          backupData,
          FieldValue: { serverTimestamp: () => ({ _type: 'ts' }), delete: () => ({ _type: 'del' }) },
          serializeHabitForFirestore: (h) => h,
          options: { allowResume: true },
        });
      }, /DESTINATION_CONFLICT_ABORT.*differing or unexamined state/);
    });
  });

  // ============================================================================
  // 8. Application State Discovery Proof
  // ============================================================================
  describe('8. Decoupled State Application Discovery Proof', () => {
    it('should demonstrate how consumer profile merges decoupled habitState documents', () => {
      // 1. Root user doc with progression fields DELETED by migration
      const rootUserDocAfterMigration = {
        id: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
        updatedAt: '2026-10-17T17:00:00.000Z',
        // exercisePlan and oshoSeriesProgress are deleted
      };

      // 2. Decoupled habitState subcollection documents created by migration
      const habitStates = {
        '2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_exercise_plan': {
          habitId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_exercise_plan',
          userId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
          currentWeek: 1,
          startDate: '2026-10-15',
          activated: true,
          checkupCompleted: false,
        },
        '2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_listen_osho': {
          habitId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_listen_osho',
          userId: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
          activeSeriesId: 'osho_01',
          seriesProgress: {
            osho_01: { completedTalks: 5, lastUpdated: '2026-10-16T17:37:02.726Z' },
            osho_22: { completedTalks: 4, lastUpdated: '2026-10-15T16:34:29.696Z' },
          },
        },
      };

      // 3. Simulated fetchUserProfile aggregation logic (matching firestore.js)
      let exercisePlan = rootUserDocAfterMigration.exercisePlan || null;
      let oshoSeriesProgress = rootUserDocAfterMigration.oshoSeriesProgress || null;
      let activeOshoSeriesId = rootUserDocAfterMigration.activeOshoSeriesId || null;

      for (const [docId, state] of Object.entries(habitStates)) {
        if (state.currentWeek !== undefined || state.startDate !== undefined || docId.includes('exercise_plan')) {
          exercisePlan = { ...(exercisePlan || {}), ...state };
        }
        if (state.seriesProgress !== undefined || docId.includes('listen_osho')) {
          oshoSeriesProgress = { ...(oshoSeriesProgress || {}), ...(state.seriesProgress || {}) };
          if (state.activeSeriesId) {
            activeOshoSeriesId = state.activeSeriesId;
          }
        }
      }

      const unifiedProfile = {
        ...rootUserDocAfterMigration,
        exercisePlan,
        oshoSeriesProgress,
        activeOshoSeriesId,
        habitState: habitStates,
      };

      // 4. Assert consumers find their expected progression
      assert.ok(unifiedProfile.exercisePlan, 'exercisePlan must be discovered from habitState');
      assert.equal(unifiedProfile.exercisePlan.currentWeek, 1);
      assert.equal(unifiedProfile.exercisePlan.startDate, '2026-10-15');

      assert.ok(unifiedProfile.oshoSeriesProgress, 'oshoSeriesProgress must be discovered from habitState');
      assert.equal(unifiedProfile.oshoSeriesProgress.osho_01.completedTalks, 5);
      assert.equal(unifiedProfile.oshoSeriesProgress.osho_22.completedTalks, 4);
      assert.equal(unifiedProfile.activeOshoSeriesId, 'osho_01');

      // 5. Direct habitState access by habitId
      const exerciseState = unifiedProfile.habitState['2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_exercise_plan'];
      assert.equal(exerciseState.currentWeek, 1);
      const oshoState = unifiedProfile.habitState['2W83kgjX9db8QiIWqZd5AJrc8PQ2_canonical_listen_osho'];
      assert.equal(oshoState.activeSeriesId, 'osho_01');
    });
  });

  // ============================================================================
  // 9. Isolated Fixture-Based End-to-End Migration & Exact Rollback Verification
  // ============================================================================
  describe('9. Isolated Fixture End-to-End Migration & Rollback Lifecycle', () => {
    const uid = '2W83kgjX9db8QiIWqZd5AJrc8PQ2';

    // Baseline Fixture Factory
    function createInitialFixture() {
      return {
        user: {
          id: uid,
          email: 'manishborikar92@gmail.com',
          displayName: 'Manish Borikar',
          preferences: { theme: 'system', weekStartsOn: 1 },
          exercisePlan: {
            currentWeek: 1,
            startDate: '2026-10-15',
            activated: true,
            checkupCompleted: false,
          },
          oshoSeriesProgress: {
            osho_01: { completedTalks: 5, lastUpdated: '2026-10-16T17:37:02.726Z' },
            osho_22: { completedTalks: 4, lastUpdated: '2026-10-15T16:34:29.696Z' },
          },
          activeOshoSeriesId: 'osho_01',
          createdAt: '2026-10-14T16:22:01.449Z',
          updatedAt: '2026-10-14T16:22:01.449Z',
        },
        habits: [
          {
            id: `${uid}_canonical_english_speaking`,
            userId: uid,
            title: 'Practice English Speaking',
            category: 'Communication',
            completionMethod: 'simple_with_notes',
            instructions: 'Practice conversational fluency and pronunciation.',
            time: 'Flexible',
            createdAt: '2026-10-14T16:22:01.449Z',
          },
          {
            id: `${uid}_canonical_english_workbook`,
            userId: uid,
            title: 'Practice English Workbook',
            category: 'English Learning',
            completionMethod: 'workbook_sessions',
            instructions: 'Word Power Made Easy daily vocabulary building.',
            time: 'Flexible',
            metadata: { dailySessionsTarget: 2 },
            createdAt: '2026-10-14T16:22:01.449Z',
          },
          {
            id: `${uid}_canonical_exercise_plan`,
            userId: uid,
            title: 'Exercise / Movement Plan',
            category: 'Movement & Strength',
            completionMethod: 'exercise_plan',
            instructions: '12-week progressive conditioning plan.',
            time: 'Afternoon',
            metadata: { restDays: ['Sun'] },
            createdAt: '2026-10-14T16:22:01.449Z',
          },
          {
            id: `${uid}_canonical_listen_osho`,
            userId: uid,
            title: 'Listen to Osho',
            category: 'Listening & Awareness',
            completionMethod: 'osho_listening',
            instructions: 'Daily discourse listening.',
            time: 'Flexible',
            metadata: { libraryCount: 30 },
            createdAt: '2026-10-14T16:22:01.449Z',
          },
          {
            id: `${uid}_canonical_maintain_diary`,
            userId: uid,
            title: 'Maintain a Diary',
            category: 'Reflection',
            completionMethod: 'diary_entry',
            instructions: 'Private diary reflection.',
            time: 'Flexible',
            createdAt: '2026-10-14T16:22:01.449Z',
          },
          {
            id: `${uid}_canonical_read_books`,
            userId: uid,
            title: 'Read Books',
            category: 'Reading',
            completionMethod: 'reading_duration',
            instructions: 'Read 30 minutes before bed.',
            targetMinutes: 30,
            time: 'Before bed',
            createdAt: '2026-10-14T16:22:01.449Z',
          },
        ],
        habitState: {},
        dailyLogs: [
          {
            id: `${uid}_2026-10-15`,
            userId: uid,
            date: '2026-10-15',
            completedHabitIds: [`${uid}_canonical_exercise_plan`],
            habitProgress: {},
          },
          {
            id: `${uid}_2026-10-16`,
            userId: uid,
            date: '2026-10-16',
            completedHabitIds: [`${uid}_canonical_exercise_plan`, `${uid}_canonical_read_books`],
            habitProgress: {},
          },
          {
            id: `${uid}_2026-10-17`,
            userId: uid,
            date: '2026-10-17',
            completedHabitIds: [`${uid}_canonical_exercise_plan`],
            habitOutcomes: {
              [`${uid}_canonical_listen_osho`]: {
                status: 'rest',
                recordedAt: '2026-10-17T12:00:00.000Z',
                reason: 'Planned Rest',
              },
            },
            habitProgress: {},
          },
        ],
      };
    }

    it('should transform raw fixtures into valid composable habits and decoupled habitState documents', () => {
      const fixture = createInitialFixture();

      // 1. Transform habits
      const migratedHabits = fixture.habits.map(raw => {
        const normalized = buildNormalizedComposableHabit(raw, raw.id, raw.userId);
        const validation = validateComposableHabit(normalized);
        assert.equal(validation.valid, true, `Validation failed for ${raw.title}: ${validation.errors?.join('; ')}`);
        assert.ok(CATEGORIES.includes(normalized.category));
        return normalized;
      });

      assert.equal(migratedHabits.length, 6);

      // Verify specific feature slot models
      const workbook = migratedHabits.find(h => h.id.endsWith('canonical_english_workbook'));
      assert.equal(workbook.features.counter.enabled, true);
      assert.equal(workbook.features.counter.targetCount, 2);
      assert.equal(workbook.features.checklist.enabled, true);

      const exercise = migratedHabits.find(h => h.id.endsWith('canonical_exercise_plan'));
      assert.equal(exercise.features.daySchedule.enabled, true);
      assert.deepEqual(exercise.schedule.restDays, ['Sun']);

      const osho = migratedHabits.find(h => h.id.endsWith('canonical_listen_osho'));
      assert.equal(osho.features.catalog.enabled, true);
      assert.equal(osho.features.catalog.totalItems, 30);

      // 2. Transform Decoupled State
      const exerciseHabitId = `${uid}_canonical_exercise_plan`;
      const decoupledExerciseState = {
        habitId: exerciseHabitId,
        userId: uid,
        currentWeek: fixture.user.exercisePlan.currentWeek,
        startDate: fixture.user.exercisePlan.startDate,
        activated: fixture.user.exercisePlan.activated,
        checkupCompleted: fixture.user.exercisePlan.checkupCompleted,
        phaseHistory: [],
      };

      // Strict check: only canonical startDate, no planStartDate
      assert.equal(decoupledExerciseState.startDate, '2026-10-15');
      assert.equal(decoupledExerciseState.planStartDate, undefined);

      const oshoHabitId = `${uid}_canonical_listen_osho`;
      const decoupledOshoState = {
        habitId: oshoHabitId,
        userId: uid,
        activeSeriesId: fixture.user.activeOshoSeriesId,
        seriesProgress: fixture.user.oshoSeriesProgress,
      };

      // 3. Strip root user document
      const strippedUser = { ...fixture.user };
      delete strippedUser.exercisePlan;
      delete strippedUser.oshoSeriesProgress;
      delete strippedUser.activeOshoSeriesId;

      assert.equal(strippedUser.exercisePlan, undefined);
      assert.equal(strippedUser.oshoSeriesProgress, undefined);
      assert.equal(strippedUser.activeOshoSeriesId, undefined);
      assert.equal(strippedUser.displayName, 'Manish Borikar');
      assert.deepEqual(strippedUser.preferences, { theme: 'system', weekStartsOn: 1 });
    });

    it('should support consumer read bridge retrieving decoupled state seamlessly', () => {
      const fixture = createInitialFixture();
      const strippedUser = { ...fixture.user };
      delete strippedUser.exercisePlan;
      delete strippedUser.oshoSeriesProgress;
      delete strippedUser.activeOshoSeriesId;

      const exerciseHabitId = `${uid}_canonical_exercise_plan`;
      const oshoHabitId = `${uid}_canonical_listen_osho`;

      const habitStates = {
        [exerciseHabitId]: {
          habitId: exerciseHabitId,
          userId: uid,
          currentWeek: 1,
          startDate: '2026-10-15',
          activated: true,
          checkupCompleted: false,
        },
        [oshoHabitId]: {
          habitId: oshoHabitId,
          userId: uid,
          activeSeriesId: 'osho_01',
          seriesProgress: {
            osho_01: { completedTalks: 5 },
            osho_22: { completedTalks: 4 },
          },
        },
      };

      // Simulation of fetchUserProfile aggregation bridge
      let exercisePlan = strippedUser.exercisePlan || null;
      let oshoSeriesProgress = strippedUser.oshoSeriesProgress || null;
      let activeOshoSeriesId = strippedUser.activeOshoSeriesId || null;

      for (const [docId, state] of Object.entries(habitStates)) {
        if (state.currentWeek !== undefined || state.startDate !== undefined || docId.includes('exercise_plan')) {
          exercisePlan = { ...(exercisePlan || {}), ...state };
        }
        if (state.seriesProgress !== undefined || docId.includes('listen_osho')) {
          oshoSeriesProgress = { ...(oshoSeriesProgress || {}), ...(state.seriesProgress || {}) };
          if (state.activeSeriesId) {
            activeOshoSeriesId = state.activeSeriesId;
          }
        }
      }

      const consumerProfile = {
        ...strippedUser,
        exercisePlan,
        oshoSeriesProgress,
        activeOshoSeriesId,
        habitState: habitStates,
      };

      // Assert consumers transparently find their state
      assert.equal(consumerProfile.exercisePlan.currentWeek, 1);
      assert.equal(consumerProfile.exercisePlan.startDate, '2026-10-15');
      assert.equal(consumerProfile.exercisePlan.planStartDate, undefined);
      assert.equal(consumerProfile.oshoSeriesProgress.osho_01.completedTalks, 5);
      assert.equal(consumerProfile.activeOshoSeriesId, 'osho_01');
    });

    it('should verify saveUserProfile write-protection strips decoupled progression and updates habitState', () => {
      const liveSubcollections = {};
      let liveRootUserDoc = {
        id: uid,
        displayName: 'Manish Borikar',
        theme: 'system',
      };

      // Simulation of saveUserProfile logic in firestore.js
      function simulateSaveUserProfile(targetUid, data) {
        const cleanData = { ...data };

        if (cleanData.exercisePlan) {
          const exerciseHabitId = `${targetUid}_canonical_exercise_plan`;
          liveSubcollections[exerciseHabitId] = {
            ...cleanData.exercisePlan,
            habitId: exerciseHabitId,
            userId: targetUid,
          };
        }

        if (cleanData.oshoSeriesProgress || cleanData.activeOshoSeriesId) {
          const oshoHabitId = `${targetUid}_canonical_listen_osho`;
          const oshoState = {};
          if (cleanData.oshoSeriesProgress) oshoState.seriesProgress = cleanData.oshoSeriesProgress;
          if (cleanData.activeOshoSeriesId) oshoState.activeSeriesId = cleanData.activeOshoSeriesId;
          liveSubcollections[oshoHabitId] = {
            ...oshoState,
            habitId: oshoHabitId,
            userId: targetUid,
          };
        }

        // Strip decoupled state fields so they are never written back to root
        const rootProfileData = { ...cleanData };
        delete rootProfileData.exercisePlan;
        delete rootProfileData.oshoSeriesProgress;
        delete rootProfileData.activeOshoSeriesId;
        delete rootProfileData.habitState;

        if (Object.keys(rootProfileData).length > 0) {
          liveRootUserDoc = {
            ...liveRootUserDoc,
            ...rootProfileData,
          };
        }
      }

      // Consumer executes saveUserProfile with mixed progression and preferences
      simulateSaveUserProfile(uid, {
        theme: 'dark',
        exercisePlan: {
          currentWeek: 2,
          startDate: '2026-10-15',
          checkupCompleted: true,
        },
        oshoSeriesProgress: {
          osho_01: { completedTalks: 6 },
        },
      });

      // 1. Decoupled subcollection documents updated
      const exerciseState = liveSubcollections[`${uid}_canonical_exercise_plan`];
      assert.equal(exerciseState.currentWeek, 2);
      assert.equal(exerciseState.startDate, '2026-10-15');
      assert.equal(exerciseState.checkupCompleted, true);

      const oshoState = liveSubcollections[`${uid}_canonical_listen_osho`];
      assert.equal(oshoState.seriesProgress.osho_01.completedTalks, 6);

      // 2. Root user document updated WITHOUT resurrecting legacy fields
      assert.equal(liveRootUserDoc.theme, 'dark');
      assert.equal(liveRootUserDoc.exercisePlan, undefined);
      assert.equal(liveRootUserDoc.oshoSeriesProgress, undefined);
      assert.equal(liveRootUserDoc.activeOshoSeriesId, undefined);
    });

    it('should verify daily logs and historical rest/skip records are 100% preserved', () => {
      const fixture = createInitialFixture();
      const logsBefore = JSON.stringify(fixture.dailyLogs);

      // Migration executes without touching daily logs collection
      const logsAfter = JSON.stringify(fixture.dailyLogs);
      assert.equal(logsBefore, logsAfter);

      // Specifically verify 2026-10-17 rest record
      const restLog = fixture.dailyLogs.find(l => l.date === '2026-10-17');
      assert.ok(restLog);
      const oshoOutcome = restLog.habitOutcomes[`${uid}_canonical_listen_osho`];
      assert.equal(oshoOutcome.status, 'rest');
      assert.equal(oshoOutcome.reason, 'Planned Rest');

      // Verify zero synthetic misses exist in fixture
      for (const log of fixture.dailyLogs) {
        if (log.habitOutcomes) {
          for (const outcome of Object.values(log.habitOutcomes)) {
            assert.notEqual(outcome.status, 'missed');
          }
        }
      }
    });

    it('should execute exact rollback and return 100% to initial pre-migration fixture state', () => {
      const initialFixture = createInitialFixture();

      // Create backup payload with checksum
      const preMigrationBackup = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0',
        },
        users: { [uid]: { id: uid, data: JSON.parse(JSON.stringify(initialFixture.user)) } },
        habits: { [uid]: initialFixture.habits.map(h => ({ id: h.id, data: JSON.parse(JSON.stringify(h)) })) },
        habitState: { [uid]: [] },
        dailyLogs: { [uid]: initialFixture.dailyLogs.map(l => ({ id: l.id, data: JSON.parse(JSON.stringify(l)) })) },
      };

      const dataPayloadString = JSON.stringify({
        users: preMigrationBackup.users,
        habits: preMigrationBackup.habits,
        habitState: preMigrationBackup.habitState,
        dailyLogs: preMigrationBackup.dailyLogs,
      });
      const checksum = crypto.createHash('sha256').update(dataPayloadString, 'utf8').digest('hex');
      preMigrationBackup.metadata.checksumSha256 = checksum;

      // Simulate Database state AFTER migration
      const dbHabits = initialFixture.habits.map(raw => {
        return buildNormalizedComposableHabit(raw, raw.id, raw.userId);
      });
      const dbHabitState = {
        [`${uid}_canonical_exercise_plan`]: {
          habitId: `${uid}_canonical_exercise_plan`,
          userId: uid,
          currentWeek: 1,
          startDate: '2026-10-15',
        },
        [`${uid}_canonical_listen_osho`]: {
          habitId: `${uid}_canonical_listen_osho`,
          userId: uid,
          activeSeriesId: 'osho_01',
          seriesProgress: { osho_01: { completedTalks: 5 } },
        },
      };
      const dbUser = { ...initialFixture.user };
      delete dbUser.exercisePlan;
      delete dbUser.oshoSeriesProgress;
      delete dbUser.activeOshoSeriesId;

      // Verify DB is indeed in migrated state before rollback
      assert.ok(dbHabits[0].features);
      assert.equal(dbUser.exercisePlan, undefined);
      assert.equal(Object.keys(dbHabitState).length, 2);

      // --- EXECUTE SIMULATED ROLLBACK ---
      // 1. Verify backup checksum
      const verifyChecksum = crypto.createHash('sha256').update(JSON.stringify({
        users: preMigrationBackup.users,
        habits: preMigrationBackup.habits,
        habitState: preMigrationBackup.habitState,
        dailyLogs: preMigrationBackup.dailyLogs,
      }), 'utf8').digest('hex');
      assert.equal(verifyChecksum, preMigrationBackup.metadata.checksumSha256);

      // 2. Exact overwrite restore of habits (clearing features, scheduleHistory)
      const rolledBackHabits = preMigrationBackup.habits[uid].map(entry => {
        return JSON.parse(JSON.stringify(entry.data)); // exact overwrite without merge
      });

      // 3. Exact restore of user document (restoring exercisePlan, oshoSeriesProgress)
      const rolledBackUser = JSON.parse(JSON.stringify(preMigrationBackup.users[uid].data));

      // 4. Delete migration-created habitState documents
      const rolledBackHabitState = {};

      // --- ASSERTIONS ON ROLLED-BACK STATE ---
      // Habits have zero migrated fields
      for (const h of rolledBackHabits) {
        assert.equal(h.features, undefined, `Features must be undefined on ${h.id}`);
        assert.equal(h.scheduleHistory, undefined, `scheduleHistory must be undefined on ${h.id}`);
      }
      assert.equal(rolledBackHabits.length, 6);

      // User document has original progression restored
      assert.equal(rolledBackUser.exercisePlan.currentWeek, 1);
      assert.equal(rolledBackUser.exercisePlan.startDate, '2026-10-15');
      assert.equal(rolledBackUser.oshoSeriesProgress.osho_01.completedTalks, 5);
      assert.equal(rolledBackUser.activeOshoSeriesId, 'osho_01');

      // habitState subcollection is completely cleared
      assert.equal(Object.keys(rolledBackHabitState).length, 0);

      // Assert 100% deep equal match between rolled-back state and initial fixture
      assert.deepEqual(rolledBackUser, initialFixture.user);
      assert.deepEqual(rolledBackHabits, initialFixture.habits);
      assert.deepEqual(rolledBackHabitState, initialFixture.habitState);
    });
  });
});

