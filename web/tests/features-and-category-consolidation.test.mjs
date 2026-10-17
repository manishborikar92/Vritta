import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIES,
  CANONICAL_CATEGORIES,
  CATEGORY_CONFIG,
  getCategoryConfig,
  isValidCategory,
} from '../src/lib/constants/categories.js';
import {
  APPROVED_FEATURE_SLOTS,
  validateComposableHabit,
} from '../src/lib/constants/habit-models.js';
import {
  normalizeHabitFromFirestore,
  serializeHabitForFirestore,
} from '../src/lib/firebase/firestore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Features Architecture & Life-Area Category Consolidation', () => {
  const habitModalContent = readWebFile('src/components/habits/HabitModal.js');
  const firestoreRulesContent = readWebFile('firestore.rules');

  describe('1. Features Architecture & Elimination of "How to Complete"', () => {
    it('should completely eliminate "How to Complete" heading, section, and dropdown from HabitModal UI', () => {
      assert.ok(
        !habitModalContent.includes('How to Complete'),
        'HabitModal must not contain "How to Complete"'
      );
      assert.ok(
        !habitModalContent.includes('Tracking / Completion Method'),
        'HabitModal must not contain legacy "Tracking / Completion Method" label'
      );
      assert.ok(
        !habitModalContent.includes('availableMethods'),
        'HabitModal must not contain availableMethods completion selector state'
      );
    });

    it('should render exactly one cohesive "Features" navigation tab', () => {
      assert.ok(
        habitModalContent.includes('Features ('),
        'HabitModal must render the cohesive "Features" tab button with active count'
      );
      assert.ok(
        habitModalContent.includes("activeTab === 'features'"),
        'HabitModal must render the features tab panel'
      );
    });

    it('should expose all six approved composable feature slots in HabitModal', () => {
      // 1. Counter Stepper
      assert.ok(habitModalContent.includes('Counter Stepper'), 'Must render Counter Stepper slot header');
      assert.ok(habitModalContent.includes('formData.features.counter.enabled'), 'Must bind counter enabled state');
      assert.ok(habitModalContent.includes('targetCount'), 'Must provide target count input');
      assert.ok(habitModalContent.includes('unit'), 'Must provide unit input');

      // 2. Duration Timer
      assert.ok(habitModalContent.includes('Duration Timer'), 'Must render Duration Timer slot header');
      assert.ok(habitModalContent.includes('formData.features.timer.enabled'), 'Must bind timer enabled state');
      assert.ok(habitModalContent.includes('targetDurationMinutes'), 'Must provide duration selection');
      assert.ok(habitModalContent.includes('soundOnComplete'), 'Must provide sound chime toggle');

      // 3. Step Checklist
      assert.ok(habitModalContent.includes('Step-by-Step Checklist'), 'Must render Step-by-Step Checklist slot header');
      assert.ok(habitModalContent.includes('formData.features.checklist.enabled'), 'Must bind checklist enabled state');
      assert.ok(habitModalContent.includes('addChecklistItem'), 'Must provide checklist item addition');

      // 4. Notes & Reflection
      assert.ok(habitModalContent.includes('Notes & Reflection'), 'Must render Notes & Reflection slot header');
      assert.ok(habitModalContent.includes('formData.features.notes.enabled'), 'Must bind notes enabled state');
      assert.ok(habitModalContent.includes('isPrivateDiary'), 'Must provide private diary mode toggle');
      assert.ok(habitModalContent.includes('reflectionPrompts'), 'Must provide reflection prompt chips');

      // 5. Structured Catalog
      assert.ok(habitModalContent.includes('Multi-Item Catalog'), 'Must render Multi-Item Catalog slot header');
      assert.ok(habitModalContent.includes('formData.features.catalog.enabled'), 'Must bind catalog enabled state');
      assert.ok(habitModalContent.includes('catalogTitle'), 'Must provide catalog title input');

      // 6. Progressive Day Schedule
      assert.ok(habitModalContent.includes('Progressive Day Schedule'), 'Must render Day Schedule slot header');
      assert.ok(habitModalContent.includes('formData.features.daySchedule.enabled'), 'Must bind daySchedule enabled state');
      assert.ok(habitModalContent.includes('planTitle'), 'Must provide plan title input');
    });

    it('should eliminate duplicate controls for reading duration presets in HabitModal', () => {
      // Ensure there are no duplicate button sets outside the timer slot
      const matches = habitModalContent.match(/Target Reading Duration/g);
      assert.equal(matches, null, 'Must have 0 occurrences of duplicate "Target Reading Duration" section');
    });

    it('should derive legacy completionMethod on save to preserve dashboard cards and backward compatibility', () => {
      assert.ok(
        habitModalContent.includes('let legacyCompletionMethod ='),
        'HabitModal must derive legacyCompletionMethod on save'
      );
      assert.ok(
        habitModalContent.includes("legacyCompletionMethod = 'reading_duration'"),
        'Must derive reading_duration when timer is enabled'
      );
      assert.ok(
        habitModalContent.includes("legacyCompletionMethod = 'workbook_sessions'"),
        'Must derive workbook_sessions when counter is enabled'
      );
      assert.ok(
        habitModalContent.includes("legacyCompletionMethod = 'osho_listening'"),
        'Must derive osho_listening when catalog is enabled'
      );
      assert.ok(
        habitModalContent.includes("legacyCompletionMethod = 'exercise_plan'"),
        'Must derive exercise_plan when daySchedule is enabled'
      );
    });
  });

  describe('2. Life-Area Category Consolidation & Taxonomy', () => {
    it('should define exactly 9 canonical categories in CANONICAL_CATEGORIES and CATEGORIES', () => {
      assert.equal(CANONICAL_CATEGORIES.length, 9, 'Must have exactly 9 canonical categories');
      assert.deepEqual(CATEGORIES, CANONICAL_CATEGORIES, 'CATEGORIES must strictly equal CANONICAL_CATEGORIES');
      
      const expectedCategories = [
        'Health & Fitness',
        'Learning & Growth',
        'Mindfulness & Spirit',
        'Reflection & Journaling',
        'Work & Career',
        'Creativity & Hobbies',
        'Relationships & Family',
        'Rest & Recovery',
        'Other',
      ];
      assert.deepEqual(CANONICAL_CATEGORIES, expectedCategories);
    });

    it('should eliminate redundant "Movement" duplicate from selectable categories and reject it strictly', () => {
      // Not in canonical array
      assert.ok(!CANONICAL_CATEGORIES.includes('Movement'), 'Movement must NOT be in CANONICAL_CATEGORIES');
      assert.ok(!CATEGORIES.includes('Movement'), 'Movement must NOT be in CATEGORIES dropdown options');
      assert.equal(isValidCategory('Movement'), false, 'Movement must NOT be a valid category');

      // Configuration fallback (no legacy proxy resolution)
      const resolvedConfig = getCategoryConfig('Movement');
      assert.equal(resolvedConfig.label, 'Movement');
      assert.equal(resolvedConfig.iconName, 'CheckCircle2', 'Fallback config must be returned for non-canonical category');
    });

    it('should strictly reject non-canonical legacy category names', () => {
      assert.equal(isValidCategory('Fitness'), false);
      assert.equal(isValidCategory('Health'), false);
      assert.equal(isValidCategory('Wellness'), false);
      assert.equal(isValidCategory('Mindfulness'), false);
    });

    it('should keep distinct cognitive, expressive, and restorative modalities separate', () => {
      // Health & Fitness vs Learning & Growth
      assert.ok(CANONICAL_CATEGORIES.includes('Health & Fitness'));
      assert.ok(CANONICAL_CATEGORIES.includes('Learning & Growth'));
      assert.ok(CANONICAL_CATEGORIES.includes('Work & Career'));

      // Mindfulness & Spirit vs Reflection & Journaling
      assert.ok(CANONICAL_CATEGORIES.includes('Mindfulness & Spirit'));
      assert.ok(CANONICAL_CATEGORIES.includes('Reflection & Journaling'));
    });

    it('should satisfy Cloud Firestore security rules category whitelist with strictly 9 canonical categories', () => {
      // Every canonical category must be allowed in firestore.rules
      for (const cat of CANONICAL_CATEGORIES) {
        assert.ok(
          firestoreRulesContent.includes(`'${cat}'`),
          `firestore.rules must include canonical category '${cat}'`
        );
      }
      // Legacy 'Movement' must NOT be in firestore.rules
      assert.ok(
        !firestoreRulesContent.includes("'Movement',"),
        "firestore.rules must NOT permit legacy standalone 'Movement'"
      );
    });

    it('should validate composable habits against canonical categories and strictly reject non-canonical categories', () => {
      const validCanonicalHabit = {
        id: 'habit_canonical_1',
        userId: 'user_123',
        title: 'Morning Conditioning',
        category: 'Health & Fitness',
        schedule: { frequency: ['Mon', 'Wed', 'Fri'] },
        features: {},
        lifecycle: {
          createdAt: '2026-10-01T04:00:00.000Z',
          updatedAt: '2026-10-01T04:00:00.000Z',
          archived: false,
          deleted: false,
          trackingHorizon: { startDate: '2026-10-01', status: 'verified_creation' },
        },
      };
      const validResult = validateComposableHabit(validCanonicalHabit);
      assert.equal(validResult.valid, true, `Canonical category must validate successfully: ${validResult.errors.join(', ')}`);

      const nonCanonicalHabit = {
        id: 'habit_alias_1',
        userId: 'user_123',
        title: 'Legacy Workout',
        category: 'Movement',
        schedule: { frequency: ['Mon', 'Wed', 'Fri'] },
        features: {},
        lifecycle: {
          createdAt: '2026-10-01T04:00:00.000Z',
          updatedAt: '2026-10-01T04:00:00.000Z',
          archived: false,
          deleted: false,
          trackingHorizon: { startDate: '2026-10-01', status: 'verified_creation' },
        },
      };
      const nonCanonicalResult = validateComposableHabit(nonCanonicalHabit);
      assert.equal(nonCanonicalResult.valid, false, 'Non-canonical category Movement must be strictly rejected');
      assert.ok(nonCanonicalResult.errors[0].includes('invalid'));

      const invalidHabit = {
        id: 'habit_invalid_1',
        userId: 'user_123',
        title: 'Unknown Area',
        category: 'NonExistentCategory123',
        schedule: { frequency: ['Mon'] },
        features: {},
        lifecycle: {
          createdAt: '2026-10-01T04:00:00.000Z',
          updatedAt: '2026-10-01T04:00:00.000Z',
          archived: false,
          deleted: false,
        },
      };
      const invalidResult = validateComposableHabit(invalidHabit);
      assert.equal(invalidResult.valid, false, 'Unrecognized category must fail validation');
      assert.ok(invalidResult.errors[0].includes('invalid'));
    });
  });

  describe('3. Persistence & Normalization Integrity (Firestore)', () => {
    it('should preserve canonical category "Movement & Strength" when reading from Firestore', () => {
      const rawDoc = {
        userId: 'user_123',
        title: 'Bodyweight Exercises',
        category: 'Movement & Strength',
        completionMethod: 'exercise_plan',
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        time: 'Afternoon',
      };

      const normalized = normalizeHabitFromFirestore(rawDoc, 'habit_bw_1');
      assert.equal(
        normalized.category,
        'Movement & Strength',
        'Normalizer must preserve canonical category "Movement & Strength"'
      );
      assert.equal(normalized.id, 'habit_bw_1');
    });

    it('should preserve all 6 composable feature configurations across serialization and normalization round-trip', () => {
      const originalHabit = {
        id: 'theodinproject0622_master_routine',
        userId: 'theodinproject0622',
        title: 'Master Composable Routine',
        category: 'Mindfulness & Spirit',
        description: 'Comprehensive multi-feature test routine',
        order: 1,
        schedule: {
          frequency: ['Mon', 'Wed', 'Fri'],
          restDays: ['Sun'],
          timingType: 'preferred_period',
          preferredPeriod: 'Morning',
          exactTime: null,
          relativeTiming: null,
          anchor: 'Morning',
        },
        features: {
          counter: { enabled: true, targetCount: 3, unit: 'rounds', step: 1, minCount: 0 },
          timer: { enabled: true, targetDurationMinutes: 25, mode: 'countdown', soundOnComplete: true },
          checklist: {
            enabled: true,
            items: [
              { id: 'step_1', label: 'Centering breath', isRequiredForCompletion: true },
              { id: 'step_2', label: 'Audio lecture', isRequiredForCompletion: true },
            ],
          },
          notes: {
            enabled: true,
            isPrivateDiary: true,
            placeholder: 'Daily awareness insights...',
            reflectionPrompts: ['What arose today?', 'Where was tension felt?'],
          },
          catalog: {
            enabled: true,
            catalogId: 'cat_awareness_1',
            catalogTitle: 'Contemplative Discourses',
            itemLabel: 'Discourse',
            items: [
              { id: 'disc_1', title: 'The Art of Listening', url: 'https://example.com/audio1.mp3' },
            ],
          },
          daySchedule: {
            enabled: false,
            planTitle: '12-Week Awareness Cycle',
            allowSundayRest: true,
            dayVariations: {
              Mon: { label: 'Day 1: Breath awareness' },
              Wed: { label: 'Day 2: Thought observation' },
              Fri: { label: 'Day 3: Body scan' },
            },
          },
        },
        lifecycle: {
          createdAt: '2026-10-01T04:00:00.000Z',
          updatedAt: '2026-10-01T04:00:00.000Z',
          archived: false,
          archivedAt: null,
          deleted: false,
          deletedAt: null,
          trackingHorizon: {
            startDate: '2026-10-01',
            status: 'verified_creation',
          },
        },
        status: 'active',
        metadata: { seedOrigin: 'custom' },
      };

      const serialized = serializeHabitForFirestore(originalHabit);
      assert.equal(serialized.category, 'Mindfulness & Spirit');
      assert.equal(serialized.features.counter.enabled, true);
      assert.equal(serialized.features.timer.targetDurationMinutes, 25);
      assert.equal(serialized.features.notes.isPrivateDiary, true);
      assert.equal(serialized.features.checklist.items.length, 2);

      const rehydrated = normalizeHabitFromFirestore(serialized, 'doc_test_roundtrip');
      assert.equal(rehydrated.title, originalHabit.title);
      assert.equal(rehydrated.category, 'Mindfulness & Spirit');
      assert.equal(rehydrated.features.counter.targetCount, 3);
      assert.equal(rehydrated.features.timer.targetDurationMinutes, 25);
      assert.equal(rehydrated.features.timer.soundOnComplete, true);
      assert.equal(rehydrated.features.checklist.items.length, 2);
      assert.equal(rehydrated.features.notes.isPrivateDiary, true);
      assert.deepEqual(rehydrated.features.notes.reflectionPrompts, ['What arose today?', 'Where was tension felt?']);
      assert.equal(rehydrated.features.catalog.catalogTitle, 'Contemplative Discourses');
      assert.equal(rehydrated.features.daySchedule.planTitle, '12-Week Awareness Cycle');
    });
  });
});
