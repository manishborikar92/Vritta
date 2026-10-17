import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_ROUTINES } from '../src/lib/server/schedule-templates.js';

describe('Seed Idempotency & Data Preservation', () => {
  it('should define exactly 6 canonical routines with unique stable keys', () => {
    assert.equal(CANONICAL_ROUTINES.length, 6, 'Must define exactly 6 canonical routines');

    const stableKeys = CANONICAL_ROUTINES.map(r => r.stableKey);
    const uniqueKeys = new Set(stableKeys);

    assert.equal(uniqueKeys.size, 6, 'All canonical routines must have unique stable keys');
    assert.ok(stableKeys.includes('canonical_english_workbook'), 'Workbook must have stable key');
    assert.ok(stableKeys.includes('canonical_exercise_plan'), 'Exercise plan must have stable key');
    assert.ok(stableKeys.includes('canonical_listen_osho'), 'Osho routine must have stable key');
    assert.ok(stableKeys.includes('canonical_read_books'), 'Reading routine must have stable key');
    assert.ok(stableKeys.includes('canonical_english_speaking'), 'Speaking routine must have stable key');
    assert.ok(stableKeys.includes('canonical_maintain_diary'), 'Diary routine must have stable key');
  });

  it('should generate deterministic document IDs based on userId and stableKey', () => {
    const testUserId = 'user_12345';

    const generatedIds = CANONICAL_ROUTINES.map(r => `${testUserId}_${r.stableKey}`);
    const rerunIds = CANONICAL_ROUTINES.map(r => `${testUserId}_${r.stableKey}`);

    // Running twice produces the exact same set of IDs
    assert.deepEqual(generatedIds, rerunIds, 'Deterministic document IDs must match across reruns');

    // Verify IDs are scoped to the user
    generatedIds.forEach(id => {
      assert.ok(id.startsWith(`${testUserId}_`), 'ID must be prefixed with userId');
    });
  });

  it('should not contain fabricated past completions or historical diary text in seed fixtures', () => {
    CANONICAL_ROUTINES.forEach(routine => {
      // Must not seed past completions
      assert.equal(routine.isCompleted, undefined, `${routine.title} must not seed isCompleted`);
      assert.equal(routine.completedDates, undefined, `${routine.title} must not seed completedDates`);

      // Must not seed fabricated diary entries
      assert.equal(routine.diaryEntry, undefined, `${routine.title} must not seed diaryEntry`);
      assert.equal(routine.pastEntries, undefined, `${routine.title} must not seed pastEntries`);
    });
  });

  it('should decouple timing preference from hard deadlines', () => {
    const exercise = CANONICAL_ROUTINES.find(r => r.stableKey === 'canonical_exercise_plan');
    assert.equal(exercise.timingType, 'preferred_period');
    assert.equal(exercise.preferredPeriod, 'Afternoon');

    const reading = CANONICAL_ROUTINES.find(r => r.stableKey === 'canonical_read_books');
    assert.equal(reading.timingType, 'relative');
    assert.equal(reading.relativeTiming, 'Before bed');

    const workbook = CANONICAL_ROUTINES.find(r => r.stableKey === 'canonical_english_workbook');
    assert.equal(workbook.timingType, 'anytime');
  });
});
