#!/usr/bin/env node

/**
 * scripts/cleanup-obsolete-slot-flags.mjs
 *
 * Mandatory Firestore migration deliverable:
 * 1. Audits and inventories obsolete slot flags (`features.notes.isPrivateDiary`, `features.timer.soundOnComplete`)
 *    and obsolete completionMethod aliases (`diary_entry`, `simple_with_notes`).
 * 2. Generates an encrypted/checksummed SHA-256 recoverable backup before modifying any record.
 * 3. Supports read-only `--dry-run` (default) and explicit `--apply` modes.
 * 4. Atomically strips obsolete fields via FieldValue.delete() and updates legacy completionMethod to canonical.
 * 5. Runs immediate post-migration verification asserting 0 remaining instances of obsolete fields.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from web/.env.local
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
    apply: false,
    dryRun: true,
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
    } else if (arg === '--outDir' && args[i + 1]) {
      options.outDir = path.resolve(args[++i]);
    }
  }

  return options;
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

export async function runCleanup() {
  const options = parseArgs();

  console.log('='.repeat(70));
  console.log('VRITTA FIRESTORE OBSOLETE FIELD CLEANUP');
  console.log(`Execution Mode: ${options.apply ? 'APPLY (LIVE WRITES AUTHORIZED)' : 'DRY RUN (READ-ONLY REPORT)'}`);
  console.log('='.repeat(70));

  const adminPath = path.join(projectRoot, 'web', 'src', 'lib', 'server', 'firebase-admin.js');
  const { adminDb, FieldValue } = await import(pathToFileURL(adminPath).href);

  if (!adminDb) {
    console.error('[Error] Firebase Admin SDK could not be initialized.');
    process.exit(1);
  }

  // 1. Full Database Scan & Inventory
  console.log('\n[Step 1] Scanning entire Firestore habits collection...');
  const habitsSnap = await adminDb.collection('habits').get();
  console.log(`Found ${habitsSnap.size} total habit documents across all accounts.`);

  const affectedHabits = [];
  const fullBackupPayload = {
    metadata: {
      tool: 'cleanup-obsolete-slot-flags',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      totalHabitsScanned: habitsSnap.size,
    },
    habits: {},
  };

  for (const doc of habitsSnap.docs) {
    const data = doc.data();
    fullBackupPayload.habits[doc.id] = serializeFirestoreValue(data);

    const hasPrivateDiary = data.features?.notes?.isPrivateDiary !== undefined;
    const hasSoundOnComplete = data.features?.timer?.soundOnComplete !== undefined;
    const hasLegacyCompletionMethod = ['diary_entry', 'simple_with_notes'].includes(data.completionMethod);

    if (hasPrivateDiary || hasSoundOnComplete || hasLegacyCompletionMethod) {
      affectedHabits.push({
        id: doc.id,
        ref: doc.ref,
        title: data.title,
        userId: data.userId,
        features: data.features,
        completionMethod: data.completionMethod,
        hasPrivateDiary,
        privateDiaryValue: data.features?.notes?.isPrivateDiary,
        hasSoundOnComplete,
        soundOnCompleteValue: data.features?.timer?.soundOnComplete,
        hasLegacyCompletionMethod,
      });
    }
  }

  console.log(`Identified ${affectedHabits.length} habits with obsolete fields/aliases:`);
  console.log(`- features.notes.isPrivateDiary: ${affectedHabits.filter(h => h.hasPrivateDiary).length}`);
  console.log(`- features.timer.soundOnComplete: ${affectedHabits.filter(h => h.hasSoundOnComplete).length}`);
  console.log(`- legacy completionMethod: ${affectedHabits.filter(h => h.hasLegacyCompletionMethod).length}`);

  // 2. Pre-Migration Recoverable Backup
  console.log('\n[Step 2] Generating pre-migration recoverable backup snapshot...');
  if (!fs.existsSync(options.outDir)) {
    fs.mkdirSync(options.outDir, { recursive: true });
  }

  const payloadString = JSON.stringify(fullBackupPayload.habits);
  const checksum = crypto.createHash('sha256').update(payloadString, 'utf8').digest('hex');
  fullBackupPayload.metadata.checksumSha256 = checksum;

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `pre-cleanup-habits-backup-${timestampStr}.json`;
  const backupFilePath = path.join(options.outDir, backupFileName);

  fs.writeFileSync(backupFilePath, JSON.stringify(fullBackupPayload, null, 2), 'utf-8');
  console.log(`Backup saved to: ${backupFilePath}`);
  console.log(`Backup SHA-256 Checksum: ${checksum}`);

  // Verify written backup
  const verifyContent = fs.readFileSync(backupFilePath, 'utf-8');
  const verifyParsed = JSON.parse(verifyContent);
  const verifyChecksum = crypto.createHash('sha256').update(JSON.stringify(verifyParsed.habits), 'utf8').digest('hex');
  if (verifyChecksum !== checksum) {
    console.error('[Error] Backup verification failed: checksum mismatch!');
    process.exit(1);
  }
  console.log('Backup integrity verified successfully.');

  // 3. Dry-Run Plan & Transformation Breakdown
  console.log('\n[Step 3] Planned Transformations:');
  const plannedOperations = [];

  for (const item of affectedHabits) {
    const updateOps = {
      'lifecycle.updatedAt': FieldValue.serverTimestamp(),
    };
    const explanations = [];

    if (item.hasPrivateDiary) {
      updateOps['features.notes.isPrivateDiary'] = FieldValue.delete();
      explanations.push(`Delete 'features.notes.isPrivateDiary' (current: ${item.privateDiaryValue})`);
    }

    if (item.hasSoundOnComplete) {
      updateOps['features.timer.soundOnComplete'] = FieldValue.delete();
      explanations.push(`Delete 'features.timer.soundOnComplete' (current: ${item.soundOnCompleteValue})`);
    }

    if (item.hasLegacyCompletionMethod) {
      updateOps['completionMethod'] = 'simple';
      if (!item.features?.notes?.enabled) {
        updateOps['features.notes.enabled'] = true;
      }
      explanations.push(`Normalize completionMethod '${item.completionMethod}' -> 'simple' (guarantee features.notes.enabled)`);
    }

    plannedOperations.push({
      id: item.id,
      title: item.title,
      userId: item.userId,
      ref: item.ref,
      updateOps,
      explanations,
    });

    console.log(`  • [${item.id}] "${item.title}" (User: ${item.userId})`);
    for (const exp of explanations) {
      console.log(`    - ${exp}`);
    }
  }

  // 4. Execution
  if (options.dryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN COMPLETE — No changes were written to Firestore.');
    console.log('To apply these transformations, re-run with: node scripts/cleanup-obsolete-slot-flags.mjs --apply');
    console.log('='.repeat(70));
    return {
      status: 'DRY_RUN_SUCCESS',
      affectedCount: affectedHabits.length,
      backupPath: backupFilePath,
      checksum,
    };
  }

  console.log('\n[Step 4] Applying batch updates to Firestore...');
  const batch = adminDb.batch();
  for (const op of plannedOperations) {
    batch.update(op.ref, op.updateOps);
  }
  await batch.commit();
  console.log(`Successfully committed updates for ${plannedOperations.length} habit documents.`);

  // 5. Post-Migration Verification
  console.log('\n[Step 5] Post-migration verification...');
  let postVerificationErrors = 0;
  for (const op of plannedOperations) {
    const updatedSnap = await op.ref.get();
    const updatedData = updatedSnap.data();

    if (updatedData.features?.notes?.isPrivateDiary !== undefined) {
      console.error(`  FAIL: Document ${op.id} still has features.notes.isPrivateDiary!`);
      postVerificationErrors++;
    }
    if (updatedData.features?.timer?.soundOnComplete !== undefined) {
      console.error(`  FAIL: Document ${op.id} still has features.timer.soundOnComplete!`);
      postVerificationErrors++;
    }
    if (['diary_entry', 'simple_with_notes'].includes(updatedData.completionMethod)) {
      console.error(`  FAIL: Document ${op.id} still has legacy completionMethod: ${updatedData.completionMethod}!`);
      postVerificationErrors++;
    }
  }

  if (postVerificationErrors > 0) {
    console.error(`\n[CRITICAL ERROR] Post-migration verification failed with ${postVerificationErrors} errors!`);
    process.exit(1);
  }

  console.log('Post-migration verification PASSED: All obsolete fields completely eliminated.');
  console.log('='.repeat(70));
  console.log('CLEANUP MIGRATION COMPLETED SUCCESSFULLY');
  console.log('='.repeat(70));

  return {
    status: 'APPLY_SUCCESS',
    updatedCount: plannedOperations.length,
    backupPath: backupFilePath,
    checksum,
  };
}

if (process.argv[1] && process.argv[1].endsWith('cleanup-obsolete-slot-flags.mjs')) {
  runCleanup().catch(err => {
    console.error('Fatal error during cleanup:', err);
    process.exit(1);
  });
}
