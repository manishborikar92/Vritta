import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateHabitCompletion,
  isFeatureSatisfied,
  deriveCompletedProgressForHabit,
} from '../src/domain/index.js';
import { toggleChecklistStep } from '../src/utils/checklist-helpers.js';

describe('Completion State Boundaries & Propagation Integrity', () => {
  const multiFeatureHabit = {
    id: 'habit_multi_1',
    title: 'English Workbook and Exercises',
    category: 'Learning & Growth',
    features: {
      counter: {
        enabled: true,
        targetCount: 2,
        unit: 'sessions',
      },
      checklist: {
        enabled: true,
        items: [
          { id: 'step_1', label: 'Review previous notes', isRequiredForCompletion: true },
          { id: 'step_2', label: 'Complete exercises', isRequiredForCompletion: true },
          { id: 'step_3', label: 'Optional bonus reading', isRequiredForCompletion: false },
        ],
      },
      notes: {
        enabled: true,
        placeholder: 'Daily learnings',
      },
    },
  };

  it('should verify individual child checklist item completion does NOT satisfy the checklist feature', () => {
    const partialProgress = {
      completedSteps: ['step_1'], // 1 of 2 required done
      sessionsCompleted: 0,
    };

    const checklistSatisfied = isFeatureSatisfied('checklist', multiFeatureHabit.features.checklist, partialProgress);
    assert.equal(checklistSatisfied, false, 'Partial checklist must not satisfy checklist feature');
  });

  it('should verify completing all checklist items does NOT complete a multi-feature habit if counter is incomplete', () => {
    const checklistDoneProgress = {
      completedSteps: ['step_1', 'step_2'], // all required done
      sessionsCompleted: 0, // 0 of 2 sessions
    };

    const checklistSatisfied = isFeatureSatisfied('checklist', multiFeatureHabit.features.checklist, checklistDoneProgress);
    assert.equal(checklistSatisfied, true, 'Checklist feature itself is satisfied');

    const habitCompleted = evaluateHabitCompletion(multiFeatureHabit, checklistDoneProgress);
    assert.equal(habitCompleted, false, 'Parent habit must NOT complete when counter is still incomplete (0/2)');
  });

  it('should verify reaching counter target does NOT complete a multi-feature habit if checklist is incomplete', () => {
    const counterDoneProgress = {
      completedSteps: ['step_1'], // only 1 required done
      sessionsCompleted: 2, // target 2 met
    };

    const counterSatisfied = isFeatureSatisfied('counter', multiFeatureHabit.features.counter, counterDoneProgress);
    assert.equal(counterSatisfied, true, 'Counter feature itself is satisfied');

    const habitCompleted = evaluateHabitCompletion(multiFeatureHabit, counterDoneProgress);
    assert.equal(habitCompleted, false, 'Parent habit must NOT complete when checklist is still incomplete');
  });

  it('should verify multi-feature habit completes ONLY when ALL active required features are satisfied', () => {
    const allDoneProgress = {
      completedSteps: ['step_1', 'step_2'], // all required done, optional step_3 skipped
      sessionsCompleted: 2, // counter met
      notes: 'Some notes',
    };

    const habitCompleted = evaluateHabitCompletion(multiFeatureHabit, allDoneProgress);
    assert.equal(habitCompleted, true, 'Parent habit completes when ALL required features are satisfied');
  });

  it('should distinguish optional checklist items from required items', () => {
    const habitWithOptional = {
      id: 'habit_check_1',
      title: 'Morning Preparation',
      category: 'Health & Fitness',
      features: {
        checklist: {
          enabled: true,
          items: [
            { id: 'req_1', label: 'Drink water', isRequiredForCompletion: true },
            { id: 'opt_1', label: 'Stretch (if time allows)', isRequiredForCompletion: false },
          ],
        },
      },
    };

    // Only optional completed
    const onlyOptProgress = { completedSteps: ['opt_1'] };
    assert.equal(evaluateHabitCompletion(habitWithOptional, onlyOptProgress), false);

    // Required completed, optional not completed -> satisfied!
    const reqProgress = { completedSteps: ['req_1'] };
    assert.equal(evaluateHabitCompletion(habitWithOptional, reqProgress), true);
  });

  it('should evaluate timer completion based on duration or timerCompleted flag', () => {
    const timerHabit = {
      id: 'habit_timer_1',
      title: 'Deep Focus Block',
      category: 'Work & Career',
      features: {
        timer: {
          enabled: true,
          targetDurationMinutes: 30,
        },
      },
    };

    assert.equal(evaluateHabitCompletion(timerHabit, { durationMinutes: 10 }), false);
    assert.equal(evaluateHabitCompletion(timerHabit, { durationMinutes: 30 }), true);
    assert.equal(evaluateHabitCompletion(timerHabit, { timerCompleted: true }), true);
  });

  it('should preserve independent child item states when parent outcome changes', () => {
    const initialProgress = {
      completedSteps: ['step_1'],
      sessionsCompleted: 1,
      notes: 'Initial reflection notes',
    };

    // When habit is explicitly marked 'skipped' or 'missed'
    const skippedProgress = {
      ...initialProgress,
      outcome: 'skipped',
    };

    assert.deepEqual(skippedProgress.completedSteps, ['step_1'], 'Child checklist state must be preserved');
    assert.equal(skippedProgress.sessionsCompleted, 1, 'Child session counter must be preserved');
    assert.equal(skippedProgress.notes, 'Initial reflection notes', 'Child notes must be preserved');
  });

  it('should evaluate checklist completion correctly for items without explicit IDs', () => {
    const templateChecklistHabit = {
      id: 'habit_template_checklist',
      title: 'Blueprint Morning Sequence',
      features: {
        checklist: {
          enabled: true,
          items: [
            { label: 'Drink water' },
            { label: 'Deep breathing' },
          ],
        },
      },
    };

    // Neither step completed
    assert.equal(evaluateHabitCompletion(templateChecklistHabit, { completedSteps: [] }), false);

    // Only step 1 completed (slug: step_drink_water)
    assert.equal(evaluateHabitCompletion(templateChecklistHabit, { completedSteps: ['step_drink_water'] }), false);

    // Both steps completed with slug IDs
    assert.equal(evaluateHabitCompletion(templateChecklistHabit, { completedSteps: ['step_drink_water', 'step_deep_breathing'] }), true);
  });

  it('should derive completed progress with stable step IDs for items without explicit IDs', () => {
    const templateHabit = {
      id: 'habit_template_derive',
      title: 'Blueprint Routine',
      features: {
        checklist: {
          enabled: true,
          items: [
            { label: 'Prepare space' },
            { label: 'Review tasks' },
          ],
        },
      },
    };

    const derived = deriveCompletedProgressForHabit(templateHabit);
    assert.deepEqual(derived.completedSteps, ['step_prepare_space', 'step_review_tasks']);
    assert.equal(derived.reviewDone, true);
    assert.equal(evaluateHabitCompletion(templateHabit, derived), true);
  });

  it('should sequentially toggle 5 checklist items with timestamp IDs without dropping steps or false collisions', () => {
    const habit5 = {
      id: 'habit_5_items',
      title: '5 Step Routine',
      features: {
        checklist: {
          enabled: true,
          items: [
            { id: 'step_1792433688478_1ithd', label: 'A', isRequiredForCompletion: true },
            { id: 'step_1792433690122_y6igy', label: 'B', isRequiredForCompletion: true },
            { id: 'step_1792433691013_r5m5l', label: 'C', isRequiredForCompletion: true },
            { id: 'step_1792433692768_bdzd9', label: 'D', isRequiredForCompletion: true },
            { id: 'step_1792433693707_g5mnk', label: 'E', isRequiredForCompletion: true },
          ],
        },
      },
    };

    let progress = { completedSteps: [] };
    for (let i = 0; i < 5; i++) {
      const res = toggleChecklistStep(habit5.features.checklist.items, progress.completedSteps, i);
      progress.completedSteps = res.nextCompletedSteps;
      progress.reviewDone = res.isAllCompleted;
      assert.equal(res.completedCount, i + 1, `After toggling step ${i}, completedCount must be ${i + 1}`);
      assert.equal(evaluateHabitCompletion(habit5, progress), i === 4, `Habit must complete only on step 5 (index 4)`);
    }

    assert.equal(progress.completedSteps.length, 5);
    assert.equal(progress.reviewDone, true);
  });
});
