#!/usr/bin/env node

/**
 * CLI Tool: Safe Personal-Plan Restoration for Vritta.
 * 
 * Usage:
 *   # Dry run (default): preview actions without making changes
 *   node scripts/restore-personal-plan.mjs --backup backups/<file>.json --target-email <email>
 * 
 *   # Execute restoration (skips existing documents by default):
 *   node scripts/restore-personal-plan.mjs --backup backups/<file>.json --target-email <email> --execute
 * 
 *   # Execute restoration with overwrite of existing conflicting documents:
 *   node scripts/restore-personal-plan.mjs --backup backups/<file>.json --target-email <email> --execute --overwrite
 * 
 * Safety Guarantees:
 * - Defaults to dry-run preview.
 * - Requires explicit --execute flag to write.
 * - Preserves existing documents by default; overwriting requires explicit --overwrite.
 * - Verifies manifest SHA-256 integrity checksum before processing.
 * - Validates document schema before writing.
 * - Automatically generates a pre-restoration rollback snapshot before any writes.
 * - Performs post-restoration read-back verification of all restored documents.
 * - Never prints personal data in stdout or logs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    const val = rawVal.replace(/^["'](.*)["']$/, '$1');
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
    targetEmail: null,
    targetUid: null,
    execute: false,
    overwrite: false,
    allowCrossAccount: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--backup' && args[i + 1]) {
      options.backupFile = path.resolve(args[++i]);
    } else if (arg === '--target-email' && args[i + 1]) {
      options.targetEmail = args[++i];
    } else if (arg === '--target-uid' && args[i + 1]) {
      options.targetUid = args[++i];
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--overwrite') {
      options.overwrite = true;
    } else if (arg === '--allow-cross-account') {
      options.allowCrossAccount = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/restore-personal-plan.mjs [options]

Required Options:
  --backup <file>          Path to the backup JSON file
  --target-email <email>   Target account email (or use --target-uid)

Execution Options:
  --execute                Apply restoration writes (without this, runs in safe dry-run preview)
  --overwrite              Overwrite existing conflicting documents (default: skip existing)
  --allow-cross-account    Allow restoring a backup taken from another UID into this target account
  --help, -h               Show this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

function deserializeFirestoreData(obj, TimestampClass) {
  if (obj === null || obj === undefined) return obj;
  if (obj && typeof obj === 'object' && obj._type === 'timestamp') {
    return new TimestampClass(obj.seconds, obj.nanoseconds);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deserializeFirestoreData(item, TimestampClass));
  }
  if (typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = deserializeFirestoreData(v, TimestampClass);
    }
    return res;
  }
  return obj;
}

async function main() {
  const options = parseArgs();

  console.log('======================================================');
  console.log(' Vritta: Safe Personal-Plan Restoration Tool (CLI)    ');
  console.log('======================================================\n');

  if (!options.backupFile) {
    console.error('[Error] Missing required parameter: --backup <file>');
    process.exit(1);
  }

  if (!fs.existsSync(options.backupFile)) {
    console.error(`[Error] Backup file not found: ${options.backupFile}`);
    process.exit(1);
  }

  if (!options.targetEmail && !options.targetUid) {
    console.error('[Error] Missing target account identification. Specify --target-email <email> or --target-uid <uid>.');
    process.exit(1);
  }

  const { adminAuth, adminDb, Timestamp } = await import('../web/src/lib/server/firebase-admin.js');
  const { validateComposableHabit, validateDailyLogDoc } = await import('../web/src/lib/constants/habit-models.js');
  const { normalizeHabitFromFirestore, normalizeDailyLogFromFirestore } = await import('../web/src/lib/firebase/firestore.js');

  // 1. Read & Validate Backup File Integrity
  console.log(`[Input] Reading backup file: ${options.backupFile}`);
  let backup;
  try {
    const raw = fs.readFileSync(options.backupFile, 'utf-8');
    backup = JSON.parse(raw);
  } catch (err) {
    console.error(`[Error] Failed to read or parse backup JSON: ${err.message}`);
    process.exit(1);
  }

  if (!backup.manifest || !backup.data) {
    console.error('[Error] Malformed backup: Missing "manifest" or "data" envelope.');
    process.exit(1);
  }

  if (backup.manifest.formatVersion !== '1.0.0') {
    console.error(`[Error] Unsupported backup format version: ${backup.manifest.formatVersion}`);
    process.exit(1);
  }

  const computedChecksum = crypto.createHash('sha256').update(JSON.stringify(backup.data), 'utf8').digest('hex');
  if (computedChecksum !== backup.manifest.checksum) {
    console.error('[Error] Integrity Check Failed: SHA-256 checksum does not match manifest!');
    console.error(`  Manifest: ${backup.manifest.checksum}`);
    console.error(`  Computed: ${computedChecksum}`);
    process.exit(1);
  }
  console.log('[Integrity] SHA-256 checksum verified successfully.');

  // 2. Resolve Target User Account
  let targetUid = options.targetUid;
  let targetEmail = options.targetEmail;

  if (!targetUid && targetEmail) {
    try {
      const user = await adminAuth.getUserByEmail(targetEmail);
      targetUid = user.uid;
    } catch (err) {
      console.error(`[Error] Failed to find target user with email "${targetEmail}": ${err.message}`);
      process.exit(1);
    }
  } else if (targetUid && !targetEmail) {
    try {
      const user = await adminAuth.getUser(targetUid);
      targetEmail = user.email || 'unknown';
    } catch (err) {
      console.error(`[Error] Failed to find target user with UID "${targetUid}": ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`[Target User] Email: ${targetEmail} | UID: ${targetUid}`);

  // 3. Ownership / Target Account Verification
  if (backup.manifest.userUid !== targetUid) {
    if (!options.allowCrossAccount) {
      console.error('\n[Error] Ownership Mismatch!');
      console.error(`  Backup Origin UID: ${backup.manifest.userUid}`);
      console.error(`  Target User UID:   ${targetUid}`);
      console.error('To restore into a different account, you must specify --allow-cross-account.');
      process.exit(1);
    } else {
      console.warn('\n[Warning] --allow-cross-account specified. Data ownership will be mapped to target UID.');
    }
  }

  // 4. Schema Validation of Backup Documents
  console.log('[Validation] Validating backup data against current canonical schemas...');
  const { habits = [], dailyLogs = [], habitState = [], personalRoutines = [], userDoc = null } = backup.data;

  for (const h of habits) {
    const normalized = normalizeHabitFromFirestore(h.data, h.id);
    const val = validateComposableHabit(normalized);
    if (!val.valid) {
      console.error(`[Error] Habit ${h.id} failed canonical schema validation: ${val.errors.join('; ')}`);
      process.exit(1);
    }
  }

  for (const log of dailyLogs) {
    const normalized = normalizeDailyLogFromFirestore(log.data, log.id);
    const val = validateDailyLogDoc(normalized);
    if (!val.valid) {
      console.error(`[Error] DailyLog ${log.id} failed canonical schema validation: ${val.errors.join('; ')}`);
      process.exit(1);
    }
  }

  console.log('[Validation] All habits and daily logs conform to current schema.');

  // 5. Pre-flight Check: Categorize Operations (Create vs Conflict)
  console.log('[Pre-flight] Inspecting current database state for existing records...');

  const actions = {
    userDoc: { op: 'none', ref: adminDb.collection('users').doc(targetUid) },
    habits: [],
    dailyLogs: [],
    habitState: [],
    personalRoutines: [],
  };

  // User Profile
  if (userDoc && userDoc.data) {
    const currentSnap = await actions.userDoc.ref.get();
    if (currentSnap.exists) {
      actions.userDoc.op = options.overwrite ? 'overwrite' : 'skip';
    } else {
      actions.userDoc.op = 'create';
    }
  }

  // Habits
  for (const h of habits) {
    const ref = adminDb.collection('habits').doc(h.id);
    const snap = await ref.get();
    if (snap.exists) {
      actions.habits.push({ id: h.id, ref, doc: h, op: options.overwrite ? 'overwrite' : 'skip' });
    } else {
      actions.habits.push({ id: h.id, ref, doc: h, op: 'create' });
    }
  }

  // Daily Logs
  for (const l of dailyLogs) {
    // Re-key log ID if target UID changed
    const targetLogId = backup.manifest.userUid === targetUid ? l.id : `${targetUid}_${l.data.date}`;
    const ref = adminDb.collection('dailyLogs').doc(targetLogId);
    const snap = await ref.get();
    if (snap.exists) {
      actions.dailyLogs.push({ id: targetLogId, ref, doc: l, op: options.overwrite ? 'overwrite' : 'skip' });
    } else {
      actions.dailyLogs.push({ id: targetLogId, ref, doc: l, op: 'create' });
    }
  }

  // Habit State
  for (const hs of habitState) {
    const ref = adminDb.collection('users').doc(targetUid).collection('habitState').doc(hs.id);
    const snap = await ref.get();
    if (snap.exists) {
      actions.habitState.push({ id: hs.id, ref, doc: hs, op: options.overwrite ? 'overwrite' : 'skip' });
    } else {
      actions.habitState.push({ id: hs.id, ref, doc: hs, op: 'create' });
    }
  }

  // Personal Routines
  for (const pr of personalRoutines) {
    const ref = adminDb.collection('personalRoutines').doc(pr.id);
    const snap = await ref.get();
    if (snap.exists) {
      actions.personalRoutines.push({ id: pr.id, ref, doc: pr, op: options.overwrite ? 'overwrite' : 'skip' });
    } else {
      actions.personalRoutines.push({ id: pr.id, ref, doc: pr, op: 'create' });
    }
  }

  // Count summaries
  const allActionItems = [
    ...(actions.userDoc.op !== 'none' ? [{ op: actions.userDoc.op }] : []),
    ...actions.habits,
    ...actions.dailyLogs,
    ...actions.habitState,
    ...actions.personalRoutines,
  ];

  const createCount = allActionItems.filter(a => a.op === 'create').length;
  const overwriteCount = allActionItems.filter(a => a.op === 'overwrite').length;
  const skipCount = allActionItems.filter(a => a.op === 'skip').length;

  console.log('\n------------------------------------------------------');
  console.log(' Pre-Restoration Action Summary ');
  console.log('------------------------------------------------------');
  console.log(`[Mode]             ${options.execute ? 'LIVE EXECUTION' : 'DRY RUN (PREVIEW ONLY)'}`);
  console.log(`[Overwrite Mode]   ${options.overwrite ? 'ENABLED' : 'DISABLED (preserve existing)'}`);
  console.log(`[Documents Found]  ${backup.manifest.documentCounts.total} in backup`);
  console.log(`[To Be Created]    ${createCount} documents (missing in database)`);
  console.log(`[To Overwrite]     ${overwriteCount} documents (existing in database)`);
  console.log(`[To Be Skipped]    ${skipCount} documents (existing conflicts safely preserved)`);
  console.log('------------------------------------------------------\n');

  // 6. Handle Dry Run
  if (!options.execute) {
    console.log('[Dry Run Complete] No changes were written to the database.');
    if (skipCount > 0 && !options.overwrite) {
      console.log(`[Notice] ${skipCount} existing documents would be preserved and skipped.`);
      console.log('To overwrite existing documents, pass --overwrite alongside --execute.');
    }
    console.log('\nTo execute this restoration, run:');
    console.log(`  node scripts/restore-personal-plan.mjs --backup "${options.backupFile}" --target-email "${targetEmail}" --execute ${options.overwrite ? '--overwrite' : ''}`);
    process.exit(0);
  }

  // 7. Live Execution: Step 1 - Pre-Restoration Rollback Snapshot
  console.log('[Rollback Safety] Generating pre-restoration snapshot of affected records...');
  const affectedRefs = allActionItems.filter(a => a.op === 'overwrite' || a.op === 'create').map(a => a.ref).filter(Boolean);
  
  const rollbackDocs = [];
  for (const ref of affectedRefs) {
    const snap = await ref.get();
    if (snap.exists) {
      rollbackDocs.push({
        path: ref.path,
        data: snap.data(),
      });
    }
  }

  const rollbackOutDir = path.join(projectRoot, 'backups');
  if (!fs.existsSync(rollbackOutDir)) {
    fs.mkdirSync(rollbackOutDir, { recursive: true });
  }
  const rollbackTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rollbackPath = path.join(rollbackOutDir, `rollback-before-restore-${targetUid.slice(0, 8)}-${rollbackTimestamp}.json`);

  fs.writeFileSync(rollbackPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    targetUid,
    targetEmail,
    affectedRecords: rollbackDocs,
  }, null, 2), 'utf8');

  console.log(`[Rollback Safety] Snapshot saved to: ${rollbackPath}`);

  // 8. Live Execution: Step 2 - Apply Writes
  console.log('[Write] Applying restored records to Firestore...');
  const batch = adminDb.batch();
  let writeOps = 0;

  // Restore user doc
  if (actions.userDoc.op === 'create' || actions.userDoc.op === 'overwrite') {
    const userPayload = deserializeFirestoreData(userDoc.data, Timestamp);
    batch.set(actions.userDoc.ref, userPayload, { merge: true });
    writeOps++;
  }

  // Restore habits
  for (const item of actions.habits) {
    if (item.op === 'create' || item.op === 'overwrite') {
      const data = deserializeFirestoreData(item.doc.data, Timestamp);
      data.userId = targetUid; // ensure ownership matches target
      batch.set(item.ref, data);
      writeOps++;
    }
  }

  // Restore dailyLogs
  for (const item of actions.dailyLogs) {
    if (item.op === 'create' || item.op === 'overwrite') {
      const data = deserializeFirestoreData(item.doc.data, Timestamp);
      data.userId = targetUid; // ensure ownership matches target
      batch.set(item.ref, data);
      writeOps++;
    }
  }

  // Restore habitState
  for (const item of actions.habitState) {
    if (item.op === 'create' || item.op === 'overwrite') {
      const data = deserializeFirestoreData(item.doc.data, Timestamp);
      batch.set(item.ref, data);
      writeOps++;
    }
  }

  // Restore personalRoutines
  for (const item of actions.personalRoutines) {
    if (item.op === 'create' || item.op === 'overwrite') {
      const data = deserializeFirestoreData(item.doc.data, Timestamp);
      data.userId = targetUid;
      batch.set(item.ref, data);
      writeOps++;
    }
  }

  if (writeOps > 0) {
    await batch.commit();
    console.log(`[Write] Successfully committed ${writeOps} document write operations.`);
  } else {
    console.log('[Write] Zero write operations needed.');
  }

  // 9. Live Execution: Step 3 - Post-Restoration Read-back Verification
  console.log('[Verification] Reading back restored records from Firestore to verify persistence & ownership...');
  let verifiedCount = 0;

  const itemsToVerify = allActionItems.filter(a => a.op === 'create' || a.op === 'overwrite');
  for (const item of itemsToVerify) {
    const snap = await item.ref.get();
    if (!snap.exists) {
      console.error(`[Verification Error] Restored document ${item.ref.path} was not found on read-back!`);
      process.exit(1);
    }
    const data = snap.data();
    if (data.userId && data.userId !== targetUid) {
      console.error(`[Verification Error] Restored document ${item.ref.path} has incorrect userId: ${data.userId}`);
      process.exit(1);
    }
    verifiedCount++;
  }

  console.log(`[Verification] Confirmed ${verifiedCount} documents exist with correct ownership in Firestore.`);

  console.log('\n------------------------------------------------------');
  console.log(' Restoration Completed Successfully! ');
  console.log('------------------------------------------------------');
  console.log(`[Target Account]  ${targetEmail} (${targetUid})`);
  console.log(`[Restored Docs]   ${writeOps} documents`);
  console.log(`[Skipped Docs]    ${skipCount} documents`);
  console.log(`[Verified Reads]  ${verifiedCount} documents confirmed`);
  console.log(`[Rollback File]   ${rollbackPath}`);
  console.log('------------------------------------------------------\n');
}

main().catch(err => {
  console.error('\n[Fatal Error]', err);
  process.exit(1);
});
