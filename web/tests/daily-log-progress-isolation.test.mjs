import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

describe('Daily Log Progress Isolation & Regression Tests', () => {

  describe('1. Static Code Analysis & Contract Enforcement', () => {
    it('should verify firestore.js never writes empty habitProgress: {} in toggleHabitCompletion', () => {
      const filePath = path.join(webRoot, 'src', 'lib', 'firebase', 'firestore.js');
      const content = fs.readFileSync(filePath, 'utf8');

      // Locate toggleHabitCompletion function body
      const fnMatch = content.match(/export\s+async\s+function\s+toggleHabitCompletion[\s\S]*?^}/m);
      assert.ok(fnMatch, 'toggleHabitCompletion function must exist in firestore.js');
      const fnBody = fnMatch[0];

      // Verify destructive payload is absent
      assert.ok(
        !fnBody.includes('habitProgress: {}'),
        'toggleHabitCompletion must NEVER write destructive habitProgress: {}'
      );

      // Verify currentLogLength parameter and branch are completely eliminated
      assert.ok(
        !fnBody.includes('currentLogLength'),
        'toggleHabitCompletion must not depend on currentLogLength'
      );
    });

    it('should verify useDailyLogs.js calls toggleHabitCompletion without currentLogLength', () => {
      const filePath = path.join(webRoot, 'src', 'hooks', 'useDailyLogs.js');
      const content = fs.readFileSync(filePath, 'utf8');

      // Verify toggleHabitCompletion call does not pass todayLog.length
      assert.ok(
        !content.includes('toggleHabitCompletion(user.uid, today, habitId, isCompleted, todayLog.length)'),
        'useDailyLogs.js must not pass todayLog.length to toggleHabitCompletion'
      );

      // Verify toggleHabit uses functional updater
      assert.ok(
        content.includes('setTodayLog(prev =>'),
        'useDailyLogs.js toggleHabit must use functional state updates'
      );
    });
  });

  describe('2. Pure State Mutation & Isolation Evaluator', () => {
    /**
     * Simulates Firestore's recursive merge behavior and useDailyLogs state transitions.
     */
    function simulateDailyLogStore() {
      let state = {
        completedHabitIds: [],
        habitProgress: {},
      };

      return {
        getState: () => JSON.parse(JSON.stringify(state)),

        // Simulates updateDailyHabitProgress
        updateProgress: (habitId, progressData, isFullyCompleted) => {
          state.habitProgress[habitId] = {
            ...(state.habitProgress[habitId] || {}),
            ...progressData,
            updatedAt: '2026-10-15T00:00:00.000Z',
          };

          if (typeof isFullyCompleted === 'boolean') {
            if (isFullyCompleted && !state.completedHabitIds.includes(habitId)) {
              state.completedHabitIds.push(habitId);
            } else if (!isFullyCompleted) {
              state.completedHabitIds = state.completedHabitIds.filter(id => id !== habitId);
            }
          }
        },

        // Simulates FIXED toggleHabitCompletion
        toggleHabit: (habitId) => {
          const isCurrentlyCompleted = state.completedHabitIds.includes(habitId);
          if (isCurrentlyCompleted) {
            state.completedHabitIds = state.completedHabitIds.filter(id => id !== habitId);
          } else {
            state.completedHabitIds.push(habitId);
          }
          // Note: habitProgress is untouched!
        },

        // Simulates the BUGGY toggleHabitCompletion (for regression contrast)
        buggyToggleHabit: (habitId) => {
          const isCurrentlyCompleted = state.completedHabitIds.includes(habitId);
          const currentLogLength = state.completedHabitIds.length;
          if (currentLogLength === 0 && !isCurrentlyCompleted) {
            state.completedHabitIds = [habitId];
            state.habitProgress = {}; // Buggy wipe
          } else if (isCurrentlyCompleted) {
            state.completedHabitIds = state.completedHabitIds.filter(id => id !== habitId);
          } else {
            state.completedHabitIds.push(habitId);
          }
        },
      };
    }

    it('should verify the original reproduction sequence preserves Workbook progress', () => {
      const store = simulateDailyLogStore();

      const workbookId = 'canonical_english_workbook';
      const oshoId = 'canonical_listen_osho';

      // 1. Mark Workbook 1 session complete (partial progress, not fully complete)
      store.updateProgress(workbookId, { sessionsCompleted: 1, reviewDone: false }, false);

      let currentState = store.getState();
      assert.deepEqual(currentState.completedHabitIds, []);
      assert.equal(currentState.habitProgress[workbookId].sessionsCompleted, 1);
      assert.equal(currentState.habitProgress[workbookId].reviewDone, false);

      // 2. Mark Listen to Osho complete when completed list is empty
      store.toggleHabit(oshoId);

      currentState = store.getState();
      // Osho must be complete
      assert.deepEqual(currentState.completedHabitIds, [oshoId]);
      // Workbook progress must NOT be reset
      assert.ok(currentState.habitProgress[workbookId], 'Workbook progress must exist');
      assert.equal(currentState.habitProgress[workbookId].sessionsCompleted, 1, 'Workbook must retain 1 session');
      assert.equal(currentState.habitProgress[workbookId].reviewDone, false);
    });

    it('should contrast with buggy implementation to prove regression test catches the bug', () => {
      const store = simulateDailyLogStore();

      const workbookId = 'canonical_english_workbook';
      const oshoId = 'canonical_listen_osho';

      // 1. Mark Workbook 1 session complete
      store.updateProgress(workbookId, { sessionsCompleted: 1, reviewDone: false }, false);

      // 2. Run the BUGGY toggle
      store.buggyToggleHabit(oshoId);

      const currentState = store.getState();
      // In buggy version, habitProgress is wiped clean
      assert.deepEqual(currentState.habitProgress, {}, 'Buggy version wipes habitProgress');
    });

    it('should preserve progress across multiple diverse habits concurrently', () => {
      const store = simulateDailyLogStore();

      const workbookId = 'canonical_english_workbook';
      const movementId = 'canonical_exercise_plan';
      const diaryId = 'canonical_maintain_diary';
      const speakingId = 'canonical_english_speaking';
      const readingId = 'canonical_read_books';
      const oshoId = 'canonical_listen_osho';

      // Set up granular progress across multiple routines
      store.updateProgress(workbookId, { sessionsCompleted: 1, reviewDone: true }, false);
      store.updateProgress(movementId, { completedItemIds: ['ex_1', 'ex_2'], workoutCompleted: false }, false);
      store.updateProgress(diaryId, { entryText: 'Contemplative morning reflection' }, true);
      store.updateProgress(speakingId, { notes: 'Practiced fluent introductions with ChatGPT' }, false);
      store.updateProgress(readingId, { secondsRemaining: 900, timerActive: false }, false);

      let state = store.getState();
      assert.deepEqual(state.completedHabitIds, [diaryId]); // Only diary marked complete so far
      assert.equal(state.habitProgress[workbookId].sessionsCompleted, 1);
      assert.equal(state.habitProgress[movementId].completedItemIds.length, 2);
      assert.equal(state.habitProgress[diaryId].entryText, 'Contemplative morning reflection');
      assert.equal(state.habitProgress[speakingId].notes, 'Practiced fluent introductions with ChatGPT');
      assert.equal(state.habitProgress[readingId].secondsRemaining, 900);

      // Toggle Osho habit
      store.toggleHabit(oshoId);

      state = store.getState();
      assert.deepEqual(state.completedHabitIds.sort(), [diaryId, oshoId].sort());

      // Verify every single habit's granular progress is intact
      assert.equal(state.habitProgress[workbookId].sessionsCompleted, 1);
      assert.equal(state.habitProgress[workbookId].reviewDone, true);
      assert.equal(state.habitProgress[movementId].completedItemIds.length, 2);
      assert.equal(state.habitProgress[diaryId].entryText, 'Contemplative morning reflection');
      assert.equal(state.habitProgress[speakingId].notes, 'Practiced fluent introductions with ChatGPT');
      assert.equal(state.habitProgress[readingId].secondsRemaining, 900);
    });

    it('should handle repeated toggles and unchecking back to zero without data loss', () => {
      const store = simulateDailyLogStore();

      const workbookId = 'canonical_english_workbook';
      const oshoId = 'canonical_listen_osho';

      // 1. Workbook in progress
      store.updateProgress(workbookId, { sessionsCompleted: 1, reviewDone: false }, false);

      // 2. Toggle Osho on
      store.toggleHabit(oshoId);
      assert.deepEqual(store.getState().completedHabitIds, [oshoId]);
      assert.equal(store.getState().habitProgress[workbookId].sessionsCompleted, 1);

      // 3. Toggle Osho off (completed list drops back to 0)
      store.toggleHabit(oshoId);
      assert.deepEqual(store.getState().completedHabitIds, []);
      assert.equal(store.getState().habitProgress[workbookId].sessionsCompleted, 1);

      // 4. Toggle Osho back on (first toggle after zero)
      store.toggleHabit(oshoId);
      assert.deepEqual(store.getState().completedHabitIds, [oshoId]);
      assert.equal(store.getState().habitProgress[workbookId].sessionsCompleted, 1, 'Workbook must survive toggling back from zero');
    });

    it('should complete workbook fully and preserve independent Osho completion', () => {
      const store = simulateDailyLogStore();

      const workbookId = 'canonical_english_workbook';
      const oshoId = 'canonical_listen_osho';

      // 1. Osho completed first
      store.toggleHabit(oshoId);
      assert.deepEqual(store.getState().completedHabitIds, [oshoId]);

      // 2. Workbook session 1
      store.updateProgress(workbookId, { sessionsCompleted: 1, reviewDone: false }, false);
      assert.deepEqual(store.getState().completedHabitIds, [oshoId]);

      // 3. Workbook session 2 with review fulfilled -> fully completed
      store.updateProgress(workbookId, { sessionsCompleted: 2, reviewDone: true }, true);
      const state = store.getState();
      assert.deepEqual(state.completedHabitIds.sort(), [workbookId, oshoId].sort());
      assert.equal(state.habitProgress[workbookId].sessionsCompleted, 2);
      assert.equal(state.habitProgress[workbookId].reviewDone, true);
    });
  });

  describe('3. Live Firestore Backend Integration & Mutation Verification', () => {
    let db = null;
    let FieldValue = null;
    const testDocId = `test_integration_reg_user_${Date.now()}_2026-10-15`;
    let testDocRef = null;

    before(async () => {
      // Safety guard: only execute live cloud mutations if explicitly opted-in
      if (process.env.RUN_LIVE_FIRESTORE_TESTS !== 'true') {
        return;
      }
      const credPath = 'C:/Users/manis/.credentials/vritta-app-firebase-adminsdk.json';
      if (fs.existsSync(credPath)) {
        const { createRequire } = await import('node:module');
        const req = createRequire(import.meta.url);
        const { initializeApp, cert, getApps } = req('firebase-admin/app');
        const firestoreModule = req('firebase-admin/firestore');
        if (getApps().length === 0) {
          initializeApp({ credential: cert(JSON.parse(fs.readFileSync(credPath, 'utf8'))) });
        }
        db = firestoreModule.getFirestore();
        FieldValue = firestoreModule.FieldValue;
        testDocRef = db.collection('dailyLogs').doc(testDocId);
      }
    });

    after(async () => {
      if (testDocRef) {
        try {
          await testDocRef.delete();
        } catch (_) {}
      }
    });

    it('should verify live Firestore setDoc with merge: true preserves habitProgress when toggling completion', async (t) => {
      if (!db || !testDocRef) {
        t.skip('Live Firestore backend tests skipped by default. Set RUN_LIVE_FIRESTORE_TESTS=true to run against live cloud instance.');
        return;
      }

      const workbookId = 'canonical_english_workbook';
      const oshoId = 'canonical_listen_osho';

      // 1. Initialize clean document with 0 completions and empty progress
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        completedHabitIds: [],
        habitProgress: {},
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2. User completes 1 session of Workbook (updateDailyHabitProgress equivalent)
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        habitProgress: {
          [workbookId]: {
            sessionsCompleted: 1,
            reviewDone: false,
            uninterruptedDone: false,
            updatedAt: new Date().toISOString(),
          },
        },
        completedHabitIds: FieldValue.arrayRemove(workbookId),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      let snap = await testDocRef.get();
      let data = snap.data();
      assert.deepEqual(data.completedHabitIds, []);
      assert.equal(data.habitProgress[workbookId].sessionsCompleted, 1);

      // 3. User toggles Osho complete (toggleHabitCompletion equivalent - FIXED payload)
      // Note: habitProgress is omitted from the payload so merge: true leaves it intact
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        completedHabitIds: FieldValue.arrayUnion(oshoId),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      snap = await testDocRef.get();
      data = snap.data();

      // Assertions on actual Firestore document
      assert.ok(data.completedHabitIds.includes(oshoId), 'Osho must be present in completedHabitIds');
      assert.ok(data.habitProgress[workbookId], 'Workbook entry must exist in habitProgress');
      assert.equal(data.habitProgress[workbookId].sessionsCompleted, 1, 'Workbook must retain 1 session in Firestore');
    });

    it('should contrast against buggy payload to prove that writing habitProgress: {} wipes Firestore data', async (t) => {
      if (!db || !testDocRef) {
        t.skip('Live Firestore backend tests skipped by default. Set RUN_LIVE_FIRESTORE_TESTS=true to run against live cloud instance.');
        return;
      }

      const workbookId = 'canonical_english_workbook';
      const oshoId = 'canonical_listen_osho';

      // Set up workbook at 1 session
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        habitProgress: {
          [workbookId]: {
            sessionsCompleted: 1,
            reviewDone: false,
            updatedAt: new Date().toISOString(),
          },
        },
        completedHabitIds: [],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Run BUGGY write
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        completedHabitIds: [oshoId],
        habitProgress: {}, // The regression wipe
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const snap = await testDocRef.get();
      const data = snap.data();
      assert.deepEqual(data.habitProgress, {}, 'Buggy payload wipes habitProgress to empty object');
    });

    it('should verify live Firestore retains multiple activities across repeated toggles and untoggles', async (t) => {
      if (!db || !testDocRef) {
        t.skip('Live Firestore backend tests skipped by default. Set RUN_LIVE_FIRESTORE_TESTS=true to run against live cloud instance.');
        return;
      }

      const workbookId = 'canonical_english_workbook';
      const movementId = 'canonical_exercise_plan';
      const oshoId = 'canonical_listen_osho';

      // 1. Establish progress for workbook and movement
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        habitProgress: {
          [workbookId]: { sessionsCompleted: 1, reviewDone: true, updatedAt: new Date().toISOString() },
          [movementId]: { completedItemIds: ['ex_1', 'ex_2'], workoutCompleted: false, updatedAt: new Date().toISOString() },
        },
        completedHabitIds: [],
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2. Toggle Osho ON
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        completedHabitIds: FieldValue.arrayUnion(oshoId),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      let snap = await testDocRef.get();
      assert.deepEqual(snap.data().completedHabitIds, [oshoId]);
      assert.equal(snap.data().habitProgress[workbookId].sessionsCompleted, 1);
      assert.equal(snap.data().habitProgress[movementId].completedItemIds.length, 2);

      // 3. Toggle Osho OFF
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        completedHabitIds: FieldValue.arrayRemove(oshoId),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      snap = await testDocRef.get();
      assert.deepEqual(snap.data().completedHabitIds, []);
      assert.equal(snap.data().habitProgress[workbookId].sessionsCompleted, 1);
      assert.equal(snap.data().habitProgress[movementId].completedItemIds.length, 2);

      // 4. Toggle Osho back ON (boundary: first completion after empty)
      await testDocRef.set({
        userId: 'test_integration_user',
        date: '2026-10-15',
        completedHabitIds: FieldValue.arrayUnion(oshoId),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      snap = await testDocRef.get();
      assert.deepEqual(snap.data().completedHabitIds, [oshoId]);
      assert.equal(snap.data().habitProgress[workbookId].sessionsCompleted, 1);
      assert.equal(snap.data().habitProgress[movementId].completedItemIds.length, 2);
    });

    it('should verify concurrent writes to different habits merge correctly in live Firestore', async (t) => {
      if (!db || !testDocRef) {
        t.skip('Live Firestore backend tests skipped by default. Set RUN_LIVE_FIRESTORE_TESTS=true to run against live cloud instance.');
        return;
      }

      const habitA = 'habit_concurrent_A';
      const habitB = 'habit_concurrent_B';

      // Perform two concurrent setDoc calls with merge: true for different habits
      await Promise.all([
        testDocRef.set({
          userId: 'test_integration_user',
          date: '2026-10-15',
          habitProgress: {
            [habitA]: { note: 'Note from A', updatedAt: new Date().toISOString() },
          },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true }),
        testDocRef.set({
          userId: 'test_integration_user',
          date: '2026-10-15',
          habitProgress: {
            [habitB]: { note: 'Note from B', updatedAt: new Date().toISOString() },
          },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true }),
      ]);

      const snap = await testDocRef.get();
      const progress = snap.data().habitProgress;
      assert.ok(progress[habitA], 'Habit A must exist in habitProgress');
      assert.ok(progress[habitB], 'Habit B must exist in habitProgress');
      assert.equal(progress[habitA].note, 'Note from A');
      assert.equal(progress[habitB].note, 'Note from B');
    });
  });
});

