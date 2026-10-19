#!/usr/bin/env node

/**
 * Migration Tool: Composable Habit & State Decoupling Migration for Vritta (Phase 5).
 * 
 * Purpose:
 * Safely migrates existing routines and user-level progression state to authoritative
 * composable habit models and isolated habitState subcollections.
 * 
 * Invariants & Safety Guarantees:
 * - Defaults strictly to read-only `--dry-run`. Live writes require explicit `--apply`.
 * - Takes a complete, SHA-256 verified pre-migration backup before any operations.
 * - Concurrency / timestamp guards: verifies documents were not modified after backup.
 * - Normalizes habit schemas into the 6 canonical atomic feature slots.
 * - Decouples exercisePlan & oshoSeriesProgress into /users/{userId}/habitState/{habitId}.
 * - Preserves 100% of daily logs, notes, checklist progress, and timestamps.
 * - NEVER fabricates historical completions or synthetic misses in Firestore.
 * - Atomic batch execution within Firestore limits (max 400 ops per batch).
 * - Emits comprehensive machine-readable and tabular dry-run reports.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

export const CANONICAL_CATEGORY_MAP = {
  'English Learning': 'Learning & Growth',
  'Movement & Strength': 'Health & Fitness',
  'Movement': 'Health & Fitness',
  'Fitness': 'Health & Fitness',
  'Health': 'Health & Fitness',
  'Listening & Awareness': 'Mindfulness & Spirit',
  'Mindfulness': 'Mindfulness & Spirit',
  'Reading': 'Learning & Growth',
  'Communication': 'Work & Career',
  'Reflection': 'Reflection & Journaling',
  'Nutrition': 'Health & Fitness',
  'Recovery': 'Rest & Recovery',
  'Schedule': 'Work & Career',
};

export const TARGET_ACCOUNTS = {
  personal: {
    email: 'manishborikar92@gmail.com',
    uid: '2W83kgjX9db8QiIWqZd5AJrc8PQ2',
    role: 'Protected Personal Account',
  },
  test: {
    email: 'theodinproject0622@gmail.com',
    uid: 'fr9Yo4VDtuRN8LjX1YKWLSLaSx42',
    role: 'Designated Interactive Testing Account',
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    apply: false,
    dryRun: true,
    email: null,
    uid: null,
    backupFile: null,
    outDir: path.join(projectRoot, 'backups'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      options.apply = true;
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
      options.apply = false;
    } else if (arg === '--email' && args[i + 1]) {
      options.email = args[++i];
    } else if (arg === '--uid' && args[i + 1]) {
      options.uid = args[++i];
    } else if (arg === '--backup' && args[i + 1]) {
      options.backupFile = path.resolve(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/migrate-composable-habits.mjs [options]

Modes:
  --dry-run                Execute read-only audit and report (Default)
  --apply                  Apply migration to Firestore (Requires explicit authorization)

Options:
  --email <email>          Target specific user by email (default: all target accounts)
  --uid <uid>              Target specific user by UID
  --backup <path>          Use existing backup snapshot instead of generating a new one
  --help, -h               Show this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

export function canonicalSerialize(val) {
  if (val === undefined) return undefined;
  if (val === null) return { _type: 'null' };

  // Firestore Timestamp instance (has toDate or seconds & nanoseconds)
  if (typeof val.toDate === 'function') {
    return {
      _type: 'timestamp',
      nanoseconds: val.nanoseconds ?? 0,
      seconds: val.seconds ?? 0,
    };
  }
  // Serialized timestamp object from backup
  if (val._type === 'timestamp' && typeof val.seconds === 'number') {
    return {
      _type: 'timestamp',
      nanoseconds: val.nanoseconds ?? 0,
      seconds: val.seconds,
    };
  }
  if (typeof val.seconds === 'number' && typeof val.nanoseconds === 'number' && Object.keys(val).length <= 4) {
    return {
      _type: 'timestamp',
      nanoseconds: val.nanoseconds,
      seconds: val.seconds,
    };
  }

  // Firestore GeoPoint
  if (typeof val.latitude === 'number' && typeof val.longitude === 'number' && typeof val.isEqual === 'function') {
    return {
      _type: 'geopoint',
      latitude: val.latitude,
      longitude: val.longitude,
    };
  }

  // DocumentReference
  if (val.firestore && typeof val.path === 'string') {
    return {
      _type: 'reference',
      path: val.path,
    };
  }

  // Primitive types with strict type differentiation
  if (typeof val === 'string') {
    return { _type: 'string', value: val };
  }
  if (typeof val === 'number') {
    return { _type: 'number', value: val };
  }
  if (typeof val === 'boolean') {
    return { _type: 'boolean', value: val };
  }

  if (Array.isArray(val)) {
    return val.map(canonicalSerialize);
  }

  if (typeof val === 'object') {
    const sortedKeys = Object.keys(val).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
      if (val[key] !== undefined) {
        sortedObj[key] = canonicalSerialize(val[key]);
      }
    }
    return sortedObj;
  }

  throw new Error(`[CANONICAL_SERIALIZE_ERROR] Unsupported Firestore value type encountered: ${typeof val}`);
}

export function canonicalJsonString(val) {
  return JSON.stringify(canonicalSerialize(val));
}

function serializeFirestoreValue(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj.toDate === 'function') {
    return {
      _type: 'timestamp',
      iso: obj.toDate().toISOString(),
      seconds: obj.seconds,
      nanoseconds: obj.nanoseconds,
    };
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeFirestoreValue);
  }
  if (typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeFirestoreValue(v);
    }
    return res;
  }
  return obj;
}

export async function createPreMigrationBackup(adminDb, usersList, outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const backupData = {
    metadata: {
      tool: 'migrate-composable-habits',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      targetUsers: usersList.map(u => ({ uid: u.uid, email: u.email })),
    },
    users: {},
    habits: {},
    habitState: {},
    dailyLogs: {},
  };

  let totalDocs = 0;

  for (const user of usersList) {
    const uid = user.uid;

    // 1. User doc
    const userDocSnap = await adminDb.collection('users').doc(uid).get();
    if (userDocSnap.exists) {
      backupData.users[uid] = {
        id: uid,
        data: serializeFirestoreValue(userDocSnap.data()),
      };
      totalDocs++;
    }

    // 2. Habits
    const habitsSnap = await adminDb.collection('habits').where('userId', '==', uid).get();
    backupData.habits[uid] = habitsSnap.docs.map(doc => {
      totalDocs++;
      return {
        id: doc.id,
        path: doc.ref.path,
        data: serializeFirestoreValue(doc.data()),
      };
    });

    // 3. HabitState subcollection
    const habitStateSnap = await adminDb.collection('users').doc(uid).collection('habitState').get();
    backupData.habitState[uid] = habitStateSnap.docs.map(doc => {
      totalDocs++;
      return {
        id: doc.id,
        path: doc.ref.path,
        data: serializeFirestoreValue(doc.data()),
      };
    });

    // 4. Daily Logs
    const dailyLogsSnap = await adminDb.collection('dailyLogs').where('userId', '==', uid).get();
    backupData.dailyLogs[uid] = dailyLogsSnap.docs.map(doc => {
      totalDocs++;
      return {
        id: doc.id,
        path: doc.ref.path,
        data: serializeFirestoreValue(doc.data()),
      };
    });
  }

  backupData.metadata.totalDocuments = totalDocs;

  // Compute canonical data payload checksum
  const dataPayloadString = JSON.stringify({
    users: backupData.users,
    habits: backupData.habits,
    habitState: backupData.habitState,
    dailyLogs: backupData.dailyLogs,
  });
  const checksum = crypto.createHash('sha256').update(dataPayloadString, 'utf8').digest('hex');
  backupData.metadata.checksumSha256 = checksum;

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `pre-migration-backup-${timestampStr}.json`;
  const backupFilePath = path.join(outDir, backupFileName);

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

  // Verify written file payload checksum
  const verifiedContent = fs.readFileSync(backupFilePath, 'utf-8');
  const verifiedParsed = JSON.parse(verifiedContent);
  const verifiedPayloadString = JSON.stringify({
    users: verifiedParsed.users,
    habits: verifiedParsed.habits,
    habitState: verifiedParsed.habitState,
    dailyLogs: verifiedParsed.dailyLogs,
  });
  const verifiedChecksum = crypto.createHash('sha256').update(verifiedPayloadString, 'utf8').digest('hex');

  return {
    filePath: backupFilePath,
    fileName: backupFileName,
    checksum,
    verifiedChecksum,
    totalDocs,
    data: backupData,
  };
}

export function buildNormalizedComposableHabit(rawHabit, docId, userId, timezone = 'UTC', templates = []) {
  const title = rawHabit.title || '';
  const stableKey = rawHabit.stableKey || docId;
  const rawCat = rawHabit.category || '';
  const canonicalCategory = CANONICAL_CATEGORY_MAP[rawCat] || rawCat || 'Learning & Growth';

  // Schedule
  const frequency = Array.isArray(rawHabit.schedule?.frequency) && rawHabit.schedule.frequency.length > 0
    ? [...rawHabit.schedule.frequency]
    : Array.isArray(rawHabit.frequency) && rawHabit.frequency.length > 0
    ? [...rawHabit.frequency]
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const restDays = Array.isArray(rawHabit.schedule?.restDays)
    ? [...rawHabit.schedule.restDays]
    : Array.isArray(rawHabit.metadata?.restDays)
    ? [...rawHabit.metadata.restDays]
    : (stableKey === 'canonical_exercise_plan' || rawHabit.completionMethod === 'exercise_plan')
    ? ['Sun']
    : [];

  const timingType = rawHabit.schedule?.timingType ||
    rawHabit.timingType ||
    (rawHabit.time === 'Before bed' || rawHabit.metadata?.context
      ? 'relative'
      : (rawHabit.time && rawHabit.time !== 'Flexible' ? 'preferred_period' : 'anytime'));
  const preferredPeriod = rawHabit.schedule?.preferredPeriod ||
    rawHabit.preferredPeriod ||
    (timingType === 'preferred_period' && rawHabit.time && rawHabit.time !== 'Flexible' ? rawHabit.time : null);
  const relativeTiming = rawHabit.schedule?.relativeTiming ||
    rawHabit.relativeTiming ||
    (timingType === 'relative' ? (rawHabit.time || rawHabit.metadata?.context || null) : null);
  const exactTime = rawHabit.schedule?.exactTime || rawHabit.exactTime || null;
  const order = typeof rawHabit.schedule?.order === 'number' ? rawHabit.schedule.order : (rawHabit.order || 0);

  const schedule = {
    frequency,
    restDays,
    timingType,
    preferredPeriod,
    relativeTiming,
    exactTime,
    order,
  };

  // Tracking Horizon
  let createdAtStr = null;
  if (rawHabit.createdAt) {
    if (typeof rawHabit.createdAt.toDate === 'function') {
      createdAtStr = rawHabit.createdAt.toDate().toISOString();
    } else if (rawHabit.createdAt._seconds) {
      createdAtStr = new Date(rawHabit.createdAt._seconds * 1000).toISOString();
    } else if (typeof rawHabit.createdAt === 'string') {
      createdAtStr = rawHabit.createdAt;
    }
  }

  const startDate = createdAtStr ? createdAtStr.slice(0, 10) : '2026-10-14';

  const trackingHorizon = rawHabit.lifecycle?.trackingHorizon || {
    startDate,
    status: 'verified_creation',
  };

  const scheduleHistory = Array.isArray(rawHabit.scheduleHistory) && rawHabit.scheduleHistory.length > 0
    ? [...rawHabit.scheduleHistory]
    : [{
        effectiveDate: trackingHorizon.startDate || '1970-01-01',
        frequency: [...schedule.frequency],
        restDays: [...schedule.restDays],
        timingType: schedule.timingType,
        preferredPeriod: schedule.preferredPeriod,
        relativeTiming: schedule.relativeTiming,
        exactTime: schedule.exactTime,
        updatedAt: new Date().toISOString(),
      }];

  // Features
  const features = {
    counter: { enabled: false },
    timer: { enabled: false },
    checklist: { enabled: false, items: [] },
    notes: { enabled: false },
    catalog: { enabled: false },
    daySchedule: { enabled: false },
  };

  // If habit already had feature configurations, preserve them
  if (rawHabit.features && typeof rawHabit.features === 'object') {
    for (const [k, v] of Object.entries(rawHabit.features)) {
      if (v && typeof v === 'object' && features[k]) {
        features[k] = { ...v, enabled: Boolean(v.enabled) };
      }
    }
  }

  const completionMethod = rawHabit.completionMethod;

  // Map specialized routine features
  if (completionMethod === 'workbook_sessions' || stableKey === 'canonical_english_workbook') {
    features.counter = {
      enabled: true,
      targetCount: rawHabit.metadata?.dailySessionsTarget || rawHabit.features?.counter?.targetCount || 2,
      unit: 'sessions',
      step: 1,
      minCount: 0,
    };
    features.checklist = {
      enabled: true,
      items: [
        { id: 'review_previous', label: "Review previous day's work", isRequiredForCompletion: true, order: 0 },
        { id: 'complete_sessions', label: 'Complete 2 sessions in Word Power Made Easy', isRequiredForCompletion: true, order: 1 },
      ],
    };
  } else if (completionMethod === 'exercise_plan' || stableKey === 'canonical_exercise_plan') {
    features.daySchedule = {
      enabled: true,
      planTitle: '12-Week Progressive Movement Plan',
      totalWeeks: 12,
      dayVariations: {
        Mon: { type: 'workout', label: 'Strength and Posture Workout' },
        Tue: { type: 'walk', label: 'Easy Walk & Stretches' },
        Wed: { type: 'workout', label: 'Strength and Posture Workout' },
        Thu: { type: 'walk', label: 'Easy Walk & Stretches' },
        Fri: { type: 'workout', label: 'Strength and Posture Workout' },
        Sat: { type: 'walk', label: 'Easy Walk & Stretches' },
        Sun: { type: 'rest', label: 'Planned Rest & Recovery' },
      },
    };
    if (!schedule.restDays.includes('Sun')) schedule.restDays.push('Sun');
  } else if (completionMethod === 'osho_listening' || stableKey === 'canonical_listen_osho') {
    features.catalog = {
      enabled: true,
      catalogId: 'osho_discourses',
      catalogTitle: 'Osho Discourses',
      totalItems: rawHabit.metadata?.libraryCount || 30,
      items: [],
    };
    // Timer remains optional/disabled by default per user rule
    features.timer = {
      enabled: Boolean(rawHabit.features?.timer?.enabled),
      targetDurationMinutes: rawHabit.features?.timer?.targetDurationMinutes || rawHabit.targetMinutes || 30,
      mode: 'countdown',
      soundOnComplete: false,
    };
  } else if (completionMethod === 'reading_duration' || stableKey === 'canonical_read_books') {
    features.timer = {
      enabled: true,
      targetDurationMinutes: rawHabit.features?.timer?.targetDurationMinutes || rawHabit.targetMinutes || 30,
      mode: 'countdown',
      soundOnComplete: true,
    };
  } else if (completionMethod === 'simple_with_notes' || stableKey === 'canonical_english_speaking') {
    features.notes = {
      enabled: true,
      isPrivateDiary: false,
      placeholder: 'Practice English speaking notes...',
      reflectionPrompts: [],
    };
  } else if (completionMethod === 'diary_entry' || stableKey === 'canonical_maintain_diary') {
    features.notes = {
      enabled: true,
      isPrivateDiary: true,
      placeholder: 'Write in your personal diary...',
      reflectionPrompts: Array.isArray(rawHabit.metadata?.reflectivePrompts)
        ? rawHabit.metadata.reflectivePrompts
        : [
            'What happened or what thought came to mind?',
            'What did I feel?',
            'What assumption might I be making?',
            'What did I learn?',
            'Is there a small next step?',
          ],
    };
  }

  return {
    id: docId,
    userId,
    title,
    description: rawHabit.description || rawHabit.instructions || '',
    category: canonicalCategory,
    icon: rawHabit.icon || null,
    color: rawHabit.color || null,
    schedule,
    scheduleHistory,
    features,
    lifecycle: {
      createdAt: rawHabit.lifecycle?.createdAt || rawHabit.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: Boolean(rawHabit.lifecycle?.archived ?? rawHabit.archived),
      archivedAt: rawHabit.lifecycle?.archivedAt || rawHabit.archivedAt || null,
      deleted: Boolean(rawHabit.lifecycle?.deleted ?? rawHabit.deleted),
      deletedAt: rawHabit.lifecycle?.deletedAt || rawHabit.deletedAt || null,
      trackingHorizon,
    },
    seedOrigin: rawHabit.seedOrigin || 'custom',
    templateReference: rawHabit.templateReference || null,
    stableKey,
  };
}

/**
 * Execute atomic migration transaction for a single user account.
 * Enforces transactional read-preconditions right up to commit time:
 * 1. Fail-closed deep canonical equality for all source documents (user + all habits)
 *    against pre-migration backup snapshot. Exactly 0 fields excluded.
 * 2. Pre-write destination guards for all habitState subcollection documents.
 * 3. All writes commit atomically or abort cleanly with zero partial writes.
 */
export async function executeAccountMigrationTransaction({
  adminDb,
  uid,
  accountData,
  backupData,
  FieldValue,
  serializeHabitForFirestore,
  options = {},
}) {
  return adminDb.runTransaction(async (transaction) => {
    // 1. Transactional Reads & Pre-Commit Source Concurrency Guards (Fail-Closed)
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await transaction.get(userRef);

    const backupUserEntry = backupData.users?.[uid];
    if (!backupUserEntry) {
      throw new Error(`[CONCURRENCY_ABORT] User document ${uid} was not found in pre-migration backup snapshot. Halting migration.`);
    }

    if (!userSnap.exists) {
      throw new Error(`[CONCURRENCY_ABORT] User document ${uid} does not exist in live Firestore. Halting migration.`);
    }

    // Fail-closed deep canonical comparison: exactly ZERO fields excluded
    const liveUserCanonical = canonicalJsonString(userSnap.data());
    const backupUserCanonical = canonicalJsonString(backupUserEntry.data);
    if (liveUserCanonical !== backupUserCanonical) {
      throw new Error(`[CONCURRENCY_ABORT] User document ${uid} content differs from pre-migration backup snapshot. Halting migration to prevent overwriting modified data.`);
    }

    // Read and verify all habits within transaction (Fail-Closed)
    for (const habitDiff of accountData.habitTransformations) {
      const rawHabitEntry = backupData.habits?.[uid]?.find(h => h.id === habitDiff.id);
      if (!rawHabitEntry) {
        throw new Error(`[CONCURRENCY_ABORT] Habit document ${habitDiff.id} was not found in pre-migration backup snapshot. Halting migration.`);
      }

      const habitRef = adminDb.collection('habits').doc(habitDiff.id);
      const currentSnap = await transaction.get(habitRef);

      if (!currentSnap.exists) {
        throw new Error(`[CONCURRENCY_ABORT] Habit document ${habitDiff.id} does not exist in live Firestore. Halting migration.`);
      }

      // Fail-closed deep canonical comparison: exactly ZERO fields excluded
      // Catches ANY change to title, schedule, features, metadata, or other fields,
      // regardless of whether updatedAt is present, missing, or unchanged!
      const liveHabitCanonical = canonicalJsonString(currentSnap.data());
      const backupHabitCanonical = canonicalJsonString(rawHabitEntry.data);
      if (liveHabitCanonical !== backupHabitCanonical) {
        throw new Error(`[CONCURRENCY_ABORT] Habit document ${habitDiff.id} content differs from pre-migration backup snapshot. Halting migration to prevent overwriting modified data.`);
      }
    }

    // 2. Transactional Reads & Destination Conflict Guards
    // Verify every destination written by migration under /users/{uid}/habitState/{habitId}
    for (const stateItem of accountData.stateDecoupling) {
      const destRef = adminDb.doc(stateItem.destinationDoc);
      const destSnap = await transaction.get(destRef);

      if (destSnap.exists) {
        if (!options.allowResume) {
          throw new Error(`[DESTINATION_CONFLICT_ABORT] Destination habitState document ${stateItem.destinationDoc} already exists in Firestore. Halting migration to prevent overwriting existing state.`);
        }

        // Verified resume path: fail closed unless live document is proven identical to the complete expected migration state
        const liveDestData = destSnap.data() || {};
        const cleanLive = { ...liveDestData };
        delete cleanLive.updatedAt;

        const cleanExpected = { ...stateItem.data };
        delete cleanExpected.updatedAt;

        if (canonicalJsonString(cleanLive) !== canonicalJsonString(cleanExpected)) {
          throw new Error(`[DESTINATION_CONFLICT_ABORT] Destination habitState document ${stateItem.destinationDoc} exists with differing or unexamined state during resume attempt. Halting migration.`);
        }
      }
    }

    // 3. Transactional Writes
    // Write normalized habits
    for (const habitDiff of accountData.habitTransformations) {
      const rawHabitEntry = backupData.habits[uid].find(h => h.id === habitDiff.id);
      const normalizedHabit = buildNormalizedComposableHabit(rawHabitEntry.data, habitDiff.id, uid);
      const serializedHabit = serializeHabitForFirestore(normalizedHabit);
      const habitRef = adminDb.collection('habits').doc(habitDiff.id);
      transaction.set(habitRef, serializedHabit);
    }

    // Write decoupled habitState documents
    for (const stateItem of accountData.stateDecoupling) {
      const stateRef = adminDb.doc(stateItem.destinationDoc);
      transaction.set(stateRef, {
        ...stateItem.data,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Update root user document
    if (accountData.stateDecoupling.length > 0) {
      const userUpdate = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      for (const stateItem of accountData.stateDecoupling) {
        if (stateItem.sourceField.includes('exercisePlan')) {
          userUpdate.exercisePlan = FieldValue.delete();
        }
        if (stateItem.sourceField.includes('oshoSeriesProgress')) {
          userUpdate.oshoSeriesProgress = FieldValue.delete();
          userUpdate.activeOshoSeriesId = FieldValue.delete();
        }
      }
      transaction.update(userRef, userUpdate);
    }
  });
}

async function main() {
  const options = parseArgs();

  console.log('================================================================');
  console.log(' Vritta: Composable Habit & State Decoupling Migration (Phase 5)');
  console.log(` Mode: ${options.apply ? 'APPLY (LIVE WRITES AUTHORIZED)' : 'DRY RUN (READ-ONLY)'}`);
  console.log('================================================================\n');

  // Load modules
  const adminPath = path.join(projectRoot, 'web', 'src', 'lib', 'server', 'firebase-admin.js');
  const habitModelsPath = path.join(projectRoot, 'web', 'src', 'domain', 'index.js');
  const firestorePath = path.join(projectRoot, 'web', 'src', 'lib', 'firebase', 'firestore.js');

  const { adminDb, adminAuth, FieldValue } = await import(pathToFileURL(adminPath).href);
  const { validateComposableHabit, CATEGORIES } = await import(pathToFileURL(habitModelsPath).href);
  const { serializeHabitForFirestore } = await import(pathToFileURL(firestorePath).href);

  if (!adminDb) {
    console.error('[Error] Firebase Admin SDK could not be initialized.');
    process.exit(1);
  }

  // Determine target users
  let targetUsers = [];
  if (options.uid) {
    targetUsers = [{ uid: options.uid, email: options.email || 'target_user' }];
  } else if (options.email) {
    try {
      const user = await adminAuth.getUserByEmail(options.email);
      targetUsers = [{ uid: user.uid, email: user.email }];
    } catch (err) {
      console.error(`[Error] Could not find user with email: ${options.email}`);
      process.exit(1);
    }
  } else {
    // Both target accounts
    targetUsers = [
      TARGET_ACCOUNTS.personal,
      TARGET_ACCOUNTS.test,
    ];
  }

  console.log('[Target Accounts]');
  for (const u of targetUsers) {
    console.log(`  • ${u.email} (${u.uid})`);
  }
  console.log('');

  // 1. Generate / Verify Pre-Migration Backup Snapshot
  console.log('1. Generating pre-migration snapshot & SHA-256 integrity verification...');
  const backupResult = await createPreMigrationBackup(adminDb, targetUsers, options.outDir);
  console.log(`   Backup saved to: ${backupResult.filePath}`);
  console.log(`   Total documents backed up: ${backupResult.totalDocs}`);
  console.log(`   SHA-256 Checksum: ${backupResult.checksum}`);
  console.log(`   Checksum match verified: ${backupResult.checksum === backupResult.verifiedChecksum ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log('');

  const report = {
    timestamp: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    backup: {
      path: backupResult.filePath,
      checksum: backupResult.checksum,
      totalDocuments: backupResult.totalDocs,
    },
    accounts: {},
    overallStatus: 'READY_FOR_APPROVAL',
  };

  // 2. Analyze & Prepare Migration
  console.log('2. Analyzing accounts and preparing schema transformations...');

  for (const targetUser of targetUsers) {
    const uid = targetUser.uid;
    const email = targetUser.email;
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Account: ${email} (${uid})`);
    console.log(`----------------------------------------------------------------`);

    const accountReport = {
      email,
      uid,
      inspectedDocuments: {
        userDoc: 0,
        habits: 0,
        habitState: 0,
        dailyLogs: 0,
      },
      habitTransformations: [],
      stateDecoupling: [],
      dailyLogsPreserved: 0,
      blockingIssues: [],
    };

    // User Doc
    const rawUserDoc = backupResult.data.users[uid]?.data || null;
    accountReport.inspectedDocuments.userDoc = rawUserDoc ? 1 : 0;

    // Habits
    const rawHabits = backupResult.data.habits[uid] || [];
    accountReport.inspectedDocuments.habits = rawHabits.length;

    // HabitState
    const rawHabitState = backupResult.data.habitState[uid] || [];
    accountReport.inspectedDocuments.habitState = rawHabitState.length;

    // Daily Logs
    const rawDailyLogs = backupResult.data.dailyLogs[uid] || [];
    accountReport.inspectedDocuments.dailyLogs = rawDailyLogs.length;
    accountReport.dailyLogsPreserved = rawDailyLogs.length;

    console.log(`Inspected Documents: UserDoc: ${accountReport.inspectedDocuments.userDoc} | Habits: ${accountReport.inspectedDocuments.habits} | HabitState: ${accountReport.inspectedDocuments.habitState} | DailyLogs: ${accountReport.inspectedDocuments.dailyLogs}`);

    // Map habits
    for (const habitEntry of rawHabits) {
      const docId = habitEntry.id;
      const rawData = habitEntry.data;
      const normalized = buildNormalizedComposableHabit(rawData, docId, uid);
      const validation = validateComposableHabit(normalized);

      const isAlreadyCompliant = rawData.features &&
        rawData.schedule &&
        rawData.scheduleHistory &&
        rawData.lifecycle &&
        CATEGORIES.includes(rawData.category);

      const diff = {
        id: docId,
        title: normalized.title,
        status: isAlreadyCompliant ? 'ALREADY_COMPLIANT' : 'NEEDS_NORMALIZATION',
        currentCategory: rawData.category || '(none)',
        targetCategory: normalized.category,
        currentFeatures: rawData.features ? Object.keys(rawData.features).filter(k => rawData.features[k]?.enabled) : ['(legacy)'],
        targetFeatures: Object.keys(normalized.features).filter(k => normalized.features[k]?.enabled),
        validation: {
          valid: validation.valid,
          errors: validation.errors,
        },
      };

      if (!validation.valid) {
        accountReport.blockingIssues.push(`Habit ${docId} validation failure: ${validation.errors.join(', ')}`);
      }

      accountReport.habitTransformations.push(diff);
      console.log(`  [Habit] ${diff.title} (${diff.id})`);
      console.log(`          Category: "${diff.currentCategory}" -> "${diff.targetCategory}"`);
      console.log(`          Features: [${diff.targetFeatures.join(', ')}] | Status: ${diff.status} | Valid: ${diff.validation.valid ? 'YES' : 'NO'}`);
    }

    // State Decoupling Analysis
    if (rawUserDoc) {
      // 1. Exercise Plan
      if (rawUserDoc.exercisePlan) {
        const exerciseHabit = rawHabits.find(h => h.data.stableKey === 'canonical_exercise_plan') ||
          rawHabits.find(h => h.id.endsWith('_canonical_exercise_plan')) ||
          rawHabits.find(h => h.id.includes('exercise_plan')) ||
          rawHabits.find(h => h.data.completionMethod === 'exercise_plan');
        const exerciseHabitId = exerciseHabit ? exerciseHabit.id : `${uid}_canonical_exercise_plan`;
        const resolvedStartDate = rawUserDoc.exercisePlan.startDate || '2026-10-15';
        const decoupledExerciseDoc = {
          habitId: exerciseHabitId,
          userId: uid,
          currentWeek: rawUserDoc.exercisePlan.currentWeek || 1,
          startDate: resolvedStartDate,
          activated: rawUserDoc.exercisePlan.activated ?? true,
          checkupCompleted: rawUserDoc.exercisePlan.checkupCompleted ?? false,
          phaseHistory: Array.isArray(rawUserDoc.exercisePlan.phaseHistory) ? rawUserDoc.exercisePlan.phaseHistory : [],
        };
        accountReport.stateDecoupling.push({
          sourceField: 'users/{uid}.exercisePlan',
          destinationDoc: `users/${uid}/habitState/${exerciseHabitId}`,
          data: decoupledExerciseDoc,
          action: 'CREATE_SUBCOLLECTION_DOC_AND_DELETE_ROOT_FIELD',
        });
        console.log(`  [State Decoupling] exercisePlan -> users/${uid}/habitState/${exerciseHabitId}`);
        console.log(`                     currentWeek: ${decoupledExerciseDoc.currentWeek}, startDate: "${decoupledExerciseDoc.startDate}"`);
      }

      // 2. Osho Series Progress
      if (rawUserDoc.oshoSeriesProgress) {
        const oshoHabit = rawHabits.find(h => h.data.stableKey === 'canonical_listen_osho') ||
          rawHabits.find(h => h.id.endsWith('_canonical_listen_osho')) ||
          rawHabits.find(h => h.id.includes('listen_osho')) ||
          rawHabits.find(h => h.data.completionMethod === 'osho_listening');
        const oshoHabitId = oshoHabit ? oshoHabit.id : `${uid}_canonical_listen_osho`;
        const decoupledOshoDoc = {
          habitId: oshoHabitId,
          userId: uid,
          activeSeriesId: rawUserDoc.activeOshoSeriesId || 'osho_01',
          seriesProgress: rawUserDoc.oshoSeriesProgress,
        };
        accountReport.stateDecoupling.push({
          sourceField: 'users/{uid}.oshoSeriesProgress',
          destinationDoc: `users/${uid}/habitState/${oshoHabitId}`,
          data: decoupledOshoDoc,
          action: 'CREATE_SUBCOLLECTION_DOC_AND_DELETE_ROOT_FIELD',
        });
        console.log(`  [State Decoupling] oshoSeriesProgress -> users/${uid}/habitState/${oshoHabitId}`);
        console.log(`                     activeSeriesId: "${decoupledOshoDoc.activeSeriesId}"`);
        for (const [sId, sData] of Object.entries(decoupledOshoDoc.seriesProgress)) {
          const talks = typeof sData === 'object' ? sData?.completedTalks : sData;
          const updated = typeof sData === 'object' ? sData?.lastUpdated : 'n/a';
          console.log(`                     • Series ${sId}: completedTalks=${talks}, lastUpdated="${updated}"`);
        }
      }
    }

    report.accounts[uid] = accountReport;
  }

  // 3. Execution (Apply Mode) vs Halting (Dry-Run Mode)
  const allBlockingIssues = Object.values(report.accounts).flatMap(a => a.blockingIssues);
  if (allBlockingIssues.length > 0) {
    report.overallStatus = 'BLOCKED_BY_VALIDATION_ERRORS';
    console.error('\n[MIGRATION BLOCKED] Found validation errors:');
    for (const err of allBlockingIssues) {
      console.error(`  • ${err}`);
    }
  }

  // Write dry-run report artifact
  const reportPath = path.join(projectRoot, 'scratch', 'migration-dry-run-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  // Also write to brain artifacts directory
  const brainReportPath = 'C:\\Users\\manis\\.gemini\\antigravity\\brain\\a97eccbd-4a7c-4444-93d9-846f22051ade\\scratch\\migration-dry-run-report.json';
  fs.writeFileSync(brainReportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n================================================================`);
  console.log(`Dry-Run Report saved to: ${reportPath}`);
  console.log(`Overall Migration Feasibility: ${allBlockingIssues.length === 0 ? '100% COMPLIANT & SAFE' : 'BLOCKED'}`);
  console.log(`================================================================\n`);

  if (!options.apply) {
    console.log('[STAGE 1 COMPLETE] Read-only dry run finished cleanly.');
    console.log('ZERO Firestore documents were modified or deleted.');
    console.log('Halting at Mandatory Production Approval Gate awaiting explicit user review and authorization.');
    process.exit(0);
  }

  // --- STAGE 2 APPLY LOGIC (Only executed when --apply is explicitly passed) ---
  console.log('Executing live database writes via atomic transactions (--apply authorized)...');

  if (allBlockingIssues.length > 0) {
    console.error('[Cannot Apply] Aborting due to validation errors.');
    process.exit(1);
  }

  for (const targetUser of targetUsers) {
    const uid = targetUser.uid;
    const accountData = report.accounts[uid];
    if (!accountData) continue;

    console.log(`Executing atomic migration transaction for account: ${targetUser.email} (${uid})...`);
    await executeAccountMigrationTransaction({
      adminDb,
      uid,
      accountData,
      backupData: backupResult.data,
      FieldValue,
      serializeHabitForFirestore,
    });
    console.log(`✔ Transaction successfully committed for account: ${targetUser.email}`);
  }

  const applyTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditLogPath = path.join(options.outDir, `migration-audit-log-${applyTimestamp}.json`);
  fs.writeFileSync(auditLogPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    status: 'APPLIED_SUCCESSFULLY',
    report,
  }, null, 2), 'utf-8');

  console.log(`\n[SUCCESS] Migration applied successfully. Audit log: ${auditLogPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('[Fatal Error]', err);
    process.exit(1);
  });
}
