import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFrequencyDisplay } from '../src/utils/date-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath) {
  const fullPath = path.join(webRoot, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Phase 3: Habits Routine Manager Redesign & FAB Collision Fix', () => {
  const routineCardPath = 'src/components/habits/HabitManagerCard.js';
  const habitsIndexPath = 'src/components/habits/index.js';
  const habitsPagePath = 'src/app/(protected)/habits/page.js';

  describe('1. Component Architecture & Invariants', () => {
    it('should verify HabitManagerCard exists and exports a memoized component', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(content.length > 0, 'HabitManagerCard.js must exist and not be empty');
      assert.ok(
        content.includes('export default memo(HabitManagerCard)'),
        'HabitManagerCard must export a memoized component to avoid unnecessary re-render cascades'
      );
    });

    it('should verify habits/index.js exports HabitManagerCard', () => {
      const content = readWebFile(habitsIndexPath);
      assert.ok(
        content.includes("export { default as HabitManagerCard } from './HabitManagerCard';"),
        'habits/index.js must export HabitManagerCard'
      );
    });

    it('should verify habits/page.js imports and renders HabitManagerCard or RoutineCard', () => {
      const content = readWebFile(habitsPagePath);
      assert.ok(
        content.includes('HabitManagerCard') || content.includes('RoutineCard'),
        'habits/page.js must import and render HabitManagerCard or RoutineCard'
      );
      assert.ok(
        content.includes('<HabitManagerCard') || content.includes('<RoutineCard'),
        'habits/page.js must render <HabitManagerCard /> or <RoutineCard /> for habits list'
      );
    });
  });

  describe('2. Visual Hierarchy & Category Accent Borders', () => {
    it('should verify RoutineCard applies border-t-[3px] matching Dashboard cards', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(
        content.includes('border-t-[3px]'),
        'RoutineCard must feature the authoritative border-t-[3px] accent border'
      );
      assert.ok(
        content.includes('config.borderTopColor'),
        'RoutineCard must derive category accent color from config.borderTopColor'
      );
    });

    it('should verify title is unconstrained and rendered before metadata', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(
        content.includes('{habit.title}'),
        'RoutineCard must render habit title'
      );
      assert.ok(
        content.includes('text-base sm:text-lg font-bold text-main'),
        'RoutineCard must use authoritative typography for routine titles'
      );
    });
  });

  describe('3. WCAG 2.2 Touch Target Compliance (min 44x44px)', () => {
    it('should verify Edit and Delete action buttons provide accessible touch targets and aria-labels', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(
        (content.includes('w-11 h-11') || content.includes('p-2.5')) && content.includes('rounded-xl'),
        'HabitManagerCard action buttons must provide comfortable target sizing and rounded-xl shape'
      );
      assert.ok(
        content.includes('aria-label={`Edit ${habit.title}`}'),
        'Edit button must provide accessible aria-label'
      );
      assert.ok(
        content.includes('aria-label={`Delete ${habit.title}`}'),
        'Delete button must provide accessible aria-label'
      );
    });

    it('should verify floating action button (FAB) meets min 52x52px touch target', () => {
      const content = readWebFile(habitsPagePath);
      assert.ok(
        content.includes('min-w-[52px]') && content.includes('min-h-[52px]'),
        'FAB must declare minimum 52x52px touch target'
      );
      assert.ok(
        content.includes('aria-label="Add Routine"'),
        'FAB must have accessible aria-label="Add Routine"'
      );
    });
  });

  describe('4. Weekday Selector Streamlining & Recurrence Display', () => {
    it('should format 7-day habits as "Daily"', () => {
      const allSeven = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      assert.equal(getFrequencyDisplay(allSeven), 'Daily');
    });

    it('should format Mon-Fri habits as "Weekdays"', () => {
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      assert.equal(getFrequencyDisplay(weekdays), 'Weekdays');
    });

    it('should format Sat-Sun habits as "Weekends"', () => {
      const weekends = ['Sat', 'Sun'];
      assert.equal(getFrequencyDisplay(weekends), 'Weekends');
    });

    it('should format custom days as comma-separated list', () => {
      const custom = ['Mon', 'Wed', 'Fri'];
      assert.equal(getFrequencyDisplay(custom), 'Mon, Wed, Fri');
    });

    it('should default empty or undefined frequency to "Daily"', () => {
      assert.equal(getFrequencyDisplay([]), 'Daily');
      assert.equal(getFrequencyDisplay(null), 'Daily');
      assert.equal(getFrequencyDisplay(undefined), 'Daily');
    });
  });

  describe('5. Mobile FAB Collision Prevention & Bottom Padding', () => {
    it('should provide generous bottom padding (pb-32 or greater) on habits main element', () => {
      const content = readWebFile(habitsPagePath);
      assert.ok(
        content.includes('pb-32') || content.includes('pb-36'),
        'habits/page.js <main> container must specify pb-32 or pb-36 to clear floating FAB'
      );
    });

    it('should position FAB with z-40 and elevation above bottom navigation', () => {
      const content = readWebFile(habitsPagePath);
      assert.ok(
        content.includes('z-40'),
        'FAB container must declare z-40'
      );
      assert.ok(
        content.includes('bottom-22') || content.includes('bottom-24'),
        'FAB container must be elevated above bottom nav'
      );
    });
  });

  describe('6. Design System & Prohibited Color Audit', () => {
    it('should verify zero occurrences of "purple" or "indigo" in RoutineCard and habits page', () => {
      const files = [routineCardPath, habitsPagePath];
      for (const file of files) {
        const content = readWebFile(file);
        assert.ok(!/purple/i.test(content), `Prohibited color "purple" found in ${file}`);
        assert.ok(!/indigo/i.test(content), `Prohibited color "indigo" found in ${file}`);
      }
    });
  });

  describe('7. Habit Reordering Controls & WCAG Accessibility Invariants', () => {
    it('should verify HabitManagerCard renders Move Up and Move Down buttons in bottom-right corner', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(content.includes('ArrowUp'), 'Must import or render ArrowUp icon');
      assert.ok(content.includes('ArrowDown'), 'Must import or render ArrowDown icon');
      assert.ok(
        content.includes('onMoveUp?.(habit)') || content.includes('onMoveUp'),
        'Must support onMoveUp handler'
      );
      assert.ok(
        content.includes('onMoveDown?.(habit)') || content.includes('onMoveDown'),
        'Must support onMoveDown handler'
      );
    });

    it('should guarantee WCAG 2.2 touch targets (min 44x44px) on reordering controls', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(
        content.includes('min-w-[44px]') && content.includes('min-h-[44px]'),
        'Reordering buttons must enforce min-w-[44px] and min-h-[44px] touch target dimensions'
      );
    });

    it('should declare accessible aria-labels and contextual disabled states on reordering buttons', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(content.includes('aria-label={`Move ${habit.title} up`}'), 'Must have accessible up label');
      assert.ok(content.includes('aria-label={`Move ${habit.title} down`}'), 'Must have accessible down label');
      assert.ok(content.includes('disabled={isFirst || isReordering}'), 'Must disable up button when isFirst or reordering');
      assert.ok(content.includes('disabled={isLast || isReordering}'), 'Must disable down button when isLast or reordering');
      assert.ok(content.includes('disabled:opacity-30'), 'Must visually indicate disabled state');
    });

    it('should verify habits/page.js wires boundary states and reorderingId mutex lock', () => {
      const content = readWebFile(habitsPagePath);
      assert.ok(content.includes('isFirst={index === 0}'), 'Must wire isFirst based on index');
      assert.ok(content.includes('isLast={index === habits.length - 1}'), 'Must wire isLast based on habits length');
      assert.ok(content.includes('isReordering={reorderingId !== null}'), 'Must wire isReordering state');
      assert.ok(content.includes('handleMoveUp'), 'Must wire handleMoveUp handler');
      assert.ok(content.includes('handleMoveDown'), 'Must wire handleMoveDown handler');
      assert.ok(content.includes('if (reorderingId) return;'), 'Must mutex-guard against rapid reordering clicks');
    });
  });
});
