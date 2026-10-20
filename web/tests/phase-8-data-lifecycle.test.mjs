import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Phase 8: Data-Loading Lifecycle, Safeguards & Error Invariants', () => {
  describe('1. Dashboard Page Data-Loading Safeguards', () => {
    it('should verify DashboardPage suppresses zero-streak & zero-progress before initial data resolves', () => {
      const content = readWebFile('src/app/(protected)/today/page.js');
      // Must have early return for loading state
      const loadingIdx = content.indexOf('if (loading)');
      const bannerIdx = content.indexOf('<TodayRhythmBanner');
      assert.ok(loadingIdx !== -1, 'Must have if (loading) guard');
      assert.ok(bannerIdx !== -1, 'Must render TodayRhythmBanner');
      assert.ok(loadingIdx < bannerIdx, 'if (loading) must precede TodayRhythmBanner to prevent 0-streak flash');
      assert.ok(content.includes('return <TodaySkeleton />;'), 'Must return TodaySkeleton during loading');
    });

    it('should verify DashboardPage renders error alert when Firestore subscription fails', () => {
      const content = readWebFile('src/app/(protected)/today/page.js');
      assert.ok(content.includes('{error && ('), 'Must check for error state');
      assert.ok(content.includes('bg-rose-50'), 'Must display error banner with rose styling');
    });
  });

  describe('2. Habits Page Empty-State & Seeding Safeguards', () => {
    it('should verify HabitsPage suppresses "No routines found" empty state while loading', () => {
      const content = readWebFile('src/app/(protected)/habits/page.js');
      const loadingIdx = content.indexOf('if (loading)');
      const emptyStateIdx = content.indexOf('No routines found');
      assert.ok(loadingIdx !== -1, 'Must have if (loading) guard');
      assert.ok(emptyStateIdx !== -1, 'Must render empty state message');
      assert.ok(loadingIdx < emptyStateIdx, 'if (loading) must precede empty-state to prevent flashing "No routines found"');
      assert.ok(content.includes('return <HabitsSkeleton />;'), 'Must return HabitsSkeleton during loading');
    });

    it('should verify HabitsPage displays create routine action when genuinely empty and loaded', () => {
      const content = readWebFile('src/app/(protected)/habits/page.js');
      assert.ok(content.includes('habits.length === 0 ?'), 'Must check habits.length === 0');
      assert.ok(content.includes('Create Routine'), 'Must provide action to create routine');
      assert.ok(content.includes('setShowModal(true)'), 'Must open routine modal');
    });
  });

  describe('3. Analytics Page Computation Safeguards', () => {
    it('should verify AnalyticsPage suppresses 0% statistics computation while loading', () => {
      const content = readWebFile('src/app/(protected)/insights/page.js');
      const loadingIdx = content.indexOf('if (loading)');
      const metricsIdx = content.indexOf('30-Day Consistency');
      assert.ok(loadingIdx !== -1, 'Must have if (loading) guard');
      assert.ok(metricsIdx !== -1, 'Must render metrics');
      assert.ok(loadingIdx < metricsIdx, 'if (loading) must precede metrics display');
      assert.ok(content.includes('return <InsightsSkeleton />;'), 'Must return InsightsSkeleton during loading');
    });
  });

  describe('4. Firestore Listener Lifecycle: Subsequent Live Updates', () => {
    it('should verify useHabits keeps loading=false during subsequent real-time updates', () => {
      const content = readWebFile('src/hooks/useHabits.js');
      assert.ok(content.includes('const unsubscribe = onSnapshot(habitsQuery'), 'Must attach onSnapshot listener');
      // Verify setLoading(false) is called inside onSnapshot, and not reset to true on updates
      assert.ok(content.includes('setLoading(false);'), 'Must set loading to false upon snapshot arrival');
      assert.ok(!content.includes('setLoading(true)') || content.indexOf('setLoading(true)') === content.lastIndexOf('setLoading(true)'), 'Must not reset loading=true on updates');
    });

    it('should verify useDailyLogs updates state reactively without resetting global page loading', () => {
      const content = readWebFile('src/hooks/useDailyLogs.js');
      assert.ok(content.includes('onSnapshot(dailyLogRef'), 'Must listen to daily log updates in real-time');
      assert.ok(content.includes('setTodayLog('), 'Must reactively update todayLog state');
      assert.ok(content.includes('setTodayProgress('), 'Must reactively update todayProgress state');
    });
  });

  describe('5. Unauthenticated Isolation & Shell Ownership Invariants', () => {
    it('should verify ProtectedLayout enforces authentication redirect before rendering shell', () => {
      const content = readWebFile('src/app/(protected)/layout.js');
      assert.ok(content.includes('if (loading)'), 'Must guard while auth is loading');
      assert.ok(content.includes('return <LoadingSpinner />;'), 'Must render LoadingSpinner during auth check');
      assert.ok(content.includes('if (!user) return null;'), 'Must render null for unauthenticated visitors');
      assert.ok(content.includes("router.push('/login');"), 'Must redirect unauthenticated visitors to /login');
    });

    it('should verify ProtectedLayout owns TopNav and BottomNav with zero page duplication', () => {
      const layoutContent = readWebFile('src/app/(protected)/layout.js');
      assert.ok(layoutContent.includes('<TopNav />') || layoutContent.includes('<TopNav'), 'Layout must own TopNav');
      assert.ok(layoutContent.includes('<BottomNav />'), 'Layout must own BottomNav');

      // Verify pages do not render TopNav
      const dashContent = readWebFile('src/app/(protected)/today/page.js');
      const habitsContent = readWebFile('src/app/(protected)/habits/page.js');
      const analyticsContent = readWebFile('src/app/(protected)/insights/page.js');

      assert.ok(!dashContent.includes('<TopNav'), 'today/page.js must not render TopNav');
      assert.ok(!habitsContent.includes('<TopNav'), 'habits/page.js must not render TopNav');
      assert.ok(!analyticsContent.includes('<TopNav'), 'insights/page.js must not render TopNav');
    });
  });

  describe('6. Reduced-Motion & Accessibility Invariants', () => {
    it('should verify LoadingSpinner supports reduced-motion fallback', () => {
      const content = readWebFile('src/components/ui/feedback/LoadingSpinner.js');
      assert.ok(content.includes('motion-safe:animate-[spin_1.6s_linear_infinite]'), 'Must use motion-safe for spin');
      assert.ok(content.includes('motion-reduce:border-t-subtle'), 'Must use static subtle border on motion-reduce');
      assert.ok(content.includes('role="status"'), 'Must have role="status"');
      assert.ok(content.includes('aria-live="polite"'), 'Must have aria-live="polite"');
    });

    it('should verify Skeleton supports reduced-motion fallback and accessibility attributes', () => {
      const content = readWebFile('src/components/ui/feedback/Skeleton.js');
      assert.ok(content.includes('motion-safe:animate-pulse'), 'Must use motion-safe for pulse');
      assert.ok(content.includes('motion-reduce:animate-none'), 'Must disable pulse on motion-reduce');
      assert.ok(content.includes('aria-hidden="true"'), 'Must hide decorative skeleton elements from screen readers');
    });

    it('should verify all skeleton containers declare semantic role="status" and aria-busy="true"', () => {
      const todaySkeleton = readWebFile('src/components/ui/feedback/TodaySkeleton.js');
      const habitsSkeleton = readWebFile('src/components/ui/feedback/HabitsSkeleton.js');
      const insightsSkeleton = readWebFile('src/components/ui/feedback/InsightsSkeleton.js');

      assert.ok(todaySkeleton.includes('role="status"') && todaySkeleton.includes('aria-busy="true"'));
      assert.ok(habitsSkeleton.includes('role="status"') && habitsSkeleton.includes('aria-busy="true"'));
      assert.ok(insightsSkeleton.includes('role="status"') && insightsSkeleton.includes('aria-busy="true"'));
    });
  });
});
