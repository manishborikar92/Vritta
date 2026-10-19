import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath) {
  const filePath = path.join(webRoot, relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

function getAllJsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllJsFiles(fullPath));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Phase 3: UI/UX Component Polish (Mobile-First)', () => {

  describe('1. Legacy Color & Heather Purple Elimination', () => {
    const targetDirs = [
      path.join(webRoot, 'src', 'app', '(protected)'),
      path.join(webRoot, 'src', 'components', 'habits'),
      path.join(webRoot, 'src', 'components', 'ui'),
    ];

    it('should verify zero occurrences of "purple" across all protected routes and components', () => {
      const files = targetDirs.flatMap(getAllJsFiles);
      const violations = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (/purple/i.test(content)) {
          violations.push(path.relative(webRoot, file));
        }
      }

      assert.deepEqual(violations, [], `Prohibited color "purple" found in files: ${violations.join(', ')}`);
    });

    it('should verify zero occurrences of "indigo" across all protected routes and components', () => {
      const files = targetDirs.flatMap(getAllJsFiles);
      const violations = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (/indigo/i.test(content)) {
          violations.push(path.relative(webRoot, file));
        }
      }

      assert.deepEqual(violations, [], `Legacy color "indigo" found in files: ${violations.join(', ')}`);
    });

    it('should verify categories.js completely eliminates purple and indigo and defines dark mode tokens', () => {
      const categoriesContent = readWebFile('src/lib/constants/categories.js');
      assert.ok(!/purple/i.test(categoriesContent), 'categories.js must not contain purple');
      assert.ok(!/indigo/i.test(categoriesContent), 'categories.js must not contain indigo');

      // Verify Recovery category uses teal tokens
      assert.ok(categoriesContent.includes("border-l-teal-600"), 'Recovery category must use teal border accent');
      assert.ok(categoriesContent.includes("bg-teal-50"), 'Recovery category must use teal background');

      // Verify dark mode classes exist in badgeClasses
      assert.ok(categoriesContent.includes("dark:bg-slate-800"), 'Category badges must declare dark background tokens');
      assert.ok(categoriesContent.includes("dark:text-slate-300"), 'Category badges must declare dark text tokens');
    });
  });

  describe('2. WCAG 2.2 Target Size (min 44x44px for primary mobile actions)', () => {
    it('should verify HabitTrackerCard defines 44x44px toggle buttons', () => {
      const content = readWebFile('src/components/habits/HabitTrackerCard.js');
      const has44pxCheckmark = content.includes('w-11 h-11') ||
        (content.includes('w-11') && content.includes('h-11')) ||
        (content.includes('min-w-[44px]') && content.includes('min-h-[44px]'));
      assert.ok(
        has44pxCheckmark,
        'HabitTrackerCard must specify 44x44px (w-11 h-11) on primary toggle button'
      );
    });

    it('should verify SlotStepper buttons meet WCAG 2.2 touch target standards (min 44x44px)', () => {
      const content = readWebFile('src/components/habits/slots/SlotStepper.js');
      const has44pxStepper = content.includes('w-11 h-11') ||
        (content.includes('w-11') && content.includes('h-11')) ||
        (content.includes('min-w-[44px]') && content.includes('min-h-[44px]'));
      assert.ok(has44pxStepper, 'SlotStepper must specify 44x44px (w-11 h-11)');
    });

    it('should verify BottomNav items meet touch target accessibility guidelines', () => {
      const content = readWebFile('src/components/ui/navigation/BottomNav.js');
      assert.ok(content.includes('py-1.5'), 'BottomNav links must define comfortable vertical padding');
      assert.ok(content.includes('min-h-[52px]') || content.includes('min-w-[56px]'), 'BottomNav links must meet touch target guidelines');
    });

    it('should verify Routine Manager actions meet minimum touch targets in HabitConfigCard', () => {
      const content = readWebFile('src/components/habits/HabitConfigCard.js');
      assert.ok(
        (content.includes('w-11 h-11') || content.includes('p-2.5')) && content.includes('rounded-xl'),
        'Habit action buttons must provide comfortable touch targets and rounded-xl styling'
      );
    });
  });

  describe('3. Brand Color Application & Dark Mode Integration', () => {
    it('should verify TodayRhythmBanner integrates Warm Amber #D97706 and teal completed badge', () => {
      const content = readWebFile('src/components/ui/banners/TodayRhythmBanner.js');
      assert.ok(content.includes('text-amber-600') && content.includes('dark:text-amber-400'), 'TodayRhythmBanner must use Warm Amber text');
      assert.ok(content.includes('text-teal-700') && content.includes('dark:text-teal-300'), 'TodayRhythmBanner must use teal completed badge');
      assert.ok(content.includes('dark:via-surface') || content.includes('dark:bg-slate-800'), 'TodayRhythmBanner must support dark background');
    });

    it('should verify BottomNav applies Luminous Teal active state and Deep Obsidian backdrop', () => {
      const content = readWebFile('src/components/ui/navigation/BottomNav.js');
      assert.ok(
        (content.includes('text-teal-700') && content.includes('dark:text-teal-300')) || content.includes('text-accent'),
        'BottomNav active text must be teal or semantic accent'
      );
      assert.ok(
        (content.includes('bg-teal-50') && content.includes('dark:bg-teal-950/60')) || content.includes('bg-accent-subtle'),
        'BottomNav active background must be teal or semantic accent subtle'
      );
      assert.ok(content.includes('bg-surface') || content.includes('dark:bg-[#090D16]/95'), 'BottomNav bar must use Deep Obsidian or semantic surface backdrop in dark mode');
    });

    it('should verify LoadingSpinner supports semantic tokens and Skeleton supports semantic dark mode tokens', () => {
      const spinnerContent = readWebFile('src/components/ui/feedback/LoadingSpinner.js');
      assert.ok(spinnerContent.includes('dark:border-t-teal-400'), 'LoadingSpinner must support dark mode ring');
      const skeletonContent = readWebFile('src/components/ui/feedback/Skeleton.js');
      assert.ok(skeletonContent.includes('dark:bg-slate-800/70'), 'Skeleton must support dark mode surface token');
    });

    it('should verify ConfirmDialog supports dark mode and teal styling for non-danger dialogs', () => {
      const content = readWebFile('src/components/ui/dialogs/ConfirmDialog.js');
      assert.ok(content.includes('bg-surface') || content.includes('dark:bg-slate-900'), 'ConfirmDialog card must support dark mode');
      assert.ok(content.includes('bg-teal-100') && content.includes('bg-teal-600'), 'ConfirmDialog non-danger must use teal');
      assert.ok(content.includes('py-2.5') && content.includes('flex-1'), 'ConfirmDialog buttons must satisfy touch target padding and full width');
    });

    it('should verify protected layout container applies Deep Obsidian in dark mode', () => {
      const content = readWebFile('src/app/(protected)/layout.js');
      assert.ok(content.includes('bg-canvas') || content.includes('dark:bg-[#090D16]'), 'Protected layout container must use Deep Obsidian or semantic canvas in dark mode');
    });

    it('should verify all major views implement comprehensive dark mode surfaces and borders', () => {
      const views = [
        'src/app/(protected)/today/page.js',
        'src/app/(protected)/habits/page.js',
        'src/app/(protected)/insights/page.js',
      ];

      for (const view of views) {
        const content = readWebFile(view);
        assert.ok(content.includes('dark:bg-'), `${view} must include dark background classes`);
        assert.ok(content.includes('dark:border-'), `${view} must include dark border classes`);
        assert.ok(content.includes('dark:text-'), `${view} must include dark text classes`);
      }
    });
  });
});
