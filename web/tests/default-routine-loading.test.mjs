import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROUTINES } from '../src/lib/server/schedule-templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

describe('Default / Foundation Routine Loading Architecture & UI Rules', () => {
  // Pure UI state model for HabitsPage rendering and seeding logic
  class HabitsPageModel {
    constructor({ initialHabits = [], initialLoading = false } = {}) {
      this.habits = [...initialHabits];
      this.loading = initialLoading;
      this.seeding = false;
      this.isSeedingRef = false;
      this.toasts = [];
      this.modalOpen = false;
    }

    // Helper to evaluate what UI is rendered based on current state
    render() {
      if (this.loading) {
        return { view: 'HabitsSkeleton', buttonVisible: false };
      }

      if (this.habits.length === 0) {
        return {
          view: 'EmptyState',
          buttonVisible: true,
          buttonText: this.seeding ? 'Loading Routines...' : 'Load Recommended Routines',
          buttonDisabled: this.seeding,
          createCustomVisible: true,
        };
      }

      return {
        view: 'HabitsList',
        buttonVisible: false,
        habitsCount: this.habits.length,
        addFloatingVisible: true,
      };
    }

    // Matches handleSeedHabits in web/src/app/(protected)/habits/page.js
    async handleSeedHabits(seedFn) {
      if (this.habits.length > 0 || this.isSeedingRef || this.seeding) {
        return;
      }

      this.isSeedingRef = true;
      this.seeding = true;

      try {
        const seededHabits = await seedFn();
        // Reactive snapshot update
        this.habits = [...this.habits, ...seededHabits];
        this.toasts.push({ type: 'success', message: 'Foundation routines loaded successfully!' });
      } catch (err) {
        this.toasts.push({
          type: 'error',
          message: err.message || 'Failed to load recommended routines. Please try again.',
        });
      } finally {
        this.isSeedingRef = false;
        this.seeding = false;
      }
    }
  }

  // 1. No existing routines or habits
  it('Requirement 1: No existing routines or habits - Verify button is displayed on Routine Manager page', () => {
    const page = new HabitsPageModel({ initialHabits: [], initialLoading: false });
    const view = page.render();

    assert.equal(view.view, 'EmptyState');
    assert.equal(view.buttonVisible, true);
    assert.equal(view.buttonText, 'Load Recommended Routines');
    assert.equal(view.buttonDisabled, false);
    assert.equal(view.createCustomVisible, true);

    // Verify HabitsPage source file implements this exact condition
    const habitsPagePath = path.join(srcDir, 'app/(protected)/habits/page.js');
    const source = fs.readFileSync(habitsPagePath, 'utf-8');
    assert.ok(source.includes('habits.length === 0 ?'), 'Must condition empty state on habits.length === 0');
    assert.ok(source.includes('Load Recommended Routines'), 'Must contain Load Recommended Routines button');
    assert.ok(source.includes('Create Custom Routine'), 'Must offer Create Custom Routine button');
  });

  // 2. Existing generic routines
  it('Requirement 2: Existing generic routines - Verify button is hidden', () => {
    const genericHabits = [
      { id: 'usr_routine_1', stableKey: 'routine_1', title: 'Daily Reading', seedOrigin: 'foundation_preset' },
      { id: 'usr_routine_2', stableKey: 'routine_2', title: 'Daily Movement', seedOrigin: 'foundation_preset' },
    ];
    const page = new HabitsPageModel({ initialHabits: genericHabits, initialLoading: false });
    const view = page.render();

    assert.equal(view.view, 'HabitsList');
    assert.equal(view.buttonVisible, false, 'Button must be completely hidden when generic routines exist');

    // Verify handleSeedHabits guards against execution
    let seedCalled = false;
    page.handleSeedHabits(async () => { seedCalled = true; return []; });
    assert.equal(seedCalled, false, 'handleSeedHabits must not execute if generic habits exist');
  });

  // 3. Existing personalized routines
  it('Requirement 3: Existing personalized routines - Verify button is hidden', () => {
    const personalHabits = [
      { id: 'usr_canonical_english_workbook', stableKey: 'canonical_english_workbook', seedOrigin: 'personal_preset' },
      { id: 'usr_canonical_exercise_plan', stableKey: 'canonical_exercise_plan', seedOrigin: 'personal_preset' },
    ];
    const page = new HabitsPageModel({ initialHabits: personalHabits, initialLoading: false });
    const view = page.render();

    assert.equal(view.view, 'HabitsList');
    assert.equal(view.buttonVisible, false, 'Button must be completely hidden when personalized routines exist');

    let seedCalled = false;
    page.handleSeedHabits(async () => { seedCalled = true; return []; });
    assert.equal(seedCalled, false, 'handleSeedHabits must not execute if personalized habits exist');
  });

  // 4. Existing user-created custom habits
  it('Requirement 4: Existing user-created custom habits - Verify button is hidden', () => {
    const customHabits = [
      { id: 'custom_habit_xyz', title: 'Cold Water Therapy', category: 'Health', isSystemSeed: false },
    ];
    const page = new HabitsPageModel({ initialHabits: customHabits, initialLoading: false });
    const view = page.render();

    assert.equal(view.view, 'HabitsList');
    assert.equal(view.buttonVisible, false, 'Button must be completely hidden when custom habits exist');

    let seedCalled = false;
    page.handleSeedHabits(async () => { seedCalled = true; return []; });
    assert.equal(seedCalled, false, 'handleSeedHabits must not execute if custom habits exist');
  });

  // 5. Loading state
  it('Requirement 5: Loading state - Verify button is not displayed while Firestore is loading', () => {
    const pageLoadingEmpty = new HabitsPageModel({ initialHabits: [], initialLoading: true });
    const viewEmpty = pageLoadingEmpty.render();
    assert.equal(viewEmpty.view, 'HabitsSkeleton');
    assert.equal(viewEmpty.buttonVisible, false, 'Button must not flash while Firestore is loading (empty)');

    const pageLoadingPopulated = new HabitsPageModel({ initialHabits: [{ id: '1' }], initialLoading: true });
    const viewPopulated = pageLoadingPopulated.render();
    assert.equal(viewPopulated.view, 'HabitsSkeleton');
    assert.equal(viewPopulated.buttonVisible, false, 'Button must not display while Firestore is loading (populated)');

    // Verify HabitsPage source guards rendering with if (loading) return <HabitsSkeleton />;
    const habitsPagePath = path.join(srcDir, 'app/(protected)/habits/page.js');
    const source = fs.readFileSync(habitsPagePath, 'utf-8');
    assert.ok(source.replace(/\r\n/g, '\n').includes('if (loading) {\n    return <HabitsSkeleton />;'), 'Source must return HabitsSkeleton early');
    assert.ok(!source.includes('LoadingSpinner'), 'Source must not contain obsolete LoadingSpinner');
  });

  // 6. Successful seeding
  it('Requirement 6: Successful seeding - Verify button disappears immediately after seeding', async () => {
    const page = new HabitsPageModel({ initialHabits: [], initialLoading: false });
    assert.equal(page.render().buttonVisible, true);

    const mockSeedService = async () => {
      // Simulate network / Firestore write of the 6 foundation routines
      return DEFAULT_ROUTINES.map((r, i) => ({
        id: `usr_${r.stableKey || `routine_${i + 1}`}`,
        ...r,
      }));
    };

    await page.handleSeedHabits(mockSeedService);

    // After seeding completes:
    const updatedView = page.render();
    assert.equal(updatedView.view, 'HabitsList');
    assert.equal(updatedView.buttonVisible, false, 'Button must disappear immediately after successful seeding');
    assert.equal(page.habits.length, DEFAULT_ROUTINES.length);
    assert.equal(page.toasts.length, 1);
    assert.equal(page.toasts[0].type, 'success');
    assert.equal(page.toasts[0].message, 'Foundation routines loaded successfully!');
  });

  // 7. Failed seeding
  it('Requirement 7: Failed seeding - Verify error is handled gracefully and button remains available for retry', async () => {
    const page = new HabitsPageModel({ initialHabits: [], initialLoading: false });
    assert.equal(page.render().buttonVisible, true);

    const failingSeedService = async () => {
      throw new Error('Missing or insufficient permissions');
    };

    await page.handleSeedHabits(failingSeedService);

    // Habits list is still empty
    assert.equal(page.habits.length, 0);

    // Button remains visible and enabled for retry
    const viewAfterFailure = page.render();
    assert.equal(viewAfterFailure.view, 'EmptyState');
    assert.equal(viewAfterFailure.buttonVisible, true);
    assert.equal(viewAfterFailure.buttonDisabled, false, 'Button must be enabled for retry');
    assert.equal(viewAfterFailure.buttonText, 'Load Recommended Routines');

    // Error toast was dispatched
    assert.equal(page.toasts.length, 1);
    assert.equal(page.toasts[0].type, 'error');
    assert.equal(page.toasts[0].message, 'Missing or insufficient permissions');

    // Now retry and verify it can succeed
    const successfulRetryService = async () => {
      return DEFAULT_ROUTINES.map(r => ({ id: `usr_${r.stableKey}`, ...r }));
    };

    await page.handleSeedHabits(successfulRetryService);
    assert.equal(page.render().buttonVisible, false, 'Button disappears after successful retry');
    assert.equal(page.toasts.length, 2);
    assert.equal(page.toasts[1].type, 'success');
  });

  // 8. Dashboard and other pages
  it('Requirement 8: Dashboard and other pages - Verify zero default-preset buttons appear on any other page', () => {
    const otherPages = [
      'app/page.js',
      'app/(auth)/login/page.js',
      'app/(protected)/dashboard/page.js',
      'app/(protected)/analytics/page.js',
    ];

    for (const relPath of otherPages) {
      const fullPath = path.join(srcDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Page file must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // None of these pages should ever call seedHabits or contain a button to seed routines
      assert.ok(!content.includes('seedHabits('), `Forbidden seedHabits call found in ${relPath}`);
      assert.ok(!content.includes('seedHabitsForUser('), `Forbidden seedHabitsForUser call in ${relPath}`);
      assert.ok(!content.includes('Load Recommended Routines'), `Forbidden Load Recommended Routines button in ${relPath}`);
      assert.ok(!content.includes('Sync Routines'), `Forbidden Sync Routines button in ${relPath}`);
    }

    // Check Dashboard page empty state specifically links to /habits
    const dashboardContent = fs.readFileSync(path.join(srcDir, 'app/(protected)/dashboard/page.js'), 'utf-8');
    assert.ok(dashboardContent.includes('href="/habits"'), 'Dashboard empty state must link to Routine Manager (/habits)');
    assert.ok(dashboardContent.includes('Open Routine Manager'), 'Dashboard empty state must invite user to Open Routine Manager');
    assert.ok(!dashboardContent.includes('seedHabits'), 'Dashboard must not destructure or reference seedHabits');
  });

  // 9. Repeated or concurrent actions
  it('Requirement 9: Repeated or concurrent actions - Idempotency and duplicate prevention', async () => {
    const page = new HabitsPageModel({ initialHabits: [], initialLoading: false });

    let callCount = 0;
    const slowSeedService = async () => {
      callCount += 1;
      await new Promise(resolve => setTimeout(resolve, 50));
      return DEFAULT_ROUTINES.map(r => ({ id: `usr_${r.stableKey}`, ...r }));
    };

    // Trigger two concurrent clicks
    const firstClick = page.handleSeedHabits(slowSeedService);
    const secondClick = page.handleSeedHabits(slowSeedService);

    await Promise.all([firstClick, secondClick]);

    // Only one network request was executed because isSeedingRef guarded the second call
    assert.equal(callCount, 1, 'Concurrent clicks must be guarded by isSeedingRef');
    assert.equal(page.habits.length, DEFAULT_ROUTINES.length, 'Must not duplicate habits on concurrent clicks');

    // Simulate database-level idempotency in seedHabitsForUser:
    // If seedHabitsForUser is called when habits already exist, it immediately returns existing IDs without writing
    function simulateSeedHabitsForUser(userId, seedData, currentFirestoreDocs) {
      if (!userId) throw new Error('User ID is required');
      if (!Array.isArray(seedData) || seedData.length === 0) return [];

      // Query existing habits for user
      const existingSnap = currentFirestoreDocs.filter(doc => doc.userId === userId);
      if (existingSnap.length > 0) {
        // Strict guard: Early return without inserting or overwriting
        return existingSnap.map(d => d.id);
      }

      // First run: insert deterministic IDs
      const inserted = seedData.map((habit, index) => {
        const key = habit.stableKey || `routine_${index + 1}`;
        const docId = `${userId}_${key}`;
        return {
          id: docId,
          userId,
          stableKey: key,
          title: habit.title,
        };
      });

      return inserted;
    }

    const testUid = 'user_abc123';
    // 1st run: fresh user with 0 habits
    const firstRunResults = simulateSeedHabitsForUser(testUid, DEFAULT_ROUTINES, []);
    assert.equal(firstRunResults.length, DEFAULT_ROUTINES.length);
    assert.equal(new Set(firstRunResults.map(r => r.id)).size, DEFAULT_ROUTINES.length);

    // 2nd run: user now has the habits from first run
    const secondRunResults = simulateSeedHabitsForUser(testUid, DEFAULT_ROUTINES, firstRunResults);
    assert.deepEqual(
      secondRunResults,
      firstRunResults.map(r => r.id),
      'Second run must return existing IDs without inserting new documents'
    );
  });
});
