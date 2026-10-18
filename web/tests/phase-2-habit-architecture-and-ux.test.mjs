import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTimingSortWeight, sortHabitsByTiming } from '../src/utils/date-helpers.js';
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
  const routineCardPath = 'src/components/habits/HabitManagerCard.js';
  const dashboardPath = 'src/app/(protected)/dashboard/page.js';
  const useHabitsPath = 'src/hooks/use-habits.js';
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
      const content = readWebFile('src/components/habits/DashboardHabitCard.js') + readWebFile(dashboardPath);
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

    it('should verify HabitModal preserves habit.order in payload for backward compatibility', () => {
      const content = readWebFile(habitModalPath);
      assert.ok(
        content.includes('order: habit?.order || 99') || content.includes('habit.order'),
        'HabitModal must preserve existing order in payload for Firestore compatibility'
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

  describe('4. Standardized Timing Rhythm Sorting and Grouping', () => {
    it('should correctly calculate timing sort weights for daily human rhythm', () => {
      // 10: Flexible / Anytime (First position)
      assert.equal(getTimingSortWeight({ timingType: 'anytime' }), 10);
      assert.equal(getTimingSortWeight({ time: 'Flexible' }), 10);
      assert.equal(getTimingSortWeight({}), 10);
      assert.equal(getTimingSortWeight(null), 10);

      // 20: Morning
      assert.equal(getTimingSortWeight({ preferredPeriod: 'Morning' }), 20);
      assert.equal(getTimingSortWeight({ time: 'Morning' }), 20);
      assert.equal(getTimingSortWeight({ relativeTiming: 'After waking' }), 20);
      assert.equal(getTimingSortWeight({ timingType: 'exact', time: '08:00 AM' }), 20);

      // 30: Afternoon
      assert.equal(getTimingSortWeight({ preferredPeriod: 'Afternoon' }), 30);
      assert.equal(getTimingSortWeight({ relativeTiming: 'After lunch' }), 30);
      assert.equal(getTimingSortWeight({ timingType: 'exact', time: '02:00 PM' }), 30);

      // 40: Evening
      assert.equal(getTimingSortWeight({ preferredPeriod: 'Evening' }), 40);
      assert.equal(getTimingSortWeight({ relativeTiming: 'Evening wind-down' }), 40);
      assert.equal(getTimingSortWeight({ timingType: 'exact', time: '07:30 PM' }), 40);

      // 50: Before Bed / Night
      assert.equal(getTimingSortWeight({ relativeTiming: 'Before bed' }), 50);
      assert.equal(getTimingSortWeight({ preferredPeriod: 'Night' }), 50);
      assert.equal(getTimingSortWeight({ time: 'Before bed' }), 50);
      assert.equal(getTimingSortWeight({ timingType: 'exact', time: '10:00 PM' }), 50);
    });

    it('should predictably sort habits by timing sequence with title tie-breaker', () => {
      const habits = [
        { id: '1', title: 'Bedtime Reading', relativeTiming: 'Before bed' },
        { id: '2', title: 'Morning Hydration', preferredPeriod: 'Morning' },
        { id: '3', title: 'English Workbook', time: 'Flexible' },
        { id: '4', title: 'Afternoon Movement', preferredPeriod: 'Afternoon' },
        { id: '5', title: 'Evening Reflection', preferredPeriod: 'Evening' },
      ];

      habits.sort(sortHabitsByTiming);

      assert.equal(habits[0].title, 'English Workbook');
      assert.equal(habits[1].title, 'Morning Hydration');
      assert.equal(habits[2].title, 'Afternoon Movement');
      assert.equal(habits[3].title, 'Evening Reflection');
      assert.equal(habits[4].title, 'Bedtime Reading');
    });

    it('should verify useHabits hook applies sortHabitsByTiming on real-time snapshot', () => {
      const content = readWebFile(useHabitsPath);
      assert.ok(
        content.includes('sortHabitsByTiming'),
        'use-habits.js must import and use sortHabitsByTiming'
      );
      assert.ok(
        content.includes('habitsData.sort(sortHabitsByTiming)'),
        'use-habits.js must sort snapshot documents with sortHabitsByTiming'
      );
    });

    it('should verify Dashboard renders all 5 standardized daily rhythm sections in correct order', () => {
      const content = readWebFile(dashboardPath);
      assert.ok(content.includes('groupedHabits.morning'), 'Must group morning habits');
      assert.ok(content.includes('groupedHabits.afternoon'), 'Must group afternoon habits');
      assert.ok(content.includes('groupedHabits.evening'), 'Must group evening habits');
      assert.ok(content.includes('groupedHabits.beforeBed'), 'Must group before-bed habits');
      assert.ok(content.includes('groupedHabits.flexible'), 'Must group flexible habits');

      // Verify rendering order: Flexible -> Morning -> Afternoon -> Evening -> Before Bed
      const idxFlexible = content.indexOf('groupedHabits.flexible.map');
      const idxMorning = content.indexOf('groupedHabits.morning.map');
      const idxAfternoon = content.indexOf('groupedHabits.afternoon.map');
      const idxEvening = content.indexOf('groupedHabits.evening.map');
      const idxBeforeBed = content.indexOf('groupedHabits.beforeBed.map');

      assert.ok(idxFlexible !== -1 && idxMorning !== -1, 'Flexible and Morning sections must exist in JSX');
      assert.ok(idxFlexible < idxMorning, 'Flexible must render before Morning');
      assert.ok(idxMorning < idxAfternoon, 'Morning must render before Afternoon');
      assert.ok(idxAfternoon < idxEvening, 'Afternoon must render before Evening');
      assert.ok(idxEvening < idxBeforeBed, 'Evening must render before Before Bed');

      // Verify clean section headers
      assert.ok(/Flexible \/ Anytime/.test(content), 'Must render Flexible header');
      assert.ok(/Morning/.test(content), 'Must render Morning section header');
      assert.ok(/Afternoon/.test(content), 'Must render Afternoon header');
      assert.ok(/Evening/.test(content), 'Must render Evening header');
      assert.ok(/Before Bed/.test(content), 'Must render Before Bed header');

      // Verify elimination of arbitrary "Additional Routines" dumping
      assert.ok(
        !content.includes('Additional Routines'),
        'Dashboard must eliminate arbitrary "Additional Routines" section'
      );
    });
  });
});
