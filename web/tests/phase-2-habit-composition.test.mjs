import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

import {
  WEEKDAYS,
  TIMING_TYPES,
  PERSISTED_OUTCOME_STATUSES,
  DOMAIN_OUTCOME_STATUSES,
  PROVENANCE_STATUSES,
  PROVENANCE_TIERS,
  APPROVED_FEATURE_SLOTS,
  ValidationError,
  resolveObservanceDate,
  convertTimestampToTrackingDate,
  createScheduleHistoryEntry,
  getEffectiveScheduleForDate,
  applyScheduleUpdate,
  deriveTrackingHorizon,
  validateComposableHabit,
  validateDailyLogDoc,
} from '../src/domain/index.js';

import {
  normalizeHabitFromFirestore,
  serializeHabitForFirestore,
  normalizeDailyLogFromFirestore,
  serializeDailyLogForFirestore,
} from '../src/lib/firebase/firestore.js';

describe('Phase 2: Composable Habit Configuration Engine & UI Polish', () => {

  // ==========================================================================
  // 1. Carry-Forward Issue 1: Reconciled Tracking Provenance Tiers
  // ==========================================================================
  describe('1. Reconciled Tracking Provenance Tiers', () => {
    it('should export identical PROVENANCE_STATUSES and PROVENANCE_TIERS matching the approved specification', () => {
      const expectedTiers = [
        'verified_creation',
        'verified_first_log',
        'inferred_activity',
        'unverifiable',
      ];
      assert.deepEqual(PROVENANCE_STATUSES, expectedTiers, 'PROVENANCE_STATUSES must match approved 4 tiers');
      assert.deepEqual(PROVENANCE_TIERS, expectedTiers, 'PROVENANCE_TIERS alias must match approved 4 tiers');
    });

    it('should derive correct provenance tier across all four evidence scenarios', () => {
      // Tier 1: Creation timestamp present, no logs precede it
      const tier1 = deriveTrackingHorizon(
        { id: 'h1', createdAt: '2026-10-15T10:00:00Z' },
        [{ date: '2026-10-16', completedHabitIds: ['h1'] }],
        'UTC'
      );
      assert.equal(tier1.status, 'verified_creation');
      assert.equal(tier1.startDate, '2026-10-15');

      // Tier 2: Log precedes createdAt timestamp (re-seeded habit)
      const tier2 = deriveTrackingHorizon(
        { id: 'h2', createdAt: '2026-10-15T10:00:00Z' },
        [
          { date: '2026-10-10', completedHabitIds: ['h2'] },
          { date: '2026-10-16', completedHabitIds: ['h2'] },
        ],
        'UTC'
      );
      assert.equal(tier2.status, 'verified_first_log');
      assert.equal(tier2.startDate, '2026-10-10');

      // Tier 3: Lacks createdAt, anchored to earliest completed log
      const tier3 = deriveTrackingHorizon(
        { id: 'h3' },
        [
          { date: '2026-10-12', completedHabitIds: ['h3'] },
          { date: '2026-10-14', completedHabitIds: ['h3'] },
        ],
        'UTC'
      );
      assert.equal(tier3.status, 'inferred_activity');
      assert.equal(tier3.startDate, '2026-10-12');

      // Tier 4: Lacks createdAt and zero logs exist
      const tier4 = deriveTrackingHorizon(
        { id: 'h4' },
        [{ date: '2026-10-12', completedHabitIds: ['other'] }],
        'UTC'
      );
      assert.equal(tier4.status, 'unverifiable');
      assert.equal(tier4.startDate, null);
    });
  });

  // ==========================================================================
  // 2. Carry-Forward Issue 2: Daily Log 3-Layer Outcome Architecture
  // ==========================================================================
  describe('2. Daily Log 3-Layer Outcome Architecture', () => {
    it('should maintain strict separation between persisted statuses and domain statuses', () => {
      assert.deepEqual(
        PERSISTED_OUTCOME_STATUSES,
        ['completed', 'skipped', 'missed'],
        'Persisted outcomes must only be completed, skipped, or missed'
      );
      assert.ok(
        !PERSISTED_OUTCOME_STATUSES.includes('unrecorded'),
        'unrecorded must NEVER be persisted to Firestore'
      );
      assert.deepEqual(
        DOMAIN_OUTCOME_STATUSES,
        ['completed', 'skipped', 'missed', 'unrecorded'],
        'Domain outcome statuses must include derived unrecorded'
      );
    });

    it('should reject unrecorded in validateDailyLogDoc persisted validation', () => {
      const invalidDoc = {
        id: 'user1_2026-10-17',
        userId: 'user1',
        date: '2026-10-17',
        habitOutcomes: {
          habit1: { status: 'unrecorded' },
        },
      };
      const res = validateDailyLogDoc(invalidDoc);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some(e => e.includes("Invalid persisted outcome status 'unrecorded'")));
    });

    it('should accept valid persisted outcomes in validateDailyLogDoc', () => {
      const validDoc = {
        id: 'user1_2026-10-17',
        userId: 'user1',
        date: '2026-10-17',
        completedHabitIds: ['habit1'],
        habitOutcomes: {
          habit1: { status: 'completed' },
          habit2: { status: 'skipped', reason: 'Rest day' },
          habit3: { status: 'missed', reason: 'Travel' },
        },
      };
      const res = validateDailyLogDoc(validDoc);
      assert.equal(res.valid, true, `Validation failed: ${res.errors.join('; ')}`);
    });
  });

  // ==========================================================================
  // 3. Carry-Forward Issue 3: 04:00 AM Observance Boundary Consistency
  // ==========================================================================
  describe('3. 04:00 AM Observance Boundary Consistency', () => {
    it('should assign 03:59:59 to previous day and exactly 04:00:00 to current day in UTC', () => {
      // 2026-10-17 03:59:59.999 UTC -> belongs to logical date 2026-10-16
      const beforeBoundary = new Date('2026-10-17T03:59:59.999Z').getTime();
      assert.equal(resolveObservanceDate(beforeBoundary, 'UTC'), '2026-10-16');

      // 2026-10-17 04:00:00.000 UTC -> belongs to logical date 2026-10-17
      const exactBoundary = new Date('2026-10-17T04:00:00.000Z').getTime();
      assert.equal(resolveObservanceDate(exactBoundary, 'UTC'), '2026-10-17');

      // 2026-10-17 04:00:01.000 UTC -> belongs to logical date 2026-10-17
      const afterBoundary = new Date('2026-10-17T04:00:01.000Z').getTime();
      assert.equal(resolveObservanceDate(afterBoundary, 'UTC'), '2026-10-17');
    });

    it('should evaluate 04:00 AM boundary correctly in Indian Standard Time (Asia/Kolkata)', () => {
      // Asia/Kolkata is UTC+05:30.
      // 03:59:59 IST on 2026-10-17 is 2026-10-16T22:29:59Z UTC -> belongs to logical date 2026-10-16
      const beforeIST = new Date('2026-10-16T22:29:59.000Z').getTime();
      assert.equal(resolveObservanceDate(beforeIST, 'Asia/Kolkata'), '2026-10-16');

      // 04:00:00 IST on 2026-10-17 is 2026-10-16T22:30:00Z UTC -> belongs to logical date 2026-10-17
      const exactIST = new Date('2026-10-16T22:30:00.000Z').getTime();
      assert.equal(resolveObservanceDate(exactIST, 'Asia/Kolkata'), '2026-10-17');

      // 04:00:01 IST on 2026-10-17 is 2026-10-16T22:30:01Z UTC -> belongs to logical date 2026-10-17
      const afterIST = new Date('2026-10-16T22:30:01.000Z').getTime();
      assert.equal(resolveObservanceDate(afterIST, 'Asia/Kolkata'), '2026-10-17');
    });

    it('should evaluate 04:00 AM boundary correctly in America/New_York (EDT = UTC-04:00)', () => {
      // 03:59:59 EDT on 2026-10-17 is 2026-10-17T07:59:59Z UTC -> logical date 2026-10-16
      const beforeEDT = new Date('2026-10-17T07:59:59.000Z').getTime();
      assert.equal(resolveObservanceDate(beforeEDT, 'America/New_York'), '2026-10-16');

      // 04:00:00 EDT on 2026-10-17 is 2026-10-17T08:00:00Z UTC -> logical date 2026-10-17
      const exactEDT = new Date('2026-10-17T08:00:00.000Z').getTime();
      assert.equal(resolveObservanceDate(exactEDT, 'America/New_York'), '2026-10-17');
    });
  });

  // ==========================================================================
  // 4. Carry-Forward Issue 4: Composable Habit Model & 6 Feature Slots Validation
  // ==========================================================================
  describe('4. Composable Habit Model & 6 Feature Slots Validation', () => {
    it('should define exactly 6 approved feature slots', () => {
      const expectedSlots = ['counter', 'timer', 'checklist', 'notes', 'catalog', 'daySchedule'];
      assert.deepEqual(APPROVED_FEATURE_SLOTS, expectedSlots, 'APPROVED_FEATURE_SLOTS must contain exactly the 6 slots');
    });

    it('should validate multi-feature habits respecting the catalog and daySchedule mutex', () => {
      const fullHabitWithCatalog = {
        id: 'habit_multi_feature_1',
        userId: 'usr_full_feature',
        title: 'Complete Morning System',
        category: 'Reflection & Journaling',
        schedule: {
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          timingType: 'preferred_period',
          preferredPeriod: 'Morning',
          restDays: ['Sat', 'Sun'],
        },
        features: {
          counter: { enabled: true, targetCount: 3, unit: 'rounds', step: 1, minCount: 0 },
          timer: { enabled: true, targetDurationMinutes: 20, mode: 'countdown', soundOnComplete: true },
          checklist: {
            enabled: true,
            items: [
              { id: 'step_1', label: 'Hydrate', order: 0 },
              { id: 'step_2', label: 'Journal', order: 1 },
            ],
          },
          notes: {
            enabled: true,
            isPrivateDiary: false,
            placeholder: 'Daily reflections...',
            reflectionPrompts: ['What are you grateful for today?'],
          },
          catalog: {
            enabled: true,
            catalogId: 'osho_audio',
            catalogTitle: 'Osho Discourses',
            totalItems: 30,
            items: [],
          },
          daySchedule: {
            enabled: false,
            planTitle: '',
            dayVariations: {},
          },
        },
        lifecycle: {
          trackingHorizon: { startDate: '2026-10-17', status: 'verified_creation' },
        },
      };

      const result = validateComposableHabit(fullHabitWithCatalog);
      assert.equal(result.valid, true, `Expected valid habit, errors: ${result.errors.join('; ')}`);

      // Mutex test: catalog and daySchedule cannot be enabled together
      const conflictingHabit = {
        ...fullHabitWithCatalog,
        features: {
          ...fullHabitWithCatalog.features,
          daySchedule: {
            enabled: true,
            planTitle: '12-Week Mobility',
            dayVariations: {},
          },
        },
      };
      const conflictResult = validateComposableHabit(conflictingHabit);
      assert.equal(conflictResult.valid, false, 'Expected mutex failure when both catalog and daySchedule are enabled');
      assert.ok(conflictResult.errors.some(e => e.includes('Catalog and DaySchedule features cannot be enabled simultaneously')));
    });

    it('should catch invalid parameters in each individual feature slot', () => {
      // Counter: negative target
      assert.ok(validateComposableHabit({
        id: 'h1', userId: 'u1', title: 'T', category: 'Reflection & Journaling',
        schedule: { frequency: ['Mon'] },
        features: { counter: { enabled: true, targetCount: -1, unit: 'reps' } },
        lifecycle: { trackingHorizon: { startDate: '2026-10-17', status: 'verified_creation' } },
      }).errors.some(e => e.includes('Counter targetCount must be a positive number')));

      // Counter: empty unit
      assert.ok(validateComposableHabit({
        id: 'h1', userId: 'u1', title: 'T', category: 'Reflection & Journaling',
        schedule: { frequency: ['Mon'] },
        features: { counter: { enabled: true, targetCount: 5, unit: '  ' } },
        lifecycle: { trackingHorizon: { startDate: '2026-10-17', status: 'verified_creation' } },
      }).errors.some(e => e.includes('Counter unit must be a non-empty string')));

      // Timer: zero duration
      assert.ok(validateComposableHabit({
        id: 'h1', userId: 'u1', title: 'T', category: 'Reflection & Journaling',
        schedule: { frequency: ['Mon'] },
        features: { timer: { enabled: true, targetDurationMinutes: 0 } },
        lifecycle: { trackingHorizon: { startDate: '2026-10-17', status: 'verified_creation' } },
      }).errors.some(e => e.includes('Timer targetDurationMinutes must be a positive number')));

      // Checklist: non-array items
      assert.ok(validateComposableHabit({
        id: 'h1', userId: 'u1', title: 'T', category: 'Reflection & Journaling',
        schedule: { frequency: ['Mon'] },
        features: { checklist: { enabled: true, items: 'not an array' } },
        lifecycle: { trackingHorizon: { startDate: '2026-10-17', status: 'verified_creation' } },
      }).errors.some(e => e.includes('Checklist items must be an array')));

      // Catalog: missing catalogTitle
      assert.ok(validateComposableHabit({
        id: 'h1', userId: 'u1', title: 'T', category: 'Reflection & Journaling',
        schedule: { frequency: ['Mon'] },
        features: { catalog: { enabled: true, catalogId: 'cat1', catalogTitle: '', items: [] } },
        lifecycle: { trackingHorizon: { startDate: '2026-10-17', status: 'verified_creation' } },
      }).errors.some(e => e.includes('Catalog catalogTitle is required')));
    });
  });

  // ==========================================================================
  // 5. Carry-Forward Issue 5: Conflicting Completion Record Precedence
  // ==========================================================================
  describe('5. Conflicting Completion Precedence & Warning', () => {
    it('should prioritize completedHabitIds over contradictory habitOutcomes status with structured warning', () => {
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (msg) => warnings.push(msg);

      try {
        const rawLog = {
          id: 'user123_2026-10-17',
          userId: 'user123',
          date: '2026-10-17',
          completedHabitIds: ['habit_conflicted'],
          habitOutcomes: {
            habit_conflicted: { status: 'skipped', reason: 'Felt tired' },
          },
        };

        const normalized = normalizeDailyLogFromFirestore(rawLog);

        assert.equal(normalized.habitOutcomes.habit_conflicted.status, 'completed');
        assert.equal(normalized.getHabitStatus('habit_conflicted'), 'completed');
        assert.ok(warnings.some(w => w.includes('Conflicting habit outcome resolved to completed for habit_conflicted')));
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  // ==========================================================================
  // 6. Mandatory Removal of Specified UI Elements & Dead Code Verification
  // ==========================================================================
  describe('6. Mandatory Removal of Specified UI Elements & Dead Code Verification', () => {
    it('should verify the complete absence of the 3 specified UI elements from habits page and HabitModal', () => {
      const habitsPagePath = path.join(webRoot, 'src', 'app', '(protected)', 'habits', 'page.js');
      const habitModalPath = path.join(webRoot, 'src', 'components', 'habits', 'HabitModal.js');

      const pageContent = fs.readFileSync(habitsPagePath, 'utf8');
      const modalContent = fs.readFileSync(habitModalPath, 'utf8');

      // Element 1: "Atomic Feature Slots" section header and its Browse Templates button
      assert.ok(!modalContent.includes('Atomic Feature Slots'), 'HabitModal must not contain "Atomic Feature Slots" header');
      assert.ok(!modalContent.includes('Browse Templates'), 'HabitModal must not contain "Browse Templates" button');

      // Element 2: Header Templates button with title "Browse Curated Templates"
      assert.ok(!modalContent.includes('title="Browse Curated Templates"'), 'HabitModal must not contain button with title "Browse Curated Templates"');
      assert.ok(!modalContent.includes('RoutineTemplateModal'), 'HabitModal must not import or render RoutineTemplateModal');

      // Element 3: "New" button in /habits page header
      assert.ok(!pageContent.includes('<span>New</span>'), 'habits page must not contain "New" button');
      assert.ok(!pageContent.includes('<span>Templates</span>'), 'habits page must not contain "Templates" button');
      assert.ok(!pageContent.includes('<span>Browse Templates</span>'), 'habits page must not contain "Browse Templates" button');
      assert.ok(!pageContent.includes('RoutineTemplateModal'), 'habits page must not import or render RoutineTemplateModal');
    });

    it('should verify that deleted template files and dead re-exports are completely removed', () => {
      const tplModalPath = path.join(webRoot, 'src', 'components', 'habits', 'RoutineTemplateModal.js');
      const tplDataPath = path.join(webRoot, 'src', 'lib', 'constants', 'routine-templates.js');
      const habitsIndexPath = path.join(webRoot, 'src', 'components', 'habits', 'index.js');

      assert.ok(!fs.existsSync(tplModalPath), 'RoutineTemplateModal.js must be removed');
      assert.ok(!fs.existsSync(tplDataPath), 'routine-templates.js must be removed');

      const indexContent = fs.readFileSync(habitsIndexPath, 'utf8');
      assert.ok(!indexContent.includes('RoutineTemplateModal'), 'habits/index.js must not export RoutineTemplateModal');
    });

    it('should enforce zero occurrences of prohibited purple and indigo color tokens in protected routes and components', () => {
      const targetDirs = [
        path.join(webRoot, 'src', 'app', '(protected)'),
        path.join(webRoot, 'src', 'components'),
      ];

      function checkDir(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
            checkDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              // Ignore comments
              const trimmed = line.trim();
              if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
              if (line.includes('purple-') || line.includes('indigo-')) {
                assert.fail(`Prohibited color token found in ${fullPath}:${idx + 1}: ${trimmed}`);
              }
            });
          }
        }
      }

      for (const d of targetDirs) {
        if (fs.existsSync(d)) checkDir(d);
      }
    });
  });

  // ==========================================================================
  // 7. Mandatory Preservation of Existing Osho Disclosure and Content
  // ==========================================================================
  describe('7. Mandatory Preservation of Existing Osho Disclosure and Content', () => {
    it('should assert the presence and exact wording of the Osho card disclosure and links', () => {
      const oshoCardPath = path.join(webRoot, 'src', 'components', 'habits', 'slots', 'SlotCatalog.js');
      assert.ok(fs.existsSync(oshoCardPath), 'SlotCatalog.js must exist');

      const content = fs.readFileSync(oshoCardPath, 'utf8');

      // Exact primary disclosure sentence
      assert.ok(
        content.includes('Daily listening for awareness & self-inquiry • Series progress is separate'),
        'OshoCard must preserve exact disclosure text: "Daily listening for awareness & self-inquiry • Series progress is separate"'
      );

      // Exact library modal launch button
      assert.ok(
        content.includes('Explore All 30 Discourse Titles & Links'),
        'OshoCard must preserve exact footer action: "Explore All 30 Discourse Titles & Links"'
      );

      // Decoupled series progress indicator
      assert.ok(
        content.includes('Series Progress: Talk'),
        'OshoCard must preserve series progress tracking indicator'
      );
    });

    it('should assert the presence of library notices and search attributions in OshoLibraryModal', () => {
      const modalPath = path.join(webRoot, 'src', 'components', 'habits', 'OshoLibraryModal.js');
      assert.ok(fs.existsSync(modalPath), 'OshoLibraryModal.js must exist');

      const content = fs.readFileSync(modalPath, 'utf8');

      // Uncertainty notes and external search attribution
      assert.ok(
        content.includes('Search on YouTube') && content.includes('View on OshoWorld.com'),
        'OshoLibraryModal must preserve OshoWorld vs YouTube external search attributions'
      );
      assert.ok(
        content.includes('Discovery search query, not direct recording'),
        'OshoLibraryModal must preserve the YouTube discovery search uncertainty notice'
      );
    });
  });

  // ==========================================================================
  // 8. Persistence Round-Trip & Composable Feature Editing
  // ==========================================================================
  describe('8. Persistence Round-Trip & Composable Feature Editing', () => {
    it('should round-trip serialize and normalize a composable habit preserving all features', () => {
      const habit = {
        id: 'usr_persist_test_habit_1',
        userId: 'usr_persist_test',
        title: 'English Workbook Practice',
        category: 'Learning & Growth',
        schedule: {
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          restDays: ['Sun'],
          timingType: 'anytime',
          preferredPeriod: null,
          relativeTiming: null,
          exactTime: null,
          order: 0,
        },
        features: {
          counter: { enabled: true, targetCount: 2, unit: 'exercises', step: 1, minCount: 0 },
          timer: { enabled: false, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: true },
          checklist: {
            enabled: true,
            items: [
              { id: 'item_1', label: 'Grammar exercises', order: 0 },
              { id: 'item_2', label: 'Vocabulary review', order: 1 },
            ],
          },
          notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
          catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
          daySchedule: { enabled: false, planTitle: '', totalWeeks: 12, dayVariations: {} },
        },
        lifecycle: {
          trackingHorizon: { startDate: '2026-10-17', status: 'verified_creation' },
          scheduleHistory: [],
        },
      };

      const serialized = serializeHabitForFirestore(habit);
      const normalized = normalizeHabitFromFirestore(serialized, habit.id);

      assert.equal(normalized.id, habit.id);
      assert.equal(normalized.title, habit.title);
      assert.equal(normalized.category, habit.category);
      assert.deepEqual(normalized.schedule.frequency, habit.schedule.frequency);
      assert.deepEqual(normalized.schedule.restDays, habit.schedule.restDays);
      assert.equal(normalized.features.counter.enabled, true);
      assert.equal(normalized.features.counter.targetCount, 2);
      assert.equal(normalized.features.checklist.enabled, true);
      assert.equal(normalized.features.checklist.items.length, 2);
    });

    it('should preserve schedule history across non-retroactive schedule updates', () => {
      const habit = {
        id: 'usr_hist_test_habit_1',
        userId: 'usr_hist_test',
        title: 'Morning Yoga',
        category: 'Health & Fitness',
        schedule: {
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          restDays: ['Sun'],
          timingType: 'anytime',
        },
        features: {
          counter: { enabled: false },
          timer: { enabled: false },
          checklist: { enabled: false, items: [] },
          notes: { enabled: false },
          catalog: { enabled: false },
          daySchedule: { enabled: false },
        },
        lifecycle: {
          trackingHorizon: { startDate: '2026-10-01', status: 'verified_creation' },
          scheduleHistory: [],
        },
      };

      // Schedule update on 2026-11-01: Change frequency to Mon-Fri only
      const updatedSchedule = {
        ...habit.schedule,
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        restDays: ['Sat', 'Sun'],
      };

      const updatedHabit = applyScheduleUpdate(habit, updatedSchedule, '2026-11-01');

      // Target date before 2026-11-01 evaluates to original Mon-Sat schedule
      const effectiveOct = getEffectiveScheduleForDate(updatedHabit, '2026-10-25');
      assert.deepEqual(effectiveOct.frequency, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
      assert.deepEqual(effectiveOct.restDays, ['Sun']);

      // Target date on or after 2026-11-01 evaluates to new Mon-Fri schedule
      const effectiveNov = getEffectiveScheduleForDate(updatedHabit, '2026-11-05');
      assert.deepEqual(effectiveNov.frequency, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      assert.deepEqual(effectiveNov.restDays, ['Sat', 'Sun']);
    });
  });
});
