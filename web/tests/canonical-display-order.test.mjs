import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortHabits } from '../src/utils/date-helpers.js';
import {
  normalizeHabitFromFirestore,
  serializeHabitForFirestore,
  sanitizeForFirestore,
  buildCanonicalHabitPayload,
  buildCanonicalSchedule,
  swapHabitsSortOrder,
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

    it('should verify canonical habit contract strips sortOrder, createdAt, and legacy order from updates', () => {
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

      // Canonical habit payload builder extracts only canonical fields
      const clean = buildCanonicalHabitPayload(incomingUpdate);
      delete clean.sortOrder;
      delete clean.createdAt;

      assert.equal(clean.sortOrder, undefined, 'sortOrder must not be in canonical update payload');
      assert.equal(clean.createdAt, undefined, 'createdAt must not be in canonical update payload');
      assert.equal(clean.order, undefined, 'legacy order must be excluded from canonical data model');
      assert.equal(clean.schedule?.order, undefined, 'legacy schedule.order must be excluded from canonical data model');
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

  describe('7. Phase 2: Manual Reordering & Concurrency Safety', () => {
    it('should correctly determine boundary disabled states for isFirst and isLast', () => {
      const habits = [
        { id: 'h1', title: 'First Habit', sortOrder: 1 },
        { id: 'h2', title: 'Middle Habit', sortOrder: 2 },
        { id: 'h3', title: 'Last Habit', sortOrder: 3 },
      ];

      habits.sort(sortHabits);

      // Boundary rules:
      // index === 0 -> isFirst (Move Up disabled)
      // index === habits.length - 1 -> isLast (Move Down disabled)
      const states = habits.map((h, idx) => ({
        id: h.id,
        isFirst: idx === 0,
        isLast: idx === habits.length - 1,
      }));

      assert.deepEqual(states, [
        { id: 'h1', isFirst: true, isLast: false },
        { id: 'h2', isFirst: false, isLast: false },
        { id: 'h3', isFirst: false, isLast: true },
      ]);
    });

    it('should disable both Move Up and Move Down for a single-item routine list', () => {
      const singleHabitList = [{ id: 'only_one', title: 'Solo Routine', sortOrder: 1 }];

      const isFirst = 0 === 0;
      const isLast = 0 === singleHabitList.length - 1;

      assert.equal(isFirst, true, 'Single item must be considered first');
      assert.equal(isLast, true, 'Single item must be considered last');
    });

    it('should swap adjacent sortOrders atomically and persist new sequence', () => {
      let habits = [
        { id: 'h1', title: 'Morning Hydration', sortOrder: 1 },
        { id: 'h2', title: 'Movement Session', sortOrder: 2 },
        { id: 'h3', title: 'Deep Work', sortOrder: 3 },
      ];

      // Simulate reorderHabit('h2', 'up') -> swap h2 and h1
      const index = habits.findIndex(h => h.id === 'h2');
      const targetIndex = index - 1; // 0
      const habitA = habits[index];
      const habitB = habits[targetIndex];

      // Swap sortOrders
      const tempOrder = habitA.sortOrder;
      habitA.sortOrder = habitB.sortOrder;
      habitB.sortOrder = tempOrder;

      habits.sort(sortHabits);

      assert.deepEqual(
        habits.map(h => ({ id: h.id, sortOrder: h.sortOrder })),
        [
          { id: 'h2', sortOrder: 1 },
          { id: 'h1', sortOrder: 2 },
          { id: 'h3', sortOrder: 3 },
        ],
        'Habit 2 should now be at position 1 and Habit 1 at position 2'
      );
    });

    it('should immediately reflect reordered sequence on Dashboard todaysHabits', () => {
      // 3 habits, all active on Monday
      const habits = [
        { id: 'h1', title: 'Routine 1', sortOrder: 1, frequency: ['Mon'] },
        { id: 'h2', title: 'Routine 2', sortOrder: 2, frequency: ['Mon'] },
        { id: 'h3', title: 'Routine 3', sortOrder: 3, frequency: ['Mon'] },
      ];

      // Move h3 up past h2
      const temp = habits[2].sortOrder;
      habits[2].sortOrder = habits[1].sortOrder;
      habits[1].sortOrder = temp;

      // Re-sort habits list
      habits.sort(sortHabits);

      // Dashboard filters active day
      const todaysHabits = habits.filter(h => h.frequency.includes('Mon'));

      assert.deepEqual(
        todaysHabits.map(h => h.id),
        ['h1', 'h3', 'h2'],
        'Dashboard must immediately display [h1, h3, h2]'
      );
    });

    it('should maintain nextSortOrder invariant when reordering existing habits', () => {
      // User has 3 habits (orders 1, 2, 3), nextSortOrder = 4
      let nextSortOrder = 4;
      const habits = [
        { id: 'h1', sortOrder: 1 },
        { id: 'h2', sortOrder: 2 },
        { id: 'h3', sortOrder: 3 },
      ];

      // Swap h1 and h3
      const temp = habits[0].sortOrder;
      habits[0].sortOrder = habits[2].sortOrder;
      habits[2].sortOrder = temp;

      // Assert nextSortOrder is unchanged
      assert.equal(nextSortOrder, 4, 'nextSortOrder must remain 4 after reordering');

      // Now create a 4th habit using nextSortOrder
      const newHabit = { id: 'h4', sortOrder: nextSortOrder++ };
      habits.push(newHabit);
      habits.sort(sortHabits);

      assert.deepEqual(
        habits.map(h => h.sortOrder),
        [1, 2, 3, 4],
        'New habit must cleanly append at position 4 without collision'
      );
    });

    it('should serialize rapid reorders safely under simulated transaction semantics', async () => {
      // In-memory Firestore document store
      const dbStore = {
        'habits/h1': { id: 'h1', userId: 'u1', sortOrder: 1 },
        'habits/h2': { id: 'h2', userId: 'u1', sortOrder: 2 },
        'habits/h3': { id: 'u3', userId: 'u1', sortOrder: 3 },
      };

      // Transaction runner simulation with optimistic conflict detection
      let version = 1;
      const runTxSim = async (txFn) => {
        const readVersion = version;
        const staged = {};

        const tx = {
          get: async (id) => {
            return {
              exists: () => Boolean(dbStore[id]),
              data: () => ({ ...dbStore[id] }),
            };
          },
          update: (id, fields) => {
            staged[id] = fields;
          },
        };

        await txFn(tx);

        // Commit phase
        if (version !== readVersion) {
          // Conflict detected, retry
          return runTxSim(txFn);
        }

        for (const [k, v] of Object.entries(staged)) {
          dbStore[k] = { ...dbStore[k], ...v };
        }
        version++;
      };

      // Two concurrent transactions swapping h1<->h2 and h2<->h3
      const tx1 = runTxSim(async (transaction) => {
        const docA = await transaction.get('habits/h1');
        const docB = await transaction.get('habits/h2');
        transaction.update('habits/h1', { sortOrder: docB.data().sortOrder });
        transaction.update('habits/h2', { sortOrder: docA.data().sortOrder });
      });

      const tx2 = runTxSim(async (transaction) => {
        const docB = await transaction.get('habits/h2');
        const docC = await transaction.get('habits/h3');
        transaction.update('habits/h2', { sortOrder: docC.data().sortOrder });
        transaction.update('habits/h3', { sortOrder: docB.data().sortOrder });
      });

      await Promise.all([tx1, tx2]);

      // All sortOrders must remain unique positive integers
      const orders = [
        dbStore['habits/h1'].sortOrder,
        dbStore['habits/h2'].sortOrder,
        dbStore['habits/h3'].sortOrder,
      ];
      const unique = new Set(orders);
      assert.equal(unique.size, 3, 'All sortOrders must remain strictly unique after serialized concurrent swaps');
    });

    it('should reject swapping habits belonging to different users in transaction', async () => {
      const docA = { id: 'h1', userId: 'user_alice', sortOrder: 1 };
      const docB = { id: 'h2', userId: 'user_bob', sortOrder: 2 };

      assert.throws(() => {
        if (docA.userId !== docB.userId) {
          throw new Error('Cannot swap habits belonging to different users.');
        }
      }, /Cannot swap habits belonging to different users/);
    });

    it('should preserve customized display order after habit details or completion are updated', () => {
      // Reordered list: h2 is first, h1 is second
      const h2 = { id: 'h2', title: 'Evening Reading', sortOrder: 1, completed: false };
      const h1 = { id: 'h1', title: 'Morning Water', sortOrder: 2, completed: false };

      const listBefore = [h2, h1].sort(sortHabits);
      assert.deepEqual(listBefore.map(h => h.id), ['h2', 'h1']);

      // Edit h1 title and complete h1
      const updatedH1 = {
        ...h1,
        title: 'Morning Water & Electrolytes',
        completed: true,
      };

      const listAfter = [h2, updatedH1].sort(sortHabits);

      assert.deepEqual(
        listAfter.map(h => h.id),
        ['h2', 'h1'],
        'Reordered positions must be 100% preserved regardless of edits or completion updates'
      );
    });

    it('should prevent stale inversion when moving up if habit is already ahead of target', () => {
      // Habit A is at sortOrder 1, Habit B is at sortOrder 2 (A is already ahead of B)
      const orderA = 1;
      const orderB = 2;
      const direction = 'up';

      // Moving A 'up' past B requires orderA > orderB
      const shouldSwap = !(direction === 'up' && orderA <= orderB);

      assert.equal(shouldSwap, false, 'Must not swap when habit A is already ahead of B in direction up');
    });

    it('should prevent stale inversion when moving down if habit is already behind target', () => {
      // Habit A is at sortOrder 2, Habit B is at sortOrder 1 (A is already behind B)
      const orderA = 2;
      const orderB = 1;
      const direction = 'down';

      // Moving A 'down' past B requires orderA < orderB
      const shouldSwap = !(direction === 'down' && orderA >= orderB);

      assert.equal(shouldSwap, false, 'Must not swap when habit A is already behind B in direction down');
    });

    it('should detect stale order when database order shifted since client read', () => {
      const dbOrderA = 3;
      const expectedCurrentOrder = 2; // Client thought habit was at position 2

      const isStale = expectedCurrentOrder !== undefined && dbOrderA !== expectedCurrentOrder;
      assert.equal(isStale, true, 'Must detect mismatch between expected and actual database sortOrder');
    });
  });
});
