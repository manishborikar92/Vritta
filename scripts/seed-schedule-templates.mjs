#!/usr/bin/env node

/**
 * CLI Tool: Shared Schedule Templates Bootstrap & Seed for Vritta.
 *
 * Seeds authoritative reusable routine templates into the shared Firestore
 * collection `scheduleTemplates`.
 *
 * Usage:
 *   node scripts/seed-schedule-templates.mjs           # Dry-run mode (default)
 *   node scripts/seed-schedule-templates.mjs --apply   # Executes write operations
 *
 * Safety & Isolation:
 * - Operates strictly via Firebase Admin SDK with authenticated credentials.
 * - Targets ONLY the shared `scheduleTemplates` collection.
 * - ZERO writes to `/habits`, `/users`, or `/dailyLogs`.
 * - Strictly protects personal account manishborikar92@gmail.com and all user-owned data.
 * - Validates all template schemas before any persistence.
 * - Supports idempotent upserts without blanket collection resets.
 * - Performs read-back verification after writes.
 */

import fs from 'node:fs';
import path from 'node:path';
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

function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = sanitizeForFirestore(v);
      }
    }
    return res;
  }
  return obj;
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply;

  console.log('======================================================');
  console.log(' Vritta: Shared Schedule Templates Bootstrap (CLI)   ');
  console.log('======================================================');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (no changes will be written)' : 'APPLY (live Firestore writes authorized)'}\n`);

  // Import server-side modules
  const { SCHEDULE_TEMPLATES, validateScheduleTemplate } = await import(
    '../web/src/lib/server/schedule-templates.js'
  );
  const { adminDb } = await import('../web/src/lib/server/firebase-admin.js');

  if (!adminDb) {
    console.error('[Error] Firebase Admin SDK is not properly initialized.');
    console.error('Please verify GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY in web/.env.local.');
    process.exit(1);
  }

  // 1. Pre-validation of all blueprints
  console.log(`[Validation] Checking ${SCHEDULE_TEMPLATES.length} templates against schema contracts...`);
  let validationErrors = 0;
  for (const template of SCHEDULE_TEMPLATES) {
    const res = validateScheduleTemplate(template);
    if (!res.valid) {
      console.error(`  ✕ Invalid template "${template.id}": ${res.errors.join('; ')}`);
      validationErrors++;
    } else {
      console.log(`  ✓ Valid: ${template.id.padEnd(32)} [${template.category}] - "${template.title}"`);
    }
  }

  if (validationErrors > 0) {
    console.error(`\n[Fatal] ${validationErrors} templates failed schema validation. Aborting.`);
    process.exit(1);
  }
  console.log(`[Validation] All ${SCHEDULE_TEMPLATES.length} templates passed schema validation.\n`);

  // 2. Query existing templates in Firestore
  const collectionRef = adminDb.collection('scheduleTemplates');
  console.log('[Firestore] Querying existing documents in "scheduleTemplates"...');
  const existingSnap = await collectionRef.get();
  const existingMap = new Map();
  existingSnap.forEach(docSnap => {
    existingMap.set(docSnap.id, docSnap.data());
  });
  console.log(`[Firestore] Found ${existingMap.size} existing template document(s) in collection.\n`);

  // 3. Plan operations
  const plans = [];
  for (const template of SCHEDULE_TEMPLATES) {
    const exists = existingMap.has(template.id);
    plans.push({
      id: template.id,
      title: template.title,
      category: template.category,
      action: exists ? 'update' : 'create',
      data: sanitizeForFirestore({
        ...template,
        updatedAt: new Date().toISOString(),
        ...(exists ? {} : { createdAt: new Date().toISOString() }),
      }),
    });
  }

  console.log('[Plan Summary]');
  for (const p of plans) {
    const badge = p.action === 'create' ? '[NEW]' : '[UPDATE]';
    console.log(`  ${badge.padEnd(9)} ${p.id.padEnd(32)} (${p.category})`);
  }
  console.log();

  if (isDryRun) {
    console.log('[Dry-Run Result] No documents were modified.');
    console.log('To apply these changes to Cloud Firestore, re-run with:');
    console.log('  node scripts/seed-schedule-templates.mjs --apply\n');
    process.exit(0);
  }

  // 4. Execute writes with batching
  console.log('[Execution] Writing templates to Cloud Firestore "scheduleTemplates"...');
  const batch = adminDb.batch();
  for (const p of plans) {
    const docRef = collectionRef.doc(p.id);
    batch.set(docRef, p.data, { merge: true });
  }
  await batch.commit();
  console.log(`[Execution] Successfully committed ${plans.length} template document(s).\n`);

  // 5. Read-Back Verification
  console.log('[Verification] Reading back persisted templates from Cloud Firestore...');
  const verifySnap = await collectionRef.get();
  console.log(`[Verification] Read back ${verifySnap.size} total document(s).`);

  let verifyErrors = 0;
  for (const expected of SCHEDULE_TEMPLATES) {
    const doc = verifySnap.docs.find(d => d.id === expected.id);
    if (!doc) {
      console.error(`  ✕ Missing document in read-back: ${expected.id}`);
      verifyErrors++;
    } else {
      const data = doc.data();
      if (data.title !== expected.title || data.category !== expected.category) {
        console.error(`  ✕ Data mismatch in ${expected.id}: title="${data.title}", category="${data.category}"`);
        verifyErrors++;
      } else {
        console.log(`  ✓ Verified: ${expected.id.padEnd(32)} title="${data.title}"`);
      }
    }
  }

  if (verifyErrors > 0) {
    console.error(`\n[Fatal] Verification failed with ${verifyErrors} mismatch(es).`);
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log(' Bootstrap Completed Successfully!                    ');
  console.log(` Total Templates Seeded: ${SCHEDULE_TEMPLATES.length} `);
  console.log(' Collection: scheduleTemplates                        ');
  console.log(' User accounts touched: ZERO                          ');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('\n[Unhandled Error]', err);
  process.exit(1);
});
