#!/usr/bin/env node
/**
 * scripts/audit-zero-shims.mjs
 *
 * Automated verification of zero legacy shims and zero backward-compatibility debt.
 * Section 7.4 & Acceptance Criterion 5 of Vritta Transformation Plan.
 *
 * Audits:
 * 1. Absence of deleted component files in web/src/components/habits/
 * 2. Absence of deleted module files in web/src/lib/server/ and scripts/
 * 3. Absence of legacy card component imports/exports in web/src/
 * 4. Absence of hardcoded user emails in web/src/
 * 5. Clean index exports from web/src/components/habits/index.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const webSrcRoot = path.join(projectRoot, 'web', 'src');

console.log('='.repeat(70));
console.log('VRITTA PHASE 6 ZERO-SHIMS & ARCHITECTURAL PURITY AUDIT');
console.log('='.repeat(70));

let violationsCount = 0;

// 1. Deleted Component Files
const DELETED_COMPONENT_FILES = [
  'web/src/components/habits/WorkbookCard.js',
  'web/src/components/habits/MovementCard.js',
  'web/src/components/habits/OshoCard.js',
  'web/src/components/habits/ReadingCard.js',
  'web/src/components/habits/SpeakingCard.js',
  'web/src/components/habits/DiaryCard.js',
  'web/src/components/habits/GenericHabitCard.js',
  'web/src/components/habits/RoutineCard.js',
  'web/src/components/habits/HabitCard.js',
];

console.log('\n[Check 1] Verifying absence of deleted legacy component files...');
for (const relPath of DELETED_COMPONENT_FILES) {
  const fullPath = path.join(projectRoot, relPath);
  if (fs.existsSync(fullPath)) {
    console.error(`  FAIL: Legacy file still exists: ${relPath}`);
    violationsCount++;
  } else {
    console.log(`  PASS: Correctly absent: ${relPath}`);
  }
}

// 2. Deleted Scripts and Quarantined Modules
const DELETED_SCRIPTS = [
  'web/src/lib/server/personal-schedule.js',
  'web/src/lib/analytics/consistency-engine.js',
  'scripts/fetch-personal-schedule.mjs',
  'scripts/migrate-reading-target-minutes.mjs',
  'scripts/cleanup-obsolete-slot-flags.mjs',
  'scripts/migrate-composable-habits.mjs',
  'scripts/rollback-composable-habits.mjs',
  'scripts/verify-migration-integrity.mjs',
];

console.log('\n[Check 2] Verifying absence of quarantined modules and one-off scripts...');
for (const relPath of DELETED_SCRIPTS) {
  const fullPath = path.join(projectRoot, relPath);
  if (fs.existsSync(fullPath)) {
    console.error(`  FAIL: Quarantined script still exists: ${relPath}`);
    violationsCount++;
  } else {
    console.log(`  PASS: Correctly absent: ${relPath}`);
  }
}

// 3. Scan web/src for legacy component names
const FORBIDDEN_COMPONENT_IDENTIFIERS = [
  'WorkbookCard',
  'MovementCard',
  'OshoCard',
  'ReadingCard',
  'SpeakingCard',
  'DiaryCard',
  'GenericHabitCard',
  'RoutineCard',
  'HabitCard',
];

console.log('\n[Check 3] Scanning web/src/ for legacy component identifiers...');
function scanDir(dir, fileCallback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, fileCallback);
    } else if (/\.(js|jsx|mjs)$/.test(entry.name)) {
      fileCallback(fullPath);
    }
  }
}

let componentMatchCount = 0;
scanDir(webSrcRoot, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(projectRoot, filePath);
  for (const id of FORBIDDEN_COMPONENT_IDENTIFIERS) {
    // Look for imports or JSX tags of the forbidden component
    const importRegex = new RegExp(`(import|export)\\s+.*\\b${id}\\b`, 'g');
    const jsxRegex = new RegExp(`<${id}\\b`, 'g');
    if (importRegex.test(content) || jsxRegex.test(content)) {
      console.error(`  FAIL: Found forbidden identifier "${id}" in ${relPath}`);
      componentMatchCount++;
      violationsCount++;
    }
  }
});
if (componentMatchCount === 0) {
  console.log('  PASS: Zero imports, exports, or JSX usages of legacy card components found in web/src/');
}

// 4. Hardcoded Personal Accounts Audit
const FORBIDDEN_STRINGS = [
  'manishborikar92@gmail.com',
  'theodinproject0622@gmail.com',
];

console.log('\n[Check 4] Scanning web/src/ for hardcoded personal emails...');
let emailMatchCount = 0;
scanDir(webSrcRoot, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(projectRoot, filePath);
  for (const str of FORBIDDEN_STRINGS) {
    if (content.includes(str)) {
      console.error(`  FAIL: Hardcoded email "${str}" found in ${relPath}`);
      emailMatchCount++;
      violationsCount++;
    }
  }
});
if (emailMatchCount === 0) {
  console.log('  PASS: Zero occurrences of personal email addresses found in application source code');
}

// 5. Audit habits barrel exports
console.log('\n[Check 5] Auditing web/src/components/habits/index.js exports...');
const habitsIndexPath = path.join(webSrcRoot, 'components', 'habits', 'index.js');
const habitsIndexContent = fs.readFileSync(habitsIndexPath, 'utf8');

const expectedExports = [
  'HabitTrackerCard',
  'HabitConfigCard',
  'HabitModal',
  'OshoLibraryModal',
  'TemplateBrowserModal',
];

let barrelClean = true;
for (const exp of expectedExports) {
  if (!habitsIndexContent.includes(exp)) {
    console.error(`  FAIL: Expected export "${exp}" missing from habits barrel`);
    barrelClean = false;
    violationsCount++;
  }
}
if (habitsIndexContent.includes('TodayRhythmBanner')) {
  console.error('  FAIL: TodayRhythmBanner should be in ui barrel, not habits barrel');
  barrelClean = false;
  violationsCount++;
}
for (const id of FORBIDDEN_COMPONENT_IDENTIFIERS) {
  const wordBoundaryRegex = new RegExp(`\\b${id}\\b`);
  if (wordBoundaryRegex.test(habitsIndexContent)) {
    console.error(`  FAIL: Legacy component "${id}" found in habits barrel export`);
    barrelClean = false;
    violationsCount++;
  }
}
if (barrelClean) {
  console.log('  PASS: habits/index.js contains only authoritative modern exports and zero legacy shims');
}

// 6. Audit UI barrel exports for TodayRhythmBanner
console.log('\n[Check 6] Auditing web/src/components/ui/index.js exports...');
const uiIndexPath = path.join(webSrcRoot, 'components', 'ui', 'index.js');
const uiIndexContent = fs.readFileSync(uiIndexPath, 'utf8');
if (uiIndexContent.includes('TodayRhythmBanner')) {
  console.log('  PASS: ui/index.js properly exports TodayRhythmBanner');
} else {
  console.error('  FAIL: ui/index.js missing TodayRhythmBanner export');
  violationsCount++;
}

console.log('\n' + '='.repeat(70));
if (violationsCount === 0) {
  console.log('RESULT: 100% PASS - Codebase is clean, decoupled, and free of legacy shims.');
  console.log('='.repeat(70));
  process.exit(0);
} else {
  console.error(`RESULT: FAILED with ${violationsCount} violations.`);
  console.log('='.repeat(70));
  process.exit(1);
}
