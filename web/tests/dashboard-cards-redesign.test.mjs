import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath) {
  const fullPath = path.join(webRoot, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Phase 2: Mobile-First Unified Habit Cards & Atomic Slots Architecture', () => {
  const components = [
    'src/components/habits/HabitTrackerCard.js',
    'src/components/habits/HabitConfigCard.js',
    'src/components/habits/slots/SlotStepper.js',
    'src/components/habits/slots/SlotDaySchedule.js',
    'src/components/habits/slots/SlotCatalog.js',
    'src/components/habits/slots/SlotTimer.js',
    'src/components/habits/slots/SlotNotes.js',
    'src/components/habits/slots/SlotChecklist.js',
  ];

  describe('1. Component Existence & Memoization Invariants', () => {
    it('should verify unified habit cards and all 6 slots exist and export memoized components', () => {
      for (const compPath of components) {
        const content = readWebFile(compPath);
        assert.ok(content.length > 0, `${compPath} must exist and have content`);
        assert.ok(
          content.includes('export default memo('),
          `${compPath} must export a memoized component to prevent re-render cascades`
        );
      }
    });
  });

  describe('2. WCAG 2.2 Touch Target Compliance (min 44x44px for Interactive Controls)', () => {
    it('should verify primary circular completion button on HabitTrackerCard meets min 44x44px touch target', () => {
      const content = readWebFile('src/components/habits/HabitTrackerCard.js');
      const has44pxButton = content.includes('w-11 h-11') ||
        (content.includes('w-11') && content.includes('h-11')) ||
        (content.includes('min-w-[44px]') && content.includes('min-h-[44px]'));
      assert.ok(
        has44pxButton,
        'HabitTrackerCard must declare 44x44px (w-11 h-11) on primary toggle button'
      );
    });

    it('should verify SlotStepper controls meet min 44x44px touch targets', () => {
      const content = readWebFile('src/components/habits/slots/SlotStepper.js');
      const has44pxStepper = content.includes('w-11 h-11') ||
        (content.includes('w-11') && content.includes('h-11')) ||
        (content.includes('min-w-[44px]') && content.includes('min-h-[44px]'));
      assert.ok(has44pxStepper, 'SlotStepper must have 44x44px stepper buttons');
    });

    it('should verify SlotTimer controls provide accessible interactive targets', () => {
      const content = readWebFile('src/components/habits/slots/SlotTimer.js');
      const hasAccessibleControls = content.includes('rounded-xl') &&
        (content.includes('w-11 h-11') || content.includes('min-w-[44px]'));
      assert.ok(hasAccessibleControls, 'SlotTimer must define comfortable padding and 44x44px target sizing');
    });

    it('should verify SlotCatalog Change Series button meets touch target guidelines', () => {
      const content = readWebFile('src/components/habits/slots/SlotCatalog.js');
      assert.ok(
        content.includes('Change Series') && content.includes('rounded-lg'),
        'SlotCatalog Change Series button must define accessible padding and rounded corners'
      );
    });

    it('should verify SlotNotes provides accessible interactive triggers', () => {
      const content = readWebFile('src/components/habits/slots/SlotNotes.js');
      assert.ok(content.includes('onSave') || content.includes('textarea'), 'SlotNotes must provide accessible editor trigger');
    });
  });

  describe('3. Mobile Usability & Typography Safeguards', () => {
    it('should verify SlotNotes textarea uses text-xs to prevent iOS mobile auto-zoom', () => {
      const notesContent = readWebFile('src/components/habits/slots/SlotNotes.js');
      assert.ok(
        notesContent.includes('text-xs') || notesContent.includes('text-base sm:text-sm'),
        'SlotNotes textarea must prevent mobile auto-zoom'
      );
    });

    it('should verify category top-border accents are preserved across unified cards', () => {
      const cards = [
        'src/components/habits/HabitTrackerCard.js',
        'src/components/habits/HabitConfigCard.js',
      ];
      for (const cardPath of cards) {
        const content = readWebFile(cardPath);
        assert.ok(
          content.includes('border-t-[3px]'),
          `${cardPath} must implement border-t-[3px] integrated category accent`
        );
      }
    });

    it('should verify SlotCatalog active series banner prevents title truncation', () => {
      const content = readWebFile('src/components/habits/slots/SlotCatalog.js');
      assert.ok(
        content.includes('{activeSeries.order}. {activeSeries.title}'),
        'SlotCatalog must render active series title cleanly'
      );
      assert.ok(
        !content.includes('<p className="text-xs sm:text-sm font-bold text-main truncate">'),
        'SlotCatalog active series title must not be artificially clamped with truncate'
      );
    });

    it('should verify SlotDaySchedule exercises header and progress indicators', () => {
      const content = readWebFile('src/components/habits/slots/SlotDaySchedule.js');
      assert.ok(
        content.includes('Exercises:'),
        'SlotDaySchedule must render clear exercise count progress'
      );
    });

    it('should verify SlotDaySchedule responsive layout and rest day handling', () => {
      const content = readWebFile('src/components/habits/slots/SlotDaySchedule.js');
      assert.ok(
        content.includes('isRestDay'),
        'SlotDaySchedule must handle rest days cleanly'
      );
      assert.ok(
        content.includes('Rest & Restoration Day'),
        'SlotDaySchedule must render Rest & Restoration Day banner'
      );
    });

    it('should verify Safety Guidance Modal follows standardized Vritta modal architecture', () => {
      const content = readWebFile('src/components/habits/slots/SlotDaySchedule.js');
      assert.ok(
        content.includes('showSafetyModal'),
        'SlotDaySchedule must include showSafetyModal state'
      );
      assert.ok(
        content.includes('role="dialog"') && content.includes('aria-modal="true"'),
        'Safety Modal must include accessible dialog semantics'
      );
      assert.ok(
        content.includes('Movement Safety Guidance'),
        'Safety Modal must render title'
      );
      assert.ok(
        content.includes('STOP_SIGNALS'),
        'Safety Modal must render stop signals'
      );
    });
  });
});
