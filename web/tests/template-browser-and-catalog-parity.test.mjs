import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeForFirestore } from '../src/lib/firebase/firestore.js';
import {
  deriveCompletedProgressForHabit,
  deriveUncompletedProgressForHabit,
  isFeatureSatisfied,
  evaluateHabitCompletion,
} from '../src/lib/constants/habit-models.js';
import { OSHO_LIBRARY } from '../src/lib/fixtures/osho-library.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

describe('TemplateBrowserModal & HabitModal Parity', () => {
  const templateBrowserPath = path.join(webRoot, 'src', 'components', 'habits', 'TemplateBrowserModal.js');
  const habitModalPath = path.join(webRoot, 'src', 'components', 'habits', 'HabitModal.js');

  it('should verify TemplateBrowserModal exists and has valid source', () => {
    assert.ok(fs.existsSync(templateBrowserPath), 'TemplateBrowserModal.js must exist');
    const content = fs.readFileSync(templateBrowserPath, 'utf8');
    assert.ok(content.includes('export default function TemplateBrowserModal'), 'Must export default TemplateBrowserModal');
  });

  it('should verify TemplateBrowserModal container matches HabitModal sizing and bottom-sheet conventions', () => {
    const tplContent = fs.readFileSync(templateBrowserPath, 'utf8');
    const modalContent = fs.readFileSync(habitModalPath, 'utf8');

    // Container sizing parity
    assert.ok(
      tplContent.includes('rounded-t-3xl sm:rounded-2xl'),
      'TemplateBrowserModal must use rounded-t-3xl sm:rounded-2xl matching HabitModal'
    );
    assert.ok(
      tplContent.includes('max-w-xl sm:max-w-2xl'),
      'TemplateBrowserModal must use max-w-xl sm:max-w-2xl matching HabitModal'
    );
    assert.ok(
      tplContent.includes('max-h-[92vh] sm:max-h-[90vh]'),
      'TemplateBrowserModal must match max-h-[92vh] sm:max-h-[90vh]'
    );
    assert.ok(
      tplContent.includes('items-end sm:items-center'),
      'TemplateBrowserModal must use items-end sm:items-center for mobile bottom sheet'
    );
  });

  it('should verify header layout and close button parity between TemplateBrowserModal and HabitModal', () => {
    const tplContent = fs.readFileSync(templateBrowserPath, 'utf8');
    const modalContent = fs.readFileSync(habitModalPath, 'utf8');

    // Header padding and hierarchy
    assert.ok(
      tplContent.includes('px-5 py-3.5 sm:py-4 flex items-center justify-between flex-shrink-0'),
      'TemplateBrowserModal must match HabitModal header container classes'
    );
    assert.ok(
      tplContent.includes('text-base sm:text-lg font-bold text-main leading-tight'),
      'TemplateBrowserModal must match HabitModal header title typography'
    );
    assert.ok(
      tplContent.includes('text-2xs text-sub'),
      'TemplateBrowserModal must match HabitModal header subtitle typography'
    );

    // Close button parity: rounded-full w-8 h-8
    assert.ok(
      tplContent.includes('w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800'),
      'TemplateBrowserModal must use w-8 h-8 rounded-full close button matching HabitModal'
    );
  });

  it('should verify sticky action bar footer parity with HabitModal', () => {
    const tplContent = fs.readFileSync(templateBrowserPath, 'utf8');
    assert.ok(
      tplContent.includes('bg-surface border-t border-subtle px-5 py-2.5 flex items-center'),
      'TemplateBrowserModal must use bg-surface border-t border-subtle px-5 py-2.5 action bar'
    );
  });

  it('should verify all 6 approved feature slot filters are available in TemplateBrowserModal', () => {
    const tplContent = fs.readFileSync(templateBrowserPath, 'utf8');
    const requiredFilters = ['counter', 'timer', 'checklist', 'notes', 'catalog', 'daySchedule'];
    for (const filterKey of requiredFilters) {
      assert.ok(
        tplContent.includes(`id: '${filterKey}'`),
        `TemplateBrowserModal must provide filter for feature slot '${filterKey}'`
      );
    }
  });
});

describe('Firestore Sanitization & Undefined Prevention', () => {
  it('should recursively strip undefined properties from nested objects and arrays', () => {
    const dirtyData = {
      title: 'Practice Reading',
      category: 'Reading & Growth',
      features: {
        timer: {
          enabled: true,
          targetDurationMinutes: 20,
          mode: undefined,
        },
        catalog: {
          enabled: true,
          items: [
            { id: 'item_1', title: 'Chapter 1', url: undefined, description: undefined },
            { id: 'item_2', title: 'Chapter 2', url: 'https://example.com/ch2', description: 'Deep focus' },
          ],
        },
      },
      tags: ['study', undefined, 'focus'],
      extra: undefined,
    };

    const clean = sanitizeForFirestore(dirtyData);

    assert.equal(clean.title, 'Practice Reading');
    assert.equal(clean.category, 'Reading & Growth');
    assert.equal(clean.extra, undefined);
    assert.equal('extra' in clean, false);

    assert.equal(clean.features.timer.enabled, true);
    assert.equal(clean.features.timer.targetDurationMinutes, 20);
    assert.equal('mode' in clean.features.timer, false);

    assert.equal(clean.features.catalog.items.length, 2);
    assert.equal('url' in clean.features.catalog.items[0], false);
    assert.equal('description' in clean.features.catalog.items[0], false);
    assert.equal(clean.features.catalog.items[1].url, 'https://example.com/ch2');
    assert.equal(clean.features.catalog.items[1].description, 'Deep focus');

    assert.deepEqual(clean.tags, ['study', 'focus']);
  });

  it('should preserve Date instances and Firestore sentinel objects intact', () => {
    const date = new Date('2026-10-17T12:00:00Z');
    class MockFieldValue {
      constructor(type) { this.type = type; }
    }
    const mockTimestamp = new MockFieldValue('serverTimestamp');

    const input = {
      createdAt: mockTimestamp,
      lastActive: date,
      nested: {
        timestamp: mockTimestamp,
      },
    };

    const sanitized = sanitizeForFirestore(input);
    assert.equal(sanitized.createdAt, mockTimestamp);
    assert.equal(sanitized.lastActive, date);
    assert.equal(sanitized.nested.timestamp, mockTimestamp);
  });
});

describe('Multi-Item Catalog Creation & Lifecycle Parity', () => {
  it('should verify Osho library preset produces 30 items without any undefined fields', () => {
    const oshoItems = OSHO_LIBRARY.map((s) => ({
      id: s.id,
      title: `${s.order}. ${s.title}`,
      description: `${s.theme} (${s.language})`,
      order: s.order,
      ...(s.url ? { url: s.url } : {}),
    }));

    assert.equal(oshoItems.length, 30);
    for (let i = 0; i < oshoItems.length; i++) {
      const item = oshoItems[i];
      assert.ok(item.id, `Item ${i} must have id`);
      assert.ok(item.title, `Item ${i} must have title`);
      assert.ok(item.description, `Item ${i} must have description`);
      assert.equal(typeof item.order, 'number');
      // No property should have value undefined
      for (const [key, val] of Object.entries(item)) {
        assert.notEqual(val, undefined, `Item ${i} property '${key}' must not be undefined`);
      }
    }
  });

  it('should verify general catalog item creation without optional url or description', () => {
    const rawCatalogItems = [
      { id: 'item_1', title: 'Calculus Lecture 1', label: 'Calculus Lecture 1' },
      { id: 'item_2', title: 'Calculus Lecture 2', url: 'https://mit.edu/1801', description: 'Limits and derivatives' },
    ];

    const sanitizedItems = rawCatalogItems
      .filter(item => item && (item.title || item.label)?.trim())
      .map((item, idx) => ({
        id: item.id || `item_${idx + 1}`,
        title: (item.title || item.label || '').trim(),
        order: idx + 1,
        ...(item.description?.trim() ? { description: item.description.trim() } : {}),
        ...(item.url?.trim() ? { url: item.url.trim() } : {}),
      }));

    assert.equal(sanitizedItems.length, 2);
    assert.equal(sanitizedItems[0].title, 'Calculus Lecture 1');
    assert.equal('url' in sanitizedItems[0], false);
    assert.equal('description' in sanitizedItems[0], false);
    assert.equal(sanitizedItems[1].url, 'https://mit.edu/1801');
    assert.equal(sanitizedItems[1].description, 'Limits and derivatives');
  });

  it('should synchronize completedCatalogItemIds when parent checkbox is activated for generic catalog', () => {
    const genericHabit = {
      id: 'habit_curriculum_1',
      title: 'Python Deep Dive',
      category: 'Personal Growth & Learning',
      features: {
        catalog: {
          enabled: true,
          catalogId: 'python_curriculum',
          catalogTitle: 'Python Mastery',
          items: [
            { id: 'py_01', title: '1. Generators and Iterators' },
            { id: 'py_02', title: '2. Metaclasses and Descriptors' },
            { id: 'py_03', title: '3. AsyncIO Internals' },
          ],
        },
      },
    };

    const initialProgress = {};
    const completedProgress = deriveCompletedProgressForHabit(genericHabit, initialProgress);

    assert.equal(completedProgress.catalogItemCompleted, true);
    assert.equal(completedProgress.talkCompleted, true);
    assert.deepEqual(completedProgress.completedCatalogItemIds, ['py_01', 'py_02', 'py_03']);

    // Check evaluateHabitCompletion
    assert.equal(evaluateHabitCompletion(genericHabit, completedProgress), true);

    // Now uncomplete parent
    const uncompletedProgress = deriveUncompletedProgressForHabit(genericHabit, completedProgress);
    assert.equal(uncompletedProgress.catalogItemCompleted, false);
    assert.equal(uncompletedProgress.talkCompleted, false);
    assert.deepEqual(uncompletedProgress.completedCatalogItemIds, []);
    assert.equal(evaluateHabitCompletion(genericHabit, uncompletedProgress), false);
  });

  it('should complete parent only when ALL items in generic catalog are checked individually', () => {
    const genericHabit = {
      id: 'habit_philosophy_1',
      title: 'Stoic Meditations Study',
      category: 'Spirituality & Mindfulness',
      features: {
        catalog: {
          enabled: true,
          catalogId: 'stoic_texts',
          catalogTitle: 'Marcus Aurelius Meditations',
          items: [
            { id: 'med_01', title: 'Book 1: Debts and Lessons' },
            { id: 'med_02', title: 'Book 2: On the River Gran' },
            { id: 'med_03', title: 'Book 3: In Carnuntum' },
          ],
        },
      },
    };

    // 1. Partial completion (1 of 3)
    const partial1 = {
      completedCatalogItemIds: ['med_01'],
      catalogItemCompleted: false,
    };
    assert.equal(isFeatureSatisfied('catalog', genericHabit.features.catalog, partial1), false);
    assert.equal(evaluateHabitCompletion(genericHabit, partial1), false);

    // 2. Partial completion (2 of 3)
    const partial2 = {
      completedCatalogItemIds: ['med_01', 'med_02'],
      catalogItemCompleted: false,
    };
    assert.equal(isFeatureSatisfied('catalog', genericHabit.features.catalog, partial2), false);
    assert.equal(evaluateHabitCompletion(genericHabit, partial2), false);

    // 3. Full completion (3 of 3)
    const allDone = {
      completedCatalogItemIds: ['med_01', 'med_02', 'med_03'],
      catalogItemCompleted: true,
    };
    assert.equal(isFeatureSatisfied('catalog', genericHabit.features.catalog, allDone), true);
    assert.equal(evaluateHabitCompletion(genericHabit, allDone), true);
  });

  it('should strictly preserve Osho disclosure promise: parent toggle never alters lifetime seriesProgress', () => {
    const oshoHabit = {
      id: 'habit_osho_1',
      stableKey: 'canonical_listen_osho',
      title: 'Listening & Awareness (Osho Discourse Audio)',
      category: 'Spirituality & Mindfulness',
      features: {
        catalog: {
          enabled: true,
          catalogId: 'osho_discourses',
          catalogTitle: 'Osho Discourse Audio Library',
          totalItems: 30,
          items: OSHO_LIBRARY.map(s => ({ id: s.id, title: s.title })),
        },
      },
    };

    const initialProgress = {
      seriesProgress: {
        osho_01: { completedTalks: 3, lastUpdated: '2026-10-10' },
      },
    };

    // Completing parent observance
    const nextProgress = deriveCompletedProgressForHabit(oshoHabit, initialProgress);
    assert.equal(nextProgress.catalogItemCompleted, true);
    assert.equal(nextProgress.talkCompleted, true);

    // seriesProgress MUST be untouched
    assert.deepEqual(nextProgress.seriesProgress, {
      osho_01: { completedTalks: 3, lastUpdated: '2026-10-10' },
    });
    // completedCatalogItemIds should NOT be set to all 30 Osho discourses
    assert.equal(nextProgress.completedCatalogItemIds, undefined);
  });
});

describe('Routine Persistence Safe Error Reporting & Diagnostics', async () => {
  const { getSafeSaveErrorMessage, logDiagnosticError } = await import('../src/lib/utils/error-helpers.js');

  it('should return safe user-friendly message for internal Firestore undefined errors without leaking internals', () => {
    const rawError = new Error('Function addDoc() called with invalid data. Unsupported field value: undefined (found in field features.catalog.items[0].description in document habits/123)');
    const safeMsg = getSafeSaveErrorMessage(rawError);
    assert.equal(safeMsg, 'Unable to save routine. Please check your inputs and try again.');
    assert.ok(!safeMsg.includes('undefined'), 'Must not expose internal undefined keyword to user');
    assert.ok(!safeMsg.includes('features.catalog'), 'Must not expose schema or field paths to user');
    assert.ok(!safeMsg.includes('habits/123'), 'Must not expose document path to user');
  });

  it('should map permission-denied errors to clear authentication guidance', () => {
    const permError = { code: 'permission-denied', message: 'Missing or insufficient permissions.' };
    const safeMsg = getSafeSaveErrorMessage(permError);
    assert.equal(safeMsg, 'Permission denied: Please ensure you are signed in and try again.');
  });

  it('should map network/offline errors to connectivity guidance', () => {
    const netError = { code: 'unavailable', message: 'Could not reach Cloud Firestore backend.' };
    const safeMsg = getSafeSaveErrorMessage(netError);
    assert.equal(safeMsg, 'Network error: Unable to reach the server. Please check your connection and try again.');
  });

  it('should map validation errors to form review guidance', () => {
    const valError = { name: 'ValidationError', message: 'Title is required' };
    const safeMsg = getSafeSaveErrorMessage(valError);
    assert.equal(safeMsg, 'Validation error: Please review the required routine fields and try again.');
  });

  it('should safely handle empty or null error inputs', () => {
    assert.equal(getSafeSaveErrorMessage(null), 'Unable to save routine. Please try again.');
    assert.equal(getSafeSaveErrorMessage(undefined), 'Unable to save routine. Please try again.');
  });
});

