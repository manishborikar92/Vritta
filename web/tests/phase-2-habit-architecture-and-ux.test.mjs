import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortHabits } from '../src/utils/date-helpers.js';
import { MANISH_PERSONAL_ROUTINES, DEFAULT_ROUTINES } from '../src/lib/server/schedule-templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath) {
  const fullPath = path.join(webRoot, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Phase 2: Habit Architecture & UX Simplification', () => {
  const habitModalPath = 'src/components/habits/HabitModal.js';
  const routineCardPath = 'src/components/habits/HabitConfigCard.js';
  const dashboardPath = 'src/app/(protected)/dashboard/page.js';
  const useHabitsPath = 'src/hooks/useHabits.js';
  const dateHelpersPath = 'src/utils/date-helpers.js';

  describe('1. Elimination of Title-Based Card Sniffing', () => {
    it('should verify Dashboard renderHabitCard does NOT sniff title substrings', () => {
      const content = readWebFile(dashboardPath);
      assert.ok(
        !content.includes("title.includes('exercise')"),
        'Dashboard must NOT sniff title for "exercise"'
      );
      assert.ok(
        !content.includes("title.includes('movement')"),
        'Dashboard must NOT sniff title for "movement"'
      );
      assert.ok(
        !content.includes("title.includes('workbook')"),
        'Dashboard must NOT sniff title for "workbook"'
      );
      assert.ok(
        !content.includes("title.includes('osho')"),
        'Dashboard must NOT sniff title for "osho"'
      );
      assert.ok(
        !content.includes("title.includes('read books')"),
        'Dashboard must NOT sniff title for "read books"'
      );
      assert.ok(
        !content.includes("title.includes('speaking')"),
        'Dashboard must NOT sniff title for "speaking"'
      );
      assert.ok(
        !content.includes("title.includes('diary')"),
        'Dashboard must NOT sniff title for "diary"'
      );
    });

    it('should verify card dispatch strictly uses canonical stableKey or personal preset origin', () => {
      const content = readWebFile('src/components/habits/HabitTrackerCard.js') + readWebFile(dashboardPath);
      assert.ok(
        content.includes("canonical_english_workbook"),
        'Must dispatch workbook card on canonical key'
      );
      assert.ok(
        content.includes("canonical_exercise_plan"),
        'Must dispatch movement card on canonical key'
      );
      assert.ok(
        content.includes("canonical_listen_osho"),
        'Must dispatch osho card on canonical key'
      );
      assert.ok(
        content.includes("canonical_read_books"),
        'Must dispatch reading card on canonical key'
      );
      assert.ok(
        content.includes("canonical_english_speaking"),
        'Must dispatch speaking card on canonical key'
      );
      assert.ok(
        content.includes("canonical_maintain_diary"),
        'Must dispatch diary card on canonical key'
      );
    });

    it('should verify all canonical routines have stableKey defined in personal schedule', () => {
      assert.equal(MANISH_PERSONAL_ROUTINES.length, 6, 'Must have 6 canonical routines');
      const expectedKeys = [
        'canonical_english_workbook',
        'canonical_exercise_plan',
        'canonical_listen_osho',
        'canonical_read_books',
        'canonical_english_speaking',
        'canonical_maintain_diary',
      ];
      for (const expected of expectedKeys) {
        const found = MANISH_PERSONAL_ROUTINES.find(r => r.stableKey === expected);
        assert.ok(found, `Missing expected canonical routine: ${expected}`);
      }
    });
  });

  describe('2. Removal of Manual Display Order', () => {
    it('should verify RoutineCard does NOT display "#{habit.order}" badge', () => {
      const content = readWebFile(routineCardPath);
      assert.ok(
        !content.includes('#{habit.order}'),
        'RoutineCard must NOT render manual #{habit.order} badge'
      );
      assert.ok(
        !content.includes('#{order}'),
        'RoutineCard must NOT render manual #{order} badge'
      );
    });

    it('should verify HabitModal does NOT expose a "Display Order" input to the user', () => {
      const content = readWebFile(habitModalPath);
      assert.ok(
        !content.includes('>Display Order<'),
        'HabitModal must NOT render Display Order label'
      );
      assert.ok(
        !content.includes("newErrors.order = 'Order must be at least 1'"),
        'HabitModal must NOT validate manual order number'
      );
    });

    it('should verify HabitModal eliminates legacy order in payload', () => {
      const content = readWebFile(habitModalPath);
      assert.ok(
        !content.includes('order: formData.order'),
        'HabitModal must NOT include order in schedule payload'
      );
      assert.ok(
        !content.includes('order: habit?.order'),
        'HabitModal must NOT initialize order from habit.order'
      );
    });
  });

  describe('3. Features Architecture Replacing How to Complete', () => {
    it('should verify HabitModal completely eliminates "How to Complete" from the UI and exposes Features', () => {
      const content = readWebFile(habitModalPath);
      assert.ok(
        !content.includes('How to Complete'),
        'HabitModal must completely eliminate "How to Complete" label and section from the UI'
      );
      assert.ok(
        !content.includes('Tracking / Completion Method'),
        'HabitModal must eliminate confusing "Tracking / Completion Method" label'
      );
      assert.ok(
        content.includes('Features ('),
        'HabitModal must render cohesive "Features" navigation tab'
      );
    });

    it('should expose the six approved composable feature slots in HabitModal', () => {
      const content = readWebFile(habitModalPath);
      assert.ok(content.includes('Counter Stepper'), 'Must offer Counter Stepper slot');
      assert.ok(content.includes('Duration Timer'), 'Must offer Duration Timer slot');
      assert.ok(content.includes('Step-by-Step Checklist'), 'Must offer Step-by-Step Checklist slot');
      assert.ok(content.includes('Notes & Reflection'), 'Must offer Notes & Reflection slot');
      assert.ok(content.includes('Multi-Item Catalog'), 'Must offer Multi-Item Catalog slot');
      assert.ok(content.includes('Progressive Day Schedule'), 'Must offer Progressive Day Schedule slot');
    });

    it('should preserve specialized completion methods when editing canonical routines', () => {
      const content = readWebFile(habitModalPath);
      assert.ok(
        content.includes('SPECIALIZED_COMPLETION_STYLES'),
        'HabitModal must define SPECIALIZED_COMPLETION_STYLES map'
      );
      assert.ok(
        content.includes('workbook_sessions'),
        'Must support workbook_sessions for canonical editing'
      );
      assert.ok(
        content.includes('exercise_plan'),
        'Must support exercise_plan for canonical editing'
      );
    });
  });

  describe('4. Canonical Display Order Architecture (First Added, First Displayed)', () => {
    it('should sort habits strictly by sortOrder ascending', () => {
      const habits = [
        { id: 'h3', title: 'Routine C', sortOrder: 3 },
        { id: 'h1', title: 'Routine A', sortOrder: 1 },
        { id: 'h2', title: 'Routine B', sortOrder: 2 },
      ];

      habits.sort(sortHabits);

      assert.equal(habits[0].title, 'Routine A');
      assert.equal(habits[1].title, 'Routine B');
      assert.equal(habits[2].title, 'Routine C');
    });

    it('should use deterministic creation time and document ID tie-breakers when sortOrder is tied', () => {
      const habits = [
        { id: 'b_doc', title: 'Habit B', sortOrder: 1, createdAt: '2026-10-18T10:05:00Z' },
        { id: 'a_doc', title: 'Habit A', sortOrder: 1, createdAt: '2026-10-18T10:00:00Z' },
        { id: 'c_doc', title: 'Habit C', sortOrder: 1, createdAt: '2026-10-18T10:00:00Z' },
      ];

      habits.sort(sortHabits);

      // Earliest createdAt wins first
      assert.equal(habits[0].id, 'a_doc');
      assert.equal(habits[1].id, 'c_doc');
      assert.equal(habits[2].id, 'b_doc');
    });

    it('should verify useHabits hook applies sortHabits on real-time snapshot', () => {
      const content = readWebFile(useHabitsPath);
      assert.ok(
        content.includes('sortHabits'),
        'useHabits.js must import and use sortHabits'
      );
      assert.ok(
        content.includes('habitsData.sort(sortHabits)'),
        'useHabits.js must sort snapshot documents with sortHabits'
      );
      assert.ok(
        !content.includes('sortHabitsByTiming'),
        'useHabits.js must eliminate obsolete sortHabitsByTiming'
      );
    });

    it('should verify Dashboard renders unified list directly without obsolete timing grouping', () => {
      const content = readWebFile(dashboardPath);
      assert.ok(
        !content.includes('groupedHabits'),
        'Dashboard must completely eliminate groupedHabits'
      );
      assert.ok(
        content.includes('todaysHabits.map(renderHabitCard)'),
        'Dashboard must render todaysHabits directly in canonical order'
      );
      assert.ok(
        !content.includes('Flexible / Anytime'),
        'Dashboard must eliminate hardcoded timing section headers'
      );
    });
  });
});
