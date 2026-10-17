#!/usr/bin/env node

/**
 * CLI Tool: Safe Personal-Plan Backup for Vritta.
 * 
 * Usage:
 *   node scripts/backup-personal-plan.mjs [--email <email>] [--uid <uid>] [--out <dir>]
 *   npm --prefix web run plan:backup
 * 
 * Security & Safety:
 * - Operates strictly via Firebase Admin SDK with authenticated credentials.
 * - Stores backups locally in a dedicated Git-ignored directory (backups/).
 * - Never prints personal plan contents or secrets in stdout or logs.
 * - Preserves all document paths, IDs, ownership, and relationships.
 * - Produces SHA-256 checksums and versioned manifests for integrity verification.
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

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    email: 'manishborikar92@gmail.com', // Default to primary user
    uid: null,
    outDir: path.join(projectRoot, 'backups'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) {
      options.email = args[++i];
    } else if (arg === '--uid' && args[i + 1]) {
      options.uid = args[++i];
    } else if (arg === '--out' && args[i + 1]) {
      options.outDir = path.resolve(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/backup-personal-plan.mjs [options]

Options:
  --email <email>   Target user email (default: manishborikar92@gmail.com)
  --uid <uid>       Target user UID (overrides --email lookup if provided)
  --out <dir>       Output directory for backups (default: ./backups)
  --help, -h        Show this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

function serializeFirestoreData(obj) {
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
    return obj.map(serializeFirestoreData);
  }
  if (typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeFirestoreData(v);
    }
    return res;
  }
  return obj;
}

async function main() {
  const options = parseArgs();

  console.log('======================================================');
  console.log(' Vritta: Safe Personal-Plan Backup Tool (CLI)         ');
  console.log('======================================================\n');

  const { adminAuth, adminDb } = await import('../web/src/lib/server/firebase-admin.js');

  if (!adminAuth || !adminDb) {
    console.error('[Error] Firebase Admin SDK is not properly initialized.');
    console.error('Please verify GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY in web/.env.local.');
    process.exit(1);
  }

  // 1. Resolve Target User
  let targetUid = options.uid;
  let targetEmail = options.email;

  if (!targetUid && targetEmail) {
    try {
      const user = await adminAuth.getUserByEmail(targetEmail);
      targetUid = user.uid;
    } catch (err) {
      console.error(`[Error] Failed to resolve user by email "${targetEmail}": ${err.message}`);
      process.exit(1);
    }
  } else if (targetUid && !targetEmail) {
    try {
      const user = await adminAuth.getUser(targetUid);
      targetEmail = user.email || 'unknown';
    } catch (err) {
      console.error(`[Error] Failed to resolve user by UID "${targetUid}": ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`[Target User] Email: ${targetEmail} | UID: ${targetUid}`);

  // 2. Fetch User Profile Document & Subcollections
  console.log('[Export] Fetching user profile document and subcollections...');
  const userDocRef = adminDb.collection('users').doc(targetUid);
  const userDocSnap = await userDocRef.get();

  let userDocData = null;
  if (userDocSnap.exists) {
    userDocData = serializeFirestoreData(userDocSnap.data());
  }

  // Fetch habitState subcollection under /users/{targetUid}/habitState
  const habitStateSnap = await userDocRef.collection('habitState').get();
  const habitStateDocs = [];
  habitStateSnap.forEach(doc => {
    habitStateDocs.push({
      id: doc.id,
      path: doc.ref.path,
      data: serializeFirestoreData(doc.data()),
    });
  });

  // 3. Fetch Habits (/habits where userId == targetUid)
  console.log('[Export] Fetching habits...');
  const habitsSnap = await adminDb.collection('habits').where('userId', '==', targetUid).get();
  const habitDocs = [];
  habitsSnap.forEach(doc => {
    habitDocs.push({
      id: doc.id,
      path: doc.ref.path,
      data: serializeFirestoreData(doc.data()),
    });
  });

  // 4. Fetch Daily Logs (/dailyLogs where userId == targetUid or prefix matching)
  console.log('[Export] Fetching daily observance logs...');
  const dailyLogsSnap = await adminDb.collection('dailyLogs').where('userId', '==', targetUid).get();
  const dailyLogMap = new Map();

  dailyLogsSnap.forEach(doc => {
    dailyLogMap.set(doc.id, {
      id: doc.id,
      path: doc.ref.path,
      data: serializeFirestoreData(doc.data()),
    });
  });

  // Also query docs whose ID starts with `${targetUid}_` in case legacy records lack userId field
  const prefixStart = `${targetUid}_`;
  const prefixEnd = `${targetUid}_\uf8ff`;
  const prefixSnap = await adminDb.collection('dailyLogs')
    .where('__name__', '>=', prefixStart)
    .where('__name__', '<=', prefixEnd)
    .get();

  prefixSnap.forEach(doc => {
    if (!dailyLogMap.has(doc.id)) {
      dailyLogMap.set(doc.id, {
        id: doc.id,
        path: doc.ref.path,
        data: serializeFirestoreData(doc.data()),
      });
    }
  });

  const dailyLogDocs = Array.from(dailyLogMap.values());

  // 5. Fetch Personal Routines (/personalRoutines where userId == targetUid)
  console.log('[Export] Fetching personalized schedules...');
  const personalRoutinesSnap = await adminDb.collection('personalRoutines').where('userId', '==', targetUid).get();
  const personalRoutineDocs = [];
  personalRoutinesSnap.forEach(doc => {
    personalRoutineDocs.push({
      id: doc.id,
      path: doc.ref.path,
      data: serializeFirestoreData(doc.data()),
    });
  });

  // 6. Build Payload and Manifest
  const payloadData = {
    userDoc: userDocData ? { id: targetUid, path: `users/${targetUid}`, data: userDocData } : null,
    habits: habitDocs,
    dailyLogs: dailyLogDocs,
    habitState: habitStateDocs,
    personalRoutines: personalRoutineDocs,
  };

  const dataString = JSON.stringify(payloadData);
  const checksum = crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');

  const snapshotTimestamp = new Date().toISOString();
  const safeTimestamp = snapshotTimestamp.replace(/[:.]/g, '-');

  const manifest = {
    formatVersion: '1.0.0',
    targetProjectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vritta-app',
    userUid: targetUid,
    userEmail: targetEmail,
    snapshotTimestamp,
    documentCounts: {
      habits: habitDocs.length,
      dailyLogs: dailyLogDocs.length,
      userDoc: userDocData ? 1 : 0,
      habitState: habitStateDocs.length,
      personalRoutines: personalRoutineDocs.length,
      total: habitDocs.length + dailyLogDocs.length + (userDocData ? 1 : 0) + habitStateDocs.length + personalRoutineDocs.length,
    },
    checksum,
  };

  const fullBackup = {
    manifest,
    data: payloadData,
  };

  // 7. Write to Local Git-Ignored File
  if (!fs.existsSync(options.outDir)) {
    fs.mkdirSync(options.outDir, { recursive: true });
  }

  const filename = `vritta-plan-backup-${targetUid.slice(0, 8)}-${safeTimestamp}.json`;
  const filePath = path.join(options.outDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(fullBackup, null, 2), 'utf8');

  console.log('\n------------------------------------------------------');
  console.log(' Backup Snapshot Created Successfully ');
  console.log('------------------------------------------------------');
  console.log(`[File Path]     ${filePath}`);
  console.log(`[Format]        Version ${manifest.formatVersion}`);
  console.log(`[Habits]        ${manifest.documentCounts.habits} documents`);
  console.log(`[Daily Logs]    ${manifest.documentCounts.dailyLogs} documents`);
  console.log(`[User Profile]  ${manifest.documentCounts.userDoc ? 'Present' : 'Not Found'}`);
  console.log(`[Habit State]   ${manifest.documentCounts.habitState} documents`);
  console.log(`[Personal Rout] ${manifest.documentCounts.personalRoutines} documents`);
  console.log(`[Total Docs]    ${manifest.documentCounts.total} documents`);
  console.log(`[Integrity SHA] ${manifest.checksum}`);
  console.log('------------------------------------------------------\n');
}

main().catch(err => {
  console.error('\n[Fatal Error]', err);
  process.exit(1);
});
