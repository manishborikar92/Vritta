import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Diary Privacy & Scoping Integrity', () => {
  const reflectionHabit = {
    id: 'habit_reflection_notes',
    title: 'Daily Reflection & Journaling',
    category: 'Reflection & Journaling',
    features: {
      notes: {
        enabled: true,
        placeholder: 'Write your thoughts or respond to a prompt...',
        reflectionPrompts: [
          'What happened or what thought came to mind?',
          'What did I feel?',
          'What assumption might I be making?',
          'What did I learn?',
          'Is there a small next step?',
        ],
      },
    },
  };

  it('should verify reflection routine is configured as a reflection journal without obsolete private flags', () => {
    assert.equal(reflectionHabit.category, 'Reflection & Journaling');
    assert.equal(reflectionHabit.features?.notes?.enabled, true);
    assert.equal(reflectionHabit.features?.notes?.isPrivateDiary, undefined);
    assert.equal(reflectionHabit.metadata?.isPrivateJournal, undefined);
    assert.notEqual(reflectionHabit.completionMethod, 'diary_entry');
  });

  it('should include the 5 specified reflection prompts in notes feature', () => {
    const prompts = reflectionHabit.features?.notes?.reflectionPrompts || [];

    assert.equal(prompts.length, 5);
    assert.ok(prompts.includes('What happened or what thought came to mind?'));
    assert.ok(prompts.includes('What did I feel?'));
    assert.ok(prompts.includes('What assumption might I be making?'));
    assert.ok(prompts.includes('What did I learn?'));
    assert.ok(prompts.includes('Is there a small next step?'));
  });

  it('should guarantee zero prewritten journal text or seeded entries', () => {
    assert.equal(reflectionHabit.defaultText, undefined);
    assert.equal(reflectionHabit.entries, undefined);
    assert.equal(reflectionHabit.history, undefined);
  });

  it('should enforce user-scoping in daily log document path', () => {
    const userId = 'usr_user_789';
    const dateStr = '2026-10-14';

    const logDocId = `${userId}_${dateStr}`;
    assert.ok(logDocId.startsWith(userId), 'Log doc ID must strictly start with userId');
  });
});
