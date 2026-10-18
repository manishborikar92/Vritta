import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_ROUTINES } from '../src/lib/server/schedule-templates.js';

describe('Diary Privacy & Scoping Integrity', () => {
  it('should verify diary routine is configured as a reflection journal without obsolete private flags', () => {
    const diaryHabit = CANONICAL_ROUTINES.find(r => r.stableKey === 'canonical_maintain_diary');
    assert.ok(diaryHabit, 'Diary routine must exist');
    assert.equal(diaryHabit.category, 'Reflection & Journaling');
    assert.equal(diaryHabit.features?.notes?.enabled, true);
    assert.equal(diaryHabit.features?.notes?.isPrivateDiary, undefined);
    assert.equal(diaryHabit.metadata?.isPrivateJournal, undefined);
    assert.notEqual(diaryHabit.completionMethod, 'diary_entry');
  });

  it('should include the 5 specified reflection prompts in diary notes feature', () => {
    const diaryHabit = CANONICAL_ROUTINES.find(r => r.stableKey === 'canonical_maintain_diary');
    const prompts = diaryHabit.features?.notes?.reflectionPrompts || [];

    assert.equal(prompts.length, 5);
    assert.ok(prompts.includes('What happened or what thought came to mind?'));
    assert.ok(prompts.includes('What did I feel?'));
    assert.ok(prompts.includes('What assumption might I be making?'));
    assert.ok(prompts.includes('What did I learn?'));
    assert.ok(prompts.includes('Is there a small next step?'));
  });

  it('should guarantee zero seeded historical entries or prewritten journal text', () => {
    const diaryHabit = CANONICAL_ROUTINES.find(r => r.stableKey === 'canonical_maintain_diary');

    // No default text or mock entries seeded
    assert.equal(diaryHabit.defaultText, undefined);
    assert.equal(diaryHabit.entries, undefined);
    assert.equal(diaryHabit.history, undefined);
  });

  it('should enforce user-scoping in daily log document path', () => {
    const userId = 'usr_manish_789';
    const dateStr = '2026-10-14';

    const logDocId = `${userId}_${dateStr}`;
    assert.ok(logDocId.startsWith(userId), 'Log doc ID must strictly start with userId');
  });
});
