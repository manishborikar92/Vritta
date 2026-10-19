import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const webSrcRoot = path.join(projectRoot, 'web', 'src');

describe('Phase 6: Complete Legacy Decommissioning & Zero-Shims Purity Audit', () => {
  it('should verify the 9 legacy habit card components are deleted', () => {
    const deletedFiles = [
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

    for (const relPath of deletedFiles) {
      const fullPath = path.join(projectRoot, relPath);
      assert.ok(!fs.existsSync(fullPath), `Legacy component file must not exist: ${relPath}`);
    }
  });

  it('should verify quarantined legacy scripts are deleted', () => {
    const deletedScripts = [
      'web/src/lib/server/personal-schedule.js',
      'web/src/lib/analytics/consistency-engine.js',
      'scripts/fetch-personal-schedule.mjs',
      'scripts/migrate-reading-target-minutes.mjs',
    ];

    for (const relPath of deletedScripts) {
      const fullPath = path.join(projectRoot, relPath);
      assert.ok(!fs.existsSync(fullPath), `Quarantined script must not exist: ${relPath}`);
    }
  });

  it('should verify habits barrel exports only authoritative components and zero legacy shims', () => {
    const habitsIndexPath = path.join(webSrcRoot, 'components', 'habits', 'index.js');
    const content = fs.readFileSync(habitsIndexPath, 'utf8');

    const expectedExports = [
      'HabitTrackerCard',
      'HabitConfigCard',
      'HabitModal',
      'OshoLibraryModal',
      'TemplateBrowserModal',
    ];

    for (const exp of expectedExports) {
      assert.ok(content.includes(exp), `habits/index.js must export ${exp}`);
    }

    const uiIndexPath = path.join(webSrcRoot, 'components', 'ui', 'index.js');
    const uiContent = fs.readFileSync(uiIndexPath, 'utf8');
    assert.ok(uiContent.includes('TodayRhythmBanner'), 'ui/index.js must export TodayRhythmBanner');

    const forbiddenIdentifiers = [
      'WorkbookCard',
      'MovementCard',
      'OshoCard',
      'ReadingCard',
      'SpeakingCard',
      'DiaryCard',
      'GenericHabitCard',
      'RoutineCard',
      'HabitAccordion',
    ];

    for (const id of forbiddenIdentifiers) {
      const regex = new RegExp(`\\b${id}\\b`);
      assert.ok(!regex.test(content), `habits/index.js must not export legacy identifier: ${id}`);
    }
  });

  it('should verify zero hardcoded personal email addresses exist in application source code', () => {
    const forbiddenEmails = [
      'manishborikar92@gmail.com',
      'theodinproject0622@gmail.com',
    ];

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(js|jsx|mjs)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const email of forbiddenEmails) {
            assert.ok(
              !content.includes(email),
              `Hardcoded email "${email}" found in ${path.relative(projectRoot, fullPath)}`
            );
          }
        }
      }
    }

    scanDir(webSrcRoot);
  });
});
