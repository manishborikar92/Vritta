import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import {
  executeAccountMigrationTransaction,
} from '../../scripts/migrate-composable-habits.mjs';

import {
  executeAccountRollbackTransaction,
} from '../../scripts/rollback-composable-habits.mjs';

import {
  buildNormalizedComposableHabit,
} from '../../scripts/migrate-composable-habits.mjs';

import {
  serializeHabitForFirestore,
} from '../src/lib/firebase/firestore.js';

/**
 * Check if the Firestore Emulator is running and accepting TCP connections.
 */
async function isEmulatorRunning(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

describe('Phase 5: Cloud Firestore Emulator Integration Tests', async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST ? process.env.FIRESTORE_EMULATOR_HOST.split(':')[0] : '127.0.0.1';
  const port = process.env.FIRESTORE_EMULATOR_HOST ? parseInt(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1], 10) : 8080;

  const emulatorAvailable = await isEmulatorRunning(host, port);

  if (!emulatorAvailable) {
    it.skip(`Firestore Emulator is not running on ${host}:${port}. (Emulator-backed integration verification skipped - real emulator daemon not reachable)`, () => {});
    return;
  }

  // If emulator is reachable, import firebase-admin and configure for emulator
  const admin = await import('firebase-admin');
  const app = admin.default.apps.length > 0
    ? admin.default.app()
    : admin.default.initializeApp({ projectId: 'vritta-emulator-test' });

  const adminDb = app.firestore();
  const FieldValue = admin.default.firestore.FieldValue;

  const uid = 'emulator_test_user_1';
  const habitId = `${uid}_canonical_exercise_plan`;

  before(async () => {
    // Reset test collection
    await adminDb.doc(`users/${uid}`).delete();
    await adminDb.doc(`habits/${habitId}`).delete();
    await adminDb.doc(`users/${uid}/habitState/${habitId}`).delete();
  });

  after(async () => {
    // Cleanup
    await adminDb.doc(`users/${uid}`).delete();
    await adminDb.doc(`habits/${habitId}`).delete();
    await adminDb.doc(`users/${uid}/habitState/${habitId}`).delete();
  });

  it('1. should reject migration if source document is edited after backup snapshot', async () => {
    // Setup initial live state
    await adminDb.doc(`users/${uid}`).set({
      displayName: 'Emulator User',
      exercisePlan: { currentWeek: 1, startDate: '2026-10-15' },
    });
    await adminDb.doc(`habits/${habitId}`).set({
      id: habitId,
      userId: uid,
      title: 'Initial Habit Title',
      completionMethod: 'exercise_plan',
    });

    // Backup snapshot matches initial state
    const backupData = {
      users: {
        [uid]: {
          data: {
            displayName: 'Emulator User',
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
              userId: uid,
              title: 'Initial Habit Title',
              completionMethod: 'exercise_plan',
            },
          },
        ],
      },
    };

    const accountData = {
      habitTransformations: [{ id: habitId, title: 'Initial Habit Title' }],
      stateDecoupling: [{
        destinationDoc: `users/${uid}/habitState/${habitId}`,
        data: { currentWeek: 1, startDate: '2026-10-15', habitId, userId: uid },
        sourceField: 'users/{uid}.exercisePlan',
      }],
    };

    // User edits live habit title concurrently in the emulator
    await adminDb.doc(`habits/${habitId}`).update({
      title: 'Edited Title in Emulator',
    });

    // Attempt migration transaction against real emulator
    await assert.rejects(async () => {
      await executeAccountMigrationTransaction({
        adminDb,
        uid,
        accountData,
        backupData,
        FieldValue,
        serializeHabitForFirestore,
      });
    }, /CONCURRENCY_ABORT/);

    // Verify ZERO writes occurred
    const stateDoc = await adminDb.doc(`users/${uid}/habitState/${habitId}`).get();
    assert.equal(stateDoc.exists, false, 'No destination doc must be created on abort');
  });

  it('2. should fail closed if source snapshot information is missing or invalid', async () => {
    const invalidBackup = { users: {}, habits: {} };
    const accountData = {
      habitTransformations: [{ id: habitId, title: 'Test' }],
      stateDecoupling: [],
    };

    await assert.rejects(async () => {
      await executeAccountMigrationTransaction({
        adminDb,
        uid,
        accountData,
        backupData: invalidBackup,
        FieldValue,
        serializeHabitForFirestore,
      });
    }, /CONCURRENCY_ABORT/);
  });

  it('3. should protect destination habitState and abort if destination already exists', async () => {
    // Restore live state to match backup
    await adminDb.doc(`habits/${habitId}`).set({
      id: habitId,
      userId: uid,
      title: 'Initial Habit Title',
      completionMethod: 'exercise_plan',
    });

    const backupData = {
      users: { [uid]: { data: { displayName: 'Emulator User', exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } } } },
      habits: { [uid]: [{ id: habitId, data: { id: habitId, userId: uid, title: 'Initial Habit Title', completionMethod: 'exercise_plan' } }] },
    };

    const accountData = {
      habitTransformations: [{ id: habitId, title: 'Initial Habit Title' }],
      stateDecoupling: [{
        destinationDoc: `users/${uid}/habitState/${habitId}`,
        data: { currentWeek: 1, startDate: '2026-10-15', habitId, userId: uid },
        sourceField: 'users/{uid}.exercisePlan',
      }],
    };

    // Pre-create destination document in emulator
    await adminDb.doc(`users/${uid}/habitState/${habitId}`).set({
      currentWeek: 1,
      preExistingField: true,
    });

    await assert.rejects(async () => {
      await executeAccountMigrationTransaction({
        adminDb,
        uid,
        accountData,
        backupData,
        FieldValue,
        serializeHabitForFirestore,
        options: { allowResume: false },
      });
    }, /DESTINATION_CONFLICT_ABORT/);
  });

  it('4. should prevent unsafe rollback if progression was updated post-migration', async () => {
    const plan = {
      usersToRestore: [{ uid, docPath: `users/${uid}`, data: { displayName: 'Emulator User', exercisePlan: { currentWeek: 1, startDate: '2026-10-15' } } }],
      habitsToRestore: [{ id: habitId, docPath: `habits/${habitId}`, data: { id: habitId, userId: uid, title: 'Initial Habit Title', completionMethod: 'exercise_plan' } }],
      habitStatesToDelete: [{ uid, id: habitId, docPath: `users/${uid}/habitState/${habitId}` }],
    };

    // User progressed to week 3 in destination state
    await adminDb.doc(`users/${uid}/habitState/${habitId}`).set({
      currentWeek: 3, // Advanced week!
      startDate: '2026-10-15',
    });

    await assert.rejects(async () => {
      await executeAccountRollbackTransaction({
        adminDb,
        uid,
        plan,
        options: { force: false },
      });
    }, /POST_MIGRATION_CONCURRENCY_GUARD/);

    // Verify destination doc was NOT deleted
    const snap = await adminDb.doc(`users/${uid}/habitState/${habitId}`).get();
    assert.equal(snap.exists, true, 'Destination state must be preserved');
  });

  it('5. should leave zero partial writes in emulator if transaction aborts', async () => {
    // Verify no partial writes exist
    const snap = await adminDb.doc(`users/${uid}/habitState/${habitId}`).get();
    assert.equal(snap.data()?.currentWeek, 3, 'Existing state unchanged');
  });
});
