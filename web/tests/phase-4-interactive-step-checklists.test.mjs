import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getStepId,
  isStepCompleted,
  calculateChecklistProgress,
  toggleChecklistStep,
  toggleAllChecklistSteps,
  normalizeChecklistItems,
  normalizeCompletedSteps,
} from '../src/utils/checklist-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Phase 4: Interactive Step Checklists & Workout Routine Consolidation', () => {
  describe('1. Checklist & Step Progress Helpers (Pure Invariants)', () => {
    const sampleItems = [
      { id: 'step_water', label: 'Drink 2 glasses of fresh water' },
      { label: '5 minutes of quiet breathing' }, // no id
      { label: 'Gentle neck & shoulder stretch' }, // no id
    ];

    it('should derive stable step IDs consistently', () => {
      // Existing id preserved
      assert.equal(getStepId(sampleItems[0], 0), 'step_water');
      // Label-slug fallback for items without id
      const id1 = getStepId(sampleItems[1], 1);
      assert.ok(id1.startsWith('step_5_minutes_of_quiet'), 'Must derive deterministic content slug');
      // Empty item fallback
      assert.equal(getStepId({}, 2), 'step_2');
      assert.equal(getStepId(null, 3), 'step_3');
    });

    it('should normalize checklist items with stable IDs', () => {
      const raw = [
        { label: 'Step 1' },
        { id: 'custom_id_2', label: 'Step 2' },
        { label: 'Step 1' }, // duplicate label
      ];
      const normalized = normalizeChecklistItems(raw);
      assert.equal(normalized.length, 3);
      assert.equal(normalized[0].id, 'step_step_1');
      assert.equal(normalized[1].id, 'custom_id_2');
      assert.equal(normalized[2].id, 'step_step_1_2', 'Duplicate label must have collision suffix');
      assert.equal(normalized[0].label, 'Step 1');
      assert.equal(normalized[1].label, 'Step 2');
    });

    it('should accurately verify step completion with backward compatibility', () => {
      // By exact id
      assert.ok(isStepCompleted(sampleItems[0], 0, ['step_water'], false));
      assert.ok(!isStepCompleted(sampleItems[0], 0, ['other_step'], false));

      // By numerical index in context
      assert.ok(isStepCompleted(sampleItems[1], 1, [1], false, sampleItems));
      assert.ok(!isStepCompleted(sampleItems[1], 1, [0, 2], false, sampleItems));

      // By stringified index in context
      assert.ok(isStepCompleted(sampleItems[2], 2, ['2'], false, sampleItems));

      // Legacy fallback: habit marked complete with empty completedSteps
      assert.ok(isStepCompleted(sampleItems[0], 0, [], true));
      assert.ok(isStepCompleted(sampleItems[1], 1, null, true));
      assert.ok(!isStepCompleted(sampleItems[0], 0, [], false));
    });

    it('should calculate checklist progress percentage and completion status', () => {
      // Empty items
      assert.deepEqual(
        calculateChecklistProgress([], [], false),
        { completedCount: 0, totalCount: 0, percent: 0, isAllCompleted: false }
      );

      // 0 of 3 completed
      const prog0 = calculateChecklistProgress(sampleItems, [], false);
      assert.equal(prog0.completedCount, 0);
      assert.equal(prog0.totalCount, 3);
      assert.equal(prog0.percent, 0);
      assert.equal(prog0.isAllCompleted, false);

      // 1 of 3 completed (33%)
      const prog1 = calculateChecklistProgress(sampleItems, ['step_water'], false);
      assert.equal(prog1.completedCount, 1);
      assert.equal(prog1.totalCount, 3);
      assert.equal(prog1.percent, 33);
      assert.equal(prog1.isAllCompleted, false);

      // 2 of 3 completed (67%)
      const step1Id = getStepId(sampleItems[1], 1);
      const prog2 = calculateChecklistProgress(sampleItems, ['step_water', step1Id], false);
      assert.equal(prog2.completedCount, 2);
      assert.equal(prog2.percent, 67);
      assert.equal(prog2.isAllCompleted, false);

      // All 3 completed (100%)
      const step2Id = getStepId(sampleItems[2], 2);
      const prog3 = calculateChecklistProgress(sampleItems, ['step_water', step1Id, step2Id], false);
      assert.equal(prog3.completedCount, 3);
      assert.equal(prog3.percent, 100);
      assert.equal(prog3.isAllCompleted, true);
    });

    it('should toggle individual steps and auto-complete when all are checked', () => {
      let state = [];

      // Check step 0
      const res0 = toggleChecklistStep(sampleItems, state, 0, false);
      assert.equal(res0.completedCount, 1);
      assert.equal(res0.isAllCompleted, false);
      assert.ok(res0.nextCompletedSteps.includes('step_water'));
      state = res0.nextCompletedSteps;

      // Check step 1
      const res1 = toggleChecklistStep(sampleItems, state, 1, false);
      assert.equal(res1.completedCount, 2);
      assert.equal(res1.isAllCompleted, false);
      state = res1.nextCompletedSteps;

      // Check step 2 -> all complete!
      const res2 = toggleChecklistStep(sampleItems, state, 2, false);
      assert.equal(res2.completedCount, 3);
      assert.equal(res2.percent, 100);
      assert.equal(res2.isAllCompleted, true, 'Checking last step must trigger isAllCompleted: true');
      state = res2.nextCompletedSteps;

      // Uncheck step 1 -> auto-reverses completion
      const resUncheck = toggleChecklistStep(sampleItems, state, 1, true);
      assert.equal(resUncheck.completedCount, 2);
      assert.equal(resUncheck.isAllCompleted, false, 'Unchecking any step must set isAllCompleted: false');
    });

    it('should seamlessly transition when unchecking a step from a legacy completed state', () => {
      // Habit is legacy completed (isHabitCompleted = true, completedSteps = [])
      // User unchecks step 0
      const res = toggleChecklistStep(sampleItems, [], 0, true);
      assert.equal(res.completedCount, 2, 'Unchecking step 0 leaves the other 2 steps checked');
      assert.equal(res.isAllCompleted, false, 'Habit is now incomplete');
      assert.ok(!res.nextCompletedSteps.includes('step_water'));
      assert.ok(res.nextCompletedSteps.includes(getStepId(sampleItems[1], 1)));
      assert.ok(res.nextCompletedSteps.includes(getStepId(sampleItems[2], 2)));
    });

    it('should support batch toggle for whole habit completion and reset', () => {
      const allDone = toggleAllChecklistSteps(sampleItems, true);
      assert.equal(allDone.completedCount, 3);
      assert.equal(allDone.percent, 100);
      assert.equal(allDone.isAllCompleted, true);
      assert.equal(allDone.nextCompletedSteps.length, 3);

      const allReset = toggleAllChecklistSteps(sampleItems, false);
      assert.equal(allReset.completedCount, 0);
      assert.equal(allReset.percent, 0);
      assert.equal(allReset.isAllCompleted, false);
      assert.deepEqual(allReset.nextCompletedSteps, []);
    });
  });

  describe('2. Legacy Progress Normalization & Mutation Immunity (Concrete Scenarios)', () => {
    const originalChecklist = [
      { id: 'step_A', label: 'Step A' },
      { id: 'step_B', label: 'Step B' },
      { id: 'step_C', label: 'Step C' },
    ];

    it('should safely normalize legacy numeric and string progress to stable IDs', () => {
      // Numeric index 0 maps to step_A
      const normNumeric = normalizeCompletedSteps([0], originalChecklist);
      assert.deepEqual(normNumeric, ['step_A']);

      // String digit index '0' maps to step_A
      const normStringDigit = normalizeCompletedSteps(['0'], originalChecklist);
      assert.deepEqual(normStringDigit, ['step_A']);

      // Legacy index-prefixed slug maps to step_A
      const normSlug = normalizeCompletedSteps(['step_0_step_a'], originalChecklist);
      assert.deepEqual(normSlug, ['step_A']);

      // Canonical stable ID is preserved directly
      const normCanonical = normalizeCompletedSteps(['step_A'], originalChecklist);
      assert.deepEqual(normCanonical, ['step_A']);

      // Out-of-bounds index 99 is discarded
      const normOOB = normalizeCompletedSteps([99], originalChecklist);
      assert.deepEqual(normOOB, []);
    });

    it('Scenario 1: Inserting a step at the beginning must NOT transfer completed state [0] to new step', () => {
      // Initial state: Step A was completed via legacy index [0]
      const legacyLog = [0];

      // Step A's completion is normalized against original checklist
      const normalizedLog = normalizeCompletedSteps(legacyLog, originalChecklist);
      assert.deepEqual(normalizedLog, ['step_A'], 'Must map to step_A before checklist edit');

      // User inserts New Step at index 0
      const editedChecklist = [
        { id: 'step_NEW', label: 'New Step' },
        ...originalChecklist,
      ];

      // Index 0 is now New Step
      assert.equal(editedChecklist[0].id, 'step_NEW');
      assert.equal(
        isStepCompleted(editedChecklist[0], 0, normalizedLog, false, editedChecklist),
        false,
        'CRITICAL: New step at index 0 must NOT be marked complete!'
      );

      // Index 1 is Step A
      assert.equal(editedChecklist[1].id, 'step_A');
      assert.equal(
        isStepCompleted(editedChecklist[1], 1, normalizedLog, false, editedChecklist),
        true,
        'CRITICAL: Step A (now at index 1) must remain complete!'
      );

      // Other steps remain incomplete
      assert.equal(isStepCompleted(editedChecklist[2], 2, normalizedLog, false, editedChecklist), false);
      assert.equal(isStepCompleted(editedChecklist[3], 3, normalizedLog, false, editedChecklist), false);
    });

    it('Scenario 2: Reordering existing steps must NOT transfer completed state [0] to new occupant of index 0', () => {
      // Initial state: Step A completed via legacy log [0]
      const legacyLog = [0];
      const normalizedLog = normalizeCompletedSteps(legacyLog, originalChecklist);

      // User reorders steps: C, B, A
      const reorderedChecklist = [
        originalChecklist[2], // C
        originalChecklist[1], // B
        originalChecklist[0], // A
      ];

      // Index 0 is now Step C
      assert.equal(reorderedChecklist[0].id, 'step_C');
      assert.equal(
        isStepCompleted(reorderedChecklist[0], 0, normalizedLog, false, reorderedChecklist),
        false,
        'Step C occupying index 0 must NOT inherit completion!'
      );

      // Index 1 is Step B
      assert.equal(
        isStepCompleted(reorderedChecklist[1], 1, normalizedLog, false, reorderedChecklist),
        false
      );

      // Index 2 is Step A
      assert.equal(reorderedChecklist[2].id, 'step_A');
      assert.equal(
        isStepCompleted(reorderedChecklist[2], 2, normalizedLog, false, reorderedChecklist),
        true,
        'Step A moved to index 2 must retain its completed state!'
      );
    });

    it('Scenario 3: Verify immunity across all 4 progress representations (numeric, string-digit, index-slug, stable-id)', () => {
      const formats = [
        { name: 'numeric index [0]', input: [0] },
        { name: 'string index ["0"]', input: ['0'] },
        { name: 'legacy index-slug ["step_0_step_a"]', input: ['step_0_step_a'] },
        { name: 'canonical stable ID ["step_A"]', input: ['step_A'] },
      ];

      for (const { name, input } of formats) {
        const normalized = normalizeCompletedSteps(input, originalChecklist);

        // Reorder: B, A, C
        const reordered = [originalChecklist[1], originalChecklist[0], originalChecklist[2]];

        assert.equal(
          isStepCompleted(reordered[0], 0, normalized, false, reordered),
          false,
          `Format ${name}: Step B (index 0) must not be completed`
        );
        assert.equal(
          isStepCompleted(reordered[1], 1, normalized, false, reordered),
          true,
          `Format ${name}: Step A (index 1) must remain completed`
        );
        assert.equal(
          isStepCompleted(reordered[2], 2, normalized, false, reordered),
          false,
          `Format ${name}: Step C (index 2) must not be completed`
        );
      }
    });

    it('Scenario 4: Removing a completed step must NOT silently transfer completion to another step', () => {
      // Step B completed
      const log = ['step_B'];

      // User removes Step B
      const afterRemoval = [originalChecklist[0], originalChecklist[2]]; // A, C

      assert.equal(afterRemoval.length, 2);
      assert.equal(isStepCompleted(afterRemoval[0], 0, log, false, afterRemoval), false);
      assert.equal(isStepCompleted(afterRemoval[1], 1, log, false, afterRemoval), false);

      const progress = calculateChecklistProgress(afterRemoval, log, false);
      assert.equal(progress.completedCount, 0, 'No steps completed after removing completed step');
      assert.equal(progress.percent, 0);
    });

    it('Scenario 5: Renaming a step preserves its ID and progress association', () => {
      const log = ['step_A'];

      // User renames Step A to "Detailed Step A Title"
      const renamed = [
        { ...originalChecklist[0], label: 'Detailed Step A Title' },
        originalChecklist[1],
        originalChecklist[2],
      ];

      // ID is preserved
      assert.equal(renamed[0].id, 'step_A');
      assert.equal(isStepCompleted(renamed[0], 0, log, false, renamed), true);
    });
  });

  describe('3. SlotChecklist Interactive Checklist Architecture', () => {
    it('should verify SlotChecklist exists and exports a memoized component', () => {
      const content = readWebFile('src/components/habits/slots/SlotChecklist.js');
      assert.ok(content.includes('export default memo(SlotChecklist)'));
    });

    it('should verify SlotChecklist accepts progress and onChange props', () => {
      const content = readWebFile('src/components/habits/slots/SlotChecklist.js');
      assert.ok(content.includes('progress = {}'), 'Must accept progress prop');
      assert.ok(content.includes('onChange'), 'Must accept onChange prop');
    });

    it('should verify interactive checkboxes with accessible labels are rendered for steps', () => {
      const content = readWebFile('src/components/habits/slots/SlotChecklist.js');
      assert.ok(content.includes('isStepCompleted'), 'Must evaluate step completed status');
      assert.ok(content.includes('handleStepToggle'), 'Must handle step toggling');
      assert.ok(content.includes('toggleChecklistStep'), 'Must toggle checklist steps with helper');
    });

    it('should verify progress calculation and dynamic progress bar markup in SlotChecklist', () => {
      const content = readWebFile('src/components/habits/slots/SlotChecklist.js');
      assert.ok(
        content.includes('calculateChecklistProgress'),
        'Must calculate checklist progress using authoritative helper'
      );
      assert.ok(
        content.includes('isAllCompleted'),
        'Must track isAllCompleted state'
      );
    });

    it('should verify SlotChecklist normalizes completedSteps against items context', () => {
      const content = readWebFile('src/components/habits/slots/SlotChecklist.js');
      assert.ok(
        content.includes('normalizeCompletedSteps(rawCompletedSteps, items)'),
        'SlotChecklist must normalize completedSteps against items'
      );
    });

    it('should verify SlotChecklist does not write redundant completedCount or totalCount to progress payloads', () => {
      const content = readWebFile('src/components/habits/slots/SlotChecklist.js');
      assert.ok(
        !content.includes('completedCount: nextCompletedSteps.length'),
        'Must not write redundant completedCount to progress payloads'
      );
      assert.ok(
        !content.includes('totalCount: items.length'),
        'Must not write redundant totalCount to progress payloads'
      );
    });

    it('should verify primary circular completion button satisfies min 44x44px touch target on DashboardHabitCard', () => {
      const content = readWebFile('src/components/habits/DashboardHabitCard.js');
      assert.ok(
        content.includes('w-11 h-11') || content.includes('min-h-[44px]'),
        'Primary toggle button must satisfy 44x44px WCAG touch target'
      );
    });

    it('should verify zero prohibited colors in SlotChecklist', () => {
      const content = readWebFile('src/components/habits/slots/SlotChecklist.js');
      const prohibited = [
        'bg-indigo-', 'text-indigo-', 'border-indigo-',
        'bg-purple-', 'text-purple-', 'border-purple-',
        'bg-blue-600', 'text-blue-600',
      ];
      for (const token of prohibited) {
        assert.ok(!content.includes(token), `SlotChecklist must not use prohibited token: ${token}`);
      }
    });
  });

  describe('4. DashboardPage Card Dispatch & Wiring', () => {
    it('should verify DashboardPage passes progress and onUpdateProgress to habit card', () => {
      const content = readWebFile('src/app/(protected)/dashboard/page.js');
      assert.ok(
        (content.includes('<DashboardHabitCard') || content.includes('<GenericHabitCard')) &&
        content.includes('progress={progress}') &&
        content.includes('onUpdateProgress={updateProgress}'),
        'DashboardPage must pass progress and onUpdateProgress to habit card'
      );
    });
  });

  describe('5. HabitModal Step ID Stability, Renaming, and Reordering', () => {
    it('should verify HabitModal ensures stable IDs and normalizes checklist items', () => {
      const content = readWebFile('src/components/habits/HabitModal.js');
      assert.ok(
        content.includes('normalizeChecklistItems'),
        'HabitModal must use normalizeChecklistItems'
      );
      assert.ok(
        content.includes('updateChecklistItemLabel'),
        'HabitModal must allow editing checklist step descriptions'
      );
      assert.ok(
        content.includes('moveChecklistItem'),
        'HabitModal must support reordering checklist steps'
      );
    });
  });

  describe('6. Workout Routine Coordination (SlotDaySchedule)', () => {
    it('should verify SlotDaySchedule dispatches clean progress payload without redundant counters', () => {
      const content = readWebFile('src/components/habits/slots/SlotDaySchedule.js');
      assert.ok(
        content.includes('completedItemIds') || content.includes('updatedIds'),
        'SlotDaySchedule must emit completed item IDs'
      );
      assert.ok(
        !content.includes('completedCount: updatedIds.length'),
        'SlotDaySchedule must NOT write redundant completedCount to database'
      );
      assert.ok(
        !content.includes('totalCount: currentItems.length'),
        'SlotDaySchedule must NOT write redundant totalCount to database'
      );
    });

    it('should verify SlotDaySchedule preserves workout progression and safety rules', () => {
      const content = readWebFile('src/components/habits/slots/SlotDaySchedule.js');
      assert.ok(content.includes('MOVEMENT_SCHEDULE'), 'SlotDaySchedule must preserve MOVEMENT_SCHEDULE');
      assert.ok(content.includes('WORKOUT_EXERCISES'), 'SlotDaySchedule must preserve WORKOUT_EXERCISES');
      assert.ok(content.includes('STOP_SIGNALS'), 'SlotDaySchedule must preserve STOP_SIGNALS');
      assert.ok(content.includes('isRestDay') || content.includes('Sun'), 'SlotDaySchedule must preserve planned rest day logic');
    });
  });

  describe('7. End-to-End Simulation of Real-World User Workflows', () => {
    it('should simulate partial step completion, persistence, rename, reorder, auto-complete, and uncheck', () => {
      const habitId = 'habit_custom_routine';

      // 1. User creates a checklist habit with 3 steps
      const habitDefinition = {
        id: habitId,
        title: 'Morning Awakening Routine',
        category: 'Reflection',
        checklistItems: normalizeChecklistItems([
          { label: 'Drink 500ml water' },
          { label: '5 minutes mindfulness breathing' },
          { label: 'Joint mobility stretches' },
        ]),
      };

      const step1Id = habitDefinition.checklistItems[0].id;
      const step2Id = habitDefinition.checklistItems[1].id;
      const step3Id = habitDefinition.checklistItems[2].id;

      assert.ok(step1Id && step2Id && step3Id, 'All steps must have stable IDs');

      // 2. User completes only step 1
      let todayLog = [];
      let habitProgress = {};

      const step1Result = toggleChecklistStep(habitDefinition.checklistItems, [], 0, false);
      habitProgress[habitId] = { completedSteps: step1Result.nextCompletedSteps };
      if (step1Result.isAllCompleted) todayLog.push(habitId);

      assert.equal(todayLog.includes(habitId), false, 'Habit is not completed yet with 1 of 3 steps');
      assert.deepEqual(habitProgress[habitId].completedSteps, [step1Id]);

      // 3. User navigates away and reloads (state restored from storage)
      const restoredCompletedSteps = [...habitProgress[habitId].completedSteps];
      assert.ok(
        isStepCompleted(habitDefinition.checklistItems[0], 0, restoredCompletedSteps, false, habitDefinition.checklistItems),
        'Step 1 must remain completed across navigation and reload'
      );
      assert.ok(
        !isStepCompleted(habitDefinition.checklistItems[1], 1, restoredCompletedSteps, false, habitDefinition.checklistItems),
        'Step 2 must remain incomplete'
      );

      // 4. User renames step 1 to 'Drink 750ml lukewarm water'
      habitDefinition.checklistItems[0].label = 'Drink 750ml lukewarm water';
      // Step ID is unchanged!
      assert.equal(habitDefinition.checklistItems[0].id, step1Id);
      // Progress remains associated!
      assert.ok(
        isStepCompleted(habitDefinition.checklistItems[0], 0, restoredCompletedSteps, false, habitDefinition.checklistItems),
        'Renamed step must remain completed'
      );

      // 5. User reorders: moves step 1 down to index 1
      const reorderedItems = [
        habitDefinition.checklistItems[1],
        habitDefinition.checklistItems[0],
        habitDefinition.checklistItems[2],
      ];
      // Index 0 is now mindfulness breathing (incomplete)
      assert.ok(!isStepCompleted(reorderedItems[0], 0, restoredCompletedSteps, false, reorderedItems));
      // Index 1 is water (completed)
      assert.ok(isStepCompleted(reorderedItems[1], 1, restoredCompletedSteps, false, reorderedItems));

      // 6. User completes all remaining steps
      const step2Result = toggleChecklistStep(reorderedItems, restoredCompletedSteps, 0, false);
      const step3Result = toggleChecklistStep(reorderedItems, step2Result.nextCompletedSteps, 2, false);

      habitProgress[habitId] = { completedSteps: step3Result.nextCompletedSteps };
      if (step3Result.isAllCompleted) todayLog.push(habitId);

      assert.ok(todayLog.includes(habitId), 'Completing every step triggers automatic habit completion');
      assert.equal(step3Result.percent, 100);

      // 7. User unchecks one step
      const uncheckResult = toggleChecklistStep(reorderedItems, habitProgress[habitId].completedSteps, 1, true);
      habitProgress[habitId] = { completedSteps: uncheckResult.nextCompletedSteps };
      if (!uncheckResult.isAllCompleted) {
        todayLog = todayLog.filter(id => id !== habitId);
      }

      assert.ok(!todayLog.includes(habitId), 'Unchecking any step marks overall habit incomplete');
      assert.equal(uncheckResult.completedCount, 2);

      // 8. User clicks overall habit toggle to mark all complete
      const batchComplete = toggleAllChecklistSteps(reorderedItems, true);
      habitProgress[habitId] = { completedSteps: batchComplete.nextCompletedSteps };
      todayLog.push(habitId);

      assert.equal(batchComplete.completedCount, 3);
      assert.equal(batchComplete.percent, 100);
      assert.ok(todayLog.includes(habitId));

      // 9. User clicks overall habit toggle to mark all incomplete
      const batchReset = toggleAllChecklistSteps(reorderedItems, false);
      habitProgress[habitId] = { completedSteps: batchReset.nextCompletedSteps };
      todayLog = todayLog.filter(id => id !== habitId);

      assert.equal(batchReset.completedCount, 0);
      assert.deepEqual(habitProgress[habitId].completedSteps, []);
      assert.ok(!todayLog.includes(habitId));
    });
  });
});
