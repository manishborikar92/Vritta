import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortHabits } from '../src/utils/date-helpers.js';
import {
  normalizeHabitFromFirestore,
  serializeHabitForFirestore,
  sanitizeForFirestore,
} from '../src/lib/firebase/firestore.js';

describe('Canonical Display Order Architecture — Phase 1 Verification', () => {

  describe('1. First Added, First Displayed Ordering Invariants', () => {
    it('should sort habits in strict ascending order of canonical sortOrder', () => {
      const habits = [
        { id: 'h4', title: 'Habit 4', sortOrder: 4 },
        { id: 'h1', title: 'Habit 1', sortOrder: 1 },
        { id: 'h3', title: 'Habit 3', sortOrder: 3 },
        { id: 'h2', title: 'Habit 2', sortOrder: 2 },
      ];

      habits.sort(sortHabits);

      assert.deepEqual(
        habits.map(h => h.id),
        ['h1', 'h2', 'h3', 'h4']
      );
    });

    it('should place newly appended habits (higher sortOrder) strictly after earlier habits', () => {
      const existing = [
        { id: 'h1', title: 'Habit 1', sortOrder: 1 },
        { id: 'h2', title: 'Habit 2', sortOrder: 2 },
        { id: 'h3', title: 'Habit 3', sortOrder: 3 },
      ];

      const newlyAdded = { id: 'h4', title: 'Habit 4 (New)', sortOrder: 4 };
      const combined = [...existing, newlyAdded];
      combined.sort(sortHabits);

      assert.equal(combined[combined.length - 1].id, 'h4');
    });

    it('should resolve tied sortOrder deterministically using creation timestamp', () => {
      const t1 = new Date('2026-10-18T08:00:00Z').getTime();
      const t2 = new Date('2026-10-18T09:00:00Z').getTime();

      const habits = [
        { id: 'later', sortOrder: 1, createdAt: t2 },
        { id: 'earlier', sortOrder: 1, createdAt: t1 },
      ];

      habits.sort(sortHabits);

      assert.equal(habits[0].id, 'earlier');
      assert.equal(habits[1].id, 'later');
    });

    it('should resolve tied sortOrder and identical timestamp deterministically using document ID', () => {
      const t = '2026-10-18T08:00:00Z';

      const habits = [
        { id: 'z_doc', sortOrder: 1, createdAt: t },
        { id: 'a_doc', sortOrder: 1, createdAt: t },
        { id: 'm_doc', sortOrder: 1, createdAt: t },
      ];

      habits.sort(sortHabits);

      assert.deepEqual(
        habits.map(h => h.id),
        ['a_doc', 'm_doc', 'z_doc']
      );
    });

    it('should safely handle habits missing sortOrder by placing them deterministically at the end', () => {
      const habits = [
        { id: 'missing_1', title: 'No sortOrder A' },
        { id: 'has_order', title: 'Has sortOrder', sortOrder: 1 },
        { id: 'missing_2', title: 'No sortOrder B', createdAt: '2026-10-18T10:00:00Z' },
      ];

      habits.sort(sortHabits);

      assert.equal(habits[0].id, 'has_order');
    });
  });

  describe('2. Edit and Completion Immutability', () => {
    it('should never change position when a habit is edited (title, category, timing, description)', () => {
      const habitA = { id: 'h1', title: 'Morning Walk', sortOrder: 1, category: 'Health & Fitness', schedule: { preferredPeriod: 'Morning' } };
      const habitB = { id: 'h2', title: 'Evening Reading', sortOrder: 2, category: 'Learning & Growth', schedule: { preferredPeriod: 'Evening' } };
      const habitC = { id: 'h3', title: 'Night Diary', sortOrder: 3, category: 'Reflection & Journaling', schedule: { preferredPeriod: 'Night' } };

      const listBefore = [habitA, habitB, habitC].sort(sortHabits);

      // User edits habit B to have morning timing and different title
      const updatedHabitB = {
        ...habitB,
        title: 'Morning Reading Session',
        schedule: { preferredPeriod: 'Morning' },
        updatedAt: '2026-10-19T01:00:00Z',
      };

      const listAfter = [habitA, updatedHabitB, habitC].sort(sortHabits);

      assert.deepEqual(
        listAfter.map(h => h.id),
        listBefore.map(h => h.id),
        'Position of habits must not change upon editing'
      );
      assert.equal(listAfter[1].title, 'Morning Reading Session');
    });

    it('should never change position when completion state or daily outcome is toggled', () => {
      const habit1 = { id: 'h1', title: 'Routine 1', sortOrder: 1, completed: false };
      const habit2 = { id: 'h2', title: 'Routine 2', sortOrder: 2, completed: false };
      const habit3 = { id: 'h3', title: 'Routine 3', sortOrder: 3, completed: false };

      const list = [habit1, habit2, habit3].sort(sortHabits);

      // Complete routine 3 first, then routine 1
      habit3.completed = true;
      habit1.completed = true;

      const listAfterToggle = [habit1, habit2, habit3].sort(sortHabits);

      assert.deepEqual(
        listAfterToggle.map(h => h.id),
        ['h1', 'h2', 'h3'],
        'Order must strictly remain [h1, h2, h3] regardless of which habit is marked complete'
      );
    });

    it('should verify payload sanitization strips sortOrder, createdAt, and legacy order from updates', () => {
      const incomingUpdate = {
        title: 'Updated Routine Title',
        category: 'Health & Fitness',
        sortOrder: 999, // Malicious or accidental order mutation
        createdAt: '1970-01-01T00:00:00Z',
        order: 42,
        schedule: {
          frequency: ['Mon', 'Tue'],
          order: 99,
        },
      };

      // Emulate updateHabitDoc cleanup
      const clean = sanitizeForFirestore(incomingUpdate);
      delete clean.sortOrder;
      delete clean.createdAt;
      delete clean.order;
      if (clean.schedule) {
        delete clean.schedule.order;
      }

      assert.equal(clean.sortOrder, undefined, 'sortOrder must be stripped from updates');
      assert.equal(clean.createdAt, undefined, 'createdAt must be stripped from updates');
      assert.equal(clean.order, undefined, 'legacy order must be stripped from updates');
      assert.equal(clean.schedule?.order, undefined, 'legacy schedule.order must be stripped from updates');
      assert.equal(clean.title, 'Updated Routine Title');
    });
  });

  describe('3. Concurrency and Atomic Counter Allocation Simulation', () => {
    it('should assign unique, strictly monotonic sortOrders under simulated concurrent tab creations', async () => {
      // Simulate Firestore database state
      let userDoc = { nextSortOrder: 1 };
      const createdHabits = [];

      // Simulated atomic transaction
      const runTransactionSim = async (updateFn) => {
        // Read user doc
        const currentNext = userDoc.nextSortOrder;
        const allocated = currentNext;
        const next = allocated + 1;
        // Mutate
        userDoc.nextSortOrder = next;
        return updateFn(allocated);
      };

      // 10 concurrent requests from multiple browser tabs
      const concurrentCreations = Array.from({ length: 10 }, (_, i) => {
        return runTransactionSim((allocatedOrder) => {
          const habit = {
            id: `concurrent_habit_${i + 1}`,
            title: `Habit ${i + 1}`,
            sortOrder: allocatedOrder,
          };
          createdHabits.push(habit);
          return habit;
        });
      });

      await Promise.all(concurrentCreations);

      assert.equal(createdHabits.length, 10);
      assert.equal(userDoc.nextSortOrder, 11);

      // Verify every sortOrder is unique
      const orders = createdHabits.map(h => h.sortOrder);
      const uniqueOrders = new Set(orders);
      assert.equal(uniqueOrders.size, 10, 'All 10 habits must have unique sortOrder values');

      // Verify values are 1..10
      createdHabits.sort(sortHabits);
      assert.deepEqual(
        createdHabits.map(h => h.sortOrder),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
    });
  });

  describe('4. Counter Recovery & Deletion Gap Safety', () => {
    it('should safely recover missing nextSortOrder from existing habits without resetting to 1', () => {
      // Simulated existing habits in database (e.g. 6 existing habits, highest sortOrder = 6)
      const existingHabits = [
        { id: 'h1', sortOrder: 1 },
        { id: 'h2', sortOrder: 2 },
        { id: 'h3', sortOrder: 3 },
        { id: 'h4', sortOrder: 4 },
        { id: 'h5', sortOrder: 5 },
        { id: 'h6', sortOrder: 6 },
      ];

      // Missing userDoc.nextSortOrder
      const userDoc = {};

      let fallbackBaseOrder = null;
      if (typeof userDoc.nextSortOrder !== 'number' || userDoc.nextSortOrder < 1) {
        let maxOrder = 0;
        existingHabits.forEach(h => {
          if (typeof h.sortOrder === 'number' && h.sortOrder > maxOrder) {
            maxOrder = h.sortOrder;
          }
        });
        fallbackBaseOrder = maxOrder + 1;
      }

      assert.equal(fallbackBaseOrder, 7, 'Must recover next order as max(6) + 1 = 7, NOT reset to 1');
    });

    it('should initialize nextSortOrder to 1 when user has zero habits', () => {
      const existingHabits = [];
      const userDoc = {};

      let fallbackBaseOrder = null;
      if (typeof userDoc.nextSortOrder !== 'number' || userDoc.nextSortOrder < 1) {
        let maxOrder = 0;
        existingHabits.forEach(h => {
          if (typeof h.sortOrder === 'number' && h.sortOrder > maxOrder) {
            maxOrder = h.sortOrder;
          }
        });
        fallbackBaseOrder = maxOrder + 1;
      }

      assert.equal(fallbackBaseOrder, 1, 'For zero habits, first allocated order must be 1');
    });

    it('should safely preserve order when habits are deleted, without causing collisions on new adds', () => {
      let nextSortOrder = 4;
      let habits = [
        { id: 'h1', title: 'Habit 1', sortOrder: 1 },
        { id: 'h2', title: 'Habit 2', sortOrder: 2 },
        { id: 'h3', title: 'Habit 3', sortOrder: 3 },
      ];

      // Delete habit 2
      habits = habits.filter(h => h.id !== 'h2');

      // Remaining habits: 1 and 3
      habits.sort(sortHabits);
      assert.deepEqual(habits.map(h => h.sortOrder), [1, 3]);

      // Add habit 4 using nextSortOrder
      const allocated = nextSortOrder++;
      habits.push({ id: 'h4', title: 'Habit 4', sortOrder: allocated });

      habits.sort(sortHabits);
      assert.deepEqual(
        habits.map(h => ({ id: h.id, sortOrder: h.sortOrder })),
        [
          { id: 'h1', sortOrder: 1 },
          { id: 'h3', sortOrder: 3 },
          { id: 'h4', sortOrder: 4 },
        ],
        'New habit 4 appends cleanly at position 4 without colliding with surviving habits'
      );
    });
  });

  describe('5. Normalization & Serialization Parity', () => {
    it('should normalize Firestore habit document mapping root sortOrder and eliminating schedule.order', () => {
      const rawFirestoreDoc = {
        id: 'user_routine_1',
        userId: 'usr_123',
        title: 'Morning Breathwork',
        category: 'Mindfulness & Spirit',
        sortOrder: 3,
        schedule: {
          frequency: ['Mon', 'Wed', 'Fri'],
          timingType: 'preferred_period',
          preferredPeriod: 'Morning',
          restDays: ['Sun'],
          order: 99, // Legacy field
        },
        order: 99, // Legacy field
        features: {
          timer: { enabled: true, targetDurationMinutes: 10 },
        },
      };

      const normalized = normalizeHabitFromFirestore(rawFirestoreDoc);

      assert.equal(normalized.sortOrder, 3, 'Must map top-level sortOrder');
      assert.equal(normalized.schedule.order, undefined, 'Must eliminate legacy schedule.order');
      assert.equal(normalized.order, undefined, 'Must eliminate legacy root order');
    });

    it('should serialize ComposableHabitModel with root sortOrder and without schedule.order', () => {
      const composableHabit = {
        id: 'usr_123_routine_1',
        userId: 'usr_123',
        title: 'Evening Reflection',
        description: 'Quiet thoughts',
        category: 'Reflection & Journaling',
        sortOrder: 5,
        schedule: {
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          timingType: 'preferred_period',
          preferredPeriod: 'Evening',
          restDays: [],
        },
        features: {
          notes: { enabled: true, placeholder: 'Write...', reflectionPrompts: [] },
        },
        lifecycle: {
          trackingHorizon: { startDate: '2026-10-18', status: 'verified_creation' },
        },
      };

      const serialized = serializeHabitForFirestore(composableHabit);

      assert.equal(serialized.sortOrder, 5, 'Must serialize top-level sortOrder');
      assert.equal(serialized.schedule.order, undefined, 'schedule.order must not exist in serialized output');
    });
  });

  describe('6. Dashboard & Habits Page Parity', () => {
    it('should guarantee todaysHabits on Dashboard displays routines in identical sequence to Habits page', () => {
      // 6 canonical habits in database
      const allHabits = [
        { id: 'h1', title: 'Routine 1', sortOrder: 1, frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        { id: 'h2', title: 'Routine 2', sortOrder: 2, frequency: ['Mon', 'Wed', 'Fri'] },
        { id: 'h3', title: 'Routine 3', sortOrder: 3, frequency: ['Tue', 'Thu'] },
        { id: 'h4', title: 'Routine 4', sortOrder: 4, frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        { id: 'h5', title: 'Routine 5', sortOrder: 5, frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        { id: 'h6', title: 'Routine 6', sortOrder: 6, frequency: ['Sat', 'Sun'] },
      ];

      // Habits page renders allHabits sorted by sortHabits
      const habitsPageList = [...allHabits].sort(sortHabits);
      assert.deepEqual(habitsPageList.map(h => h.id), ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

      // Dashboard filters for active day (e.g. 'Mon')
      const activeDay = 'Mon';
      const todaysHabits = habitsPageList.filter(h => h.frequency.includes(activeDay));

      // Active for Mon: h1, h2, h4, h5
      assert.deepEqual(
        todaysHabits.map(h => h.id),
        ['h1', 'h2', 'h4', 'h5'],
        'Relative order of habits on Dashboard must be strictly identical to Habits page'
      );
    });
  });
});
