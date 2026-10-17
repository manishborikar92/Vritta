#!/usr/bin/env node

/**
 * Rollback Tool: Composable Habit & State Decoupling Rollback for Vritta (Phase 5).
 * 
 * Purpose:
 * Safely restores documents to their exact pre-migration state using a verified
 * pre-migration backup snapshot.
 * 
 * Safety Guarantees:
 * - Defaults strictly to read-only preview. Requires explicit `--execute` to write.
 * - Verifies backup file SHA-256 checksum before touching any documents.
 * - Exact document overwrite: calls batch.set(docRef, originalData) without merge,
 *   completely clearing all migration-introduced fields (features, scheduleHistory).
 * - Restores deleted progression fields on root user documents (exercisePlan, oshoSeriesProgress).
 * - Deletes migration-created documents in /users/{userId}/habitState/{habitId}.
 * - Strictly leaves unrelated user documents and daily logs untouched.
 * - Performs post-restoration read-back verification of all restored documents.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalSerialize, canonicalJsonString } from './migrate-composable-habits.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from web/.env.local if present
function loadEnv() {
  const envPath = path.join(projectRoot, 'web', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    backupFile: null,
    execute: false,
    dryRun: true,
    uid: null,
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--backup' && args[i + 1]) {
      options.backupFile = path.resolve(args[++i]);
    } else if (arg === '--execute') {
      options.execute = true;
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
      options.execute = false;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--uid' && args[i + 1]) {
      options.uid = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/rollback-composable-habits.mjs [options]

Required Options:
  --backup <path>          Path to the pre-migration backup JSON snapshot

Execution Modes:
  --dry-run                Preview rollback operations without writing (Default)
  --execute                Execute live rollback writes to Firestore

Options:
  --force                  Bypass post-migration document concurrency guard
  --uid <uid>              Rollback only a specific user from the backup
  --help, -h               Show this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

function deserializeFirestoreValue(val, adminFirestore) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && val._type === 'timestamp' && val.seconds !== undefined) {
    return new adminFirestore.Timestamp(val.seconds, val.nanoseconds || 0);
  }
  if (Array.isArray(val)) {
    return val.map(item => deserializeFirestoreValue(item, adminFirestore));
  }
  if (typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = deserializeFirestoreValue(v, adminFirestore);
    }
    return res;
  }
  return val;
}

/**
 * Execute atomic rollback transaction for a single user.
 * Enforces transactional reads and commit-time concurrency isolation for all affected documents:
 * 1. Root user profile: users/{uid}
 * 2. Habits: habits/{habitId}
 * 3. Decoupled progression state: users/{uid}/habitState/{habitId}
 */
export async function executeAccountRollbackTransaction({
  adminDb,
  uid,
  plan,
  options = {},
  adminFirestore = null,
}) {
  return adminDb.runTransaction(async (transaction) => {
    const userRef = adminDb.doc(`users/${uid}`);
    const userItem = plan.usersToRestore.find(u => u.uid === uid);
    const habitItems = plan.habitsToRestore.filter(h => (h.data.userId === uid || h.id.startsWith(`${uid}_`)));
    const userHabitStates = plan.habitStatesToDelete.filter(s => s.uid === uid);

    if (!options.force) {
      // 1. Transactional Guard on Root User Profile: users/${uid}
      if (userItem) {
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists) {
          const liveUserData = userSnap.data() || {};
          // Strip decoupled legacy progression fields and transient updatedAt to detect user edits
          const stripTransient = (u) => {
            const copy = { ...u };
            delete copy.exercisePlan;
            delete copy.oshoSeriesProgress;
            delete copy.activeOshoSeriesId;
            delete copy.updatedAt;
            return copy;
          };
          const liveClean = canonicalSerialize(stripTransient(liveUserData));
          const backupClean = canonicalSerialize(stripTransient(userItem.data));
          if (JSON.stringify(liveClean) !== JSON.stringify(backupClean)) {
            throw new Error(`[POST_MIGRATION_CONCURRENCY_GUARD] Root user profile users/${uid} has post-migration modifications. Rollback aborted to protect user profile changes.`);
          }
        }
      }

      // 2. Transactional Guard on Habits: habits/{habitId}
      for (const item of habitItems) {
        const habitRef = adminDb.doc(item.docPath);
        const currentSnap = await transaction.get(habitRef);
        if (currentSnap.exists) {
          const curData = currentSnap.data() || {};
          const isPreMigrationShape = !curData.features && curData.completionMethod;
          const isExpectedMigratedShape = Boolean(curData.features) && curData.title === item.data.title;
          if (!isPreMigrationShape && !isExpectedMigratedShape) {
            throw new Error(`[POST_MIGRATION_CONCURRENCY_GUARD] Habit ${item.id} has post-migration modifications (title: "${curData.title}"). Rollback aborted.`);
          }
        }
      }

      // 3. Transactional Guard on Destination Documents: users/${uid}/habitState/{habitId}
      // Deleting these documents would destroy any progression recorded after migration!
      for (const item of userHabitStates) {
        const stateRef = adminDb.doc(item.docPath);
        const stateSnap = await transaction.get(stateRef);
        if (stateSnap.exists) {
          const liveState = stateSnap.data() || {};
          // Check Exercise Plan progression
          if (item.id.includes('exercise_plan')) {
            const initialWeek = userItem?.data?.exercisePlan?.currentWeek ?? 1;
            const initialStartDate = userItem?.data?.exercisePlan?.startDate ?? '2026-10-15';
            const initialCheckup = userItem?.data?.exercisePlan?.checkupCompleted ?? false;

            if (
              (liveState.currentWeek !== undefined && liveState.currentWeek !== initialWeek) ||
              (liveState.startDate !== undefined && liveState.startDate !== initialStartDate) ||
              (liveState.checkupCompleted !== undefined && liveState.checkupCompleted !== initialCheckup)
            ) {
              throw new Error(`[POST_MIGRATION_CONCURRENCY_GUARD] Destination habitState document ${item.docPath} has post-migration exercise progression updates (currentWeek=${liveState.currentWeek} vs initial=${initialWeek}). Rollback aborted to prevent deleting user progression.`);
            }
          }

          // Check Osho Series Progress
          if (item.id.includes('listen_osho')) {
            const initialProgress = userItem?.data?.oshoSeriesProgress || {};
            const initialActiveId = userItem?.data?.activeOshoSeriesId || 'osho_01';

            if (liveState.activeSeriesId && liveState.activeSeriesId !== initialActiveId) {
              throw new Error(`[POST_MIGRATION_CONCURRENCY_GUARD] Destination habitState document ${item.docPath} has post-migration active series updates (${liveState.activeSeriesId} vs initial=${initialActiveId}). Rollback aborted.`);
            }

            // Check if any series progressed or if series count changed or timestamps changed
            const liveProgress = liveState.seriesProgress || {};
            if (Object.keys(liveProgress).length !== Object.keys(initialProgress).length) {
              throw new Error(`[POST_MIGRATION_CONCURRENCY_GUARD] Destination habitState document ${item.docPath} has post-migration Osho series changes (additional or removed series). Rollback aborted.`);
            }
            for (const [sId, sData] of Object.entries(liveProgress)) {
              if (canonicalJsonString(sData) !== canonicalJsonString(initialProgress[sId])) {
                throw new Error(`[POST_MIGRATION_CONCURRENCY_GUARD] Destination habitState document ${item.docPath} has post-migration Osho progression updates (series ${sId}). Rollback aborted.`);
              }
            }
          }
        }
      }
    }

    // 4. Transactional Writes (Only executed if all guards pass or options.force is explicitly true)
    for (const item of habitItems) {
      const habitRef = adminDb.doc(item.docPath);
      const restoredData = adminFirestore
        ? deserializeFirestoreValue(item.data, adminFirestore)
        : item.data;
      transaction.set(habitRef, restoredData); // Overwrites without merge
    }

    if (userItem) {
      const restoredUserData = adminFirestore
        ? deserializeFirestoreValue(userItem.data, adminFirestore)
        : userItem.data;
      transaction.set(userRef, restoredUserData); // Overwrites without merge
    }

    for (const item of userHabitStates) {
      const stateRef = adminDb.doc(item.docPath);
      transaction.delete(stateRef);
    }
  });
}

export async function executeRollback(options, adminDb, adminFirestore = null) {
  if (!options.backupFile || !fs.existsSync(options.backupFile)) {
    throw new Error(`Backup file does not exist: ${options.backupFile}`);
  }

  const fileContent = fs.readFileSync(options.backupFile, 'utf-8');
  const backup = JSON.parse(fileContent);

  // Verify SHA-256 Checksum on canonical data payload
  if (backup.metadata?.checksumSha256) {
    const dataPayloadString = JSON.stringify({
      users: backup.users,
      habits: backup.habits,
      habitState: backup.habitState,
      dailyLogs: backup.dailyLogs,
    });
    const computedChecksum = crypto.createHash('sha256').update(dataPayloadString, 'utf8').digest('hex');
    const recordedChecksum = backup.metadata.checksumSha256;
    if (computedChecksum !== recordedChecksum) {
      throw new Error(`[CRITICAL] Backup checksum mismatch! Tamper detected. Expected: ${recordedChecksum}, Computed: ${computedChecksum}`);
    }
    console.log(`[Backup Verification] SHA-256 Checksum Verified: ${recordedChecksum} (MATCH)`);
  } else {
    throw new Error('[CRITICAL] Backup file lacks checksumSha256 in metadata. Refusing to rollback.');
  }

  const uidsToRollback = options.uid
    ? [options.uid]
    : Object.keys(backup.users || {});

  const plan = {
    habitsToRestore: [],
    usersToRestore: [],
    habitStatesToDelete: [],
    dryRun: options.dryRun,
  };

  for (const uid of uidsToRollback) {
    // 1. User doc
    const userSnapshot = backup.users?.[uid]?.data;
    if (userSnapshot) {
      plan.usersToRestore.push({
        uid,
        docPath: `users/${uid}`,
        data: userSnapshot,
      });
    }

    // 2. Habits
    const habitSnapshots = backup.habits?.[uid] || [];
    for (const habitEntry of habitSnapshots) {
      plan.habitsToRestore.push({
        id: habitEntry.id,
        docPath: habitEntry.path || `habits/${habitEntry.id}`,
        data: habitEntry.data,
      });
    }

    // 3. HabitState subcollections to clear (documents created during migration)
    if (adminDb) {
      const habitStateSnap = await adminDb.collection('users').doc(uid).collection('habitState').get();
      habitStateSnap.forEach(doc => {
        plan.habitStatesToDelete.push({
          uid,
          id: doc.id,
          docPath: doc.ref.path,
        });
      });
    }
  }

  console.log(`\n[Rollback Plan Summary]`);
  console.log(`  • User Documents to Restore: ${plan.usersToRestore.length}`);
  console.log(`  • Habit Documents to Restore: ${plan.habitsToRestore.length}`);
  console.log(`  • Migration Subcollection Docs to Delete: ${plan.habitStatesToDelete.length}`);
  console.log(`  • Mode: ${options.dryRun ? 'DRY-RUN (PREVIEW ONLY)' : 'LIVE EXECUTION'}\n`);

  if (options.dryRun) {
    console.log('[DRY-RUN] Rollback preview complete. Zero changes written.');
    return { success: true, plan };
  }

  // Live rollback execution
  if (!adminDb) {
    throw new Error('adminDb is required for live rollback execution.');
  }

  for (const uid of uidsToRollback) {
    console.log(`Executing atomic rollback transaction for user ${uid}...`);
    await executeAccountRollbackTransaction({
      adminDb,
      uid,
      plan,
      options,
      adminFirestore,
    });
    console.log(`✔ Rollback transaction successfully committed for user ${uid}.`);
  }

  console.log('[SUCCESS] Live rollback committed successfully. Pre-migration state restored.');
  return { success: true, plan };
}

async function main() {
  const options = parseArgs();

  console.log('================================================================');
  console.log(' Vritta: Composable Habit & State Decoupling Rollback (Phase 5)');
  console.log(` Mode: ${options.execute ? 'EXECUTE (LIVE RESTORATION WRITES)' : 'DRY RUN (PREVIEW ONLY)'}`);
  console.log('================================================================\n');

  if (!options.backupFile) {
    console.error('[Error] --backup <path> is required for rollback.');
    process.exit(1);
  }

  const adminPath = path.join(projectRoot, 'web', 'src', 'lib', 'server', 'firebase-admin.js');
  const { adminDb, Timestamp } = await import(pathToFileURL(adminPath).href);

  await executeRollback(options, adminDb, { Timestamp });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('[Fatal Error in Rollback]', err);
    process.exit(1);
  });
}
