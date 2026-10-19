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

function getSrcFiles(dir = path.join(webRoot, 'src')) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getSrcFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Phase 7: Loading Experience & Reduced-Motion Architecture', () => {
  describe('1. Brand LoadingSpinner Architecture & Elimination of Obsolete Overlays', () => {
    it('should verify LoadingSpinner implements calm concentric orbit with reduced-motion fallback', () => {
      const content = readWebFile('src/components/ui/feedback/LoadingSpinner.js');
      assert.ok(content.includes('motion-safe:animate-[spin_1.6s_linear_infinite]'), 'Must use motion-safe spinner animation');
      assert.ok(content.includes('motion-reduce:border-t-subtle'), 'Must use calm reduced-motion fallback');
      assert.ok(content.includes('role="status"'), 'Must declare role="status"');
      assert.ok(content.includes('bg-canvas/90'), 'Must use canvas background');
    });

    it('should verify UI index exports LoadingSpinner and contextual skeletons', () => {
      const content = readWebFile('src/components/ui/index.js');
      assert.ok(content.includes("export { default as LoadingSpinner } from './feedback/LoadingSpinner'"));
      assert.ok(content.includes("export { default as Skeleton } from './feedback/Skeleton'"));
      assert.ok(content.includes("export { default as DashboardSkeleton } from './feedback/DashboardSkeleton'"));
      assert.ok(content.includes("export { default as HabitsSkeleton } from './feedback/HabitsSkeleton'"));
      assert.ok(content.includes("export { default as AnalyticsSkeleton } from './feedback/AnalyticsSkeleton'"));
    });

    it('should verify elimination of obsolete z-[9999] high z-index overlay across web/src', () => {
      const srcFiles = getSrcFiles();
      for (const filePath of srcFiles) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rel = path.relative(webRoot, filePath);
        assert.ok(!fileContent.includes('z-[9999]'), `File ${rel} must not contain z-[9999] overlay`);
      }
    });
  });

  describe('2. Skeleton Primitive & Contextual Skeleton Implementations', () => {
    it('should verify Skeleton.js primitive with semantic tokens and reduced-motion support', () => {
      const content = readWebFile('src/components/ui/feedback/Skeleton.js');
      assert.ok(content.includes('motion-safe:animate-pulse'), 'Must use motion-safe:animate-pulse');
      assert.ok(content.includes('motion-reduce:animate-none'), 'Must use motion-reduce:animate-none');
      assert.ok(content.includes('aria-hidden="true"'), 'Must declare aria-hidden="true" for decorative placeholders');
      assert.ok(content.includes('bg-slate-200/70') && content.includes('dark:bg-slate-800/70'), 'Must use semantic surface tokens');
    });

    it('should verify DashboardSkeleton renders content-only main landmark and card anatomy', () => {
      const content = readWebFile('src/components/ui/feedback/DashboardSkeleton.js');
      assert.ok(!content.includes('<TopNav'), 'Must NOT include TopNav (owned by ProtectedLayout shell)');
      assert.ok(content.includes('<main'), 'Must render <main> landmark');
      assert.ok(content.includes('border-t-[3px]'), 'Must mirror card top border design token');
      assert.ok(content.includes('aria-busy="true"'), 'Must declare aria-busy="true" on loading container');
    });

    it('should verify HabitsSkeleton renders content-only main landmark and RoutineCard anatomy', () => {
      const content = readWebFile('src/components/ui/feedback/HabitsSkeleton.js');
      assert.ok(!content.includes('<TopNav'), 'Must NOT include TopNav (owned by ProtectedLayout shell)');
      assert.ok(content.includes('<main'), 'Must render <main> landmark');
      assert.ok(content.includes('pb-32 sm:pb-36'), 'Must preserve bottom clearance for FAB and BottomNav');
      assert.ok(content.includes('border-t-[3px]'), 'Must mirror category border design token');
    });

    it('should verify AnalyticsSkeleton renders content-only main landmark, tabs, and metrics grid', () => {
      const content = readWebFile('src/components/ui/feedback/AnalyticsSkeleton.js');
      assert.ok(!content.includes('<TopNav'), 'Must NOT include TopNav (owned by ProtectedLayout shell)');
      assert.ok(content.includes('<main'), 'Must render <main> landmark');
      assert.ok(content.includes('grid grid-cols-2'), 'Must mirror 2-metric card grid');
    });

    it('should verify UI index exports all contextual skeleton components', () => {
      const content = readWebFile('src/components/ui/index.js');
      assert.ok(content.includes("export { default as Skeleton } from './feedback/Skeleton'"));
      assert.ok(content.includes("export { default as DashboardSkeleton } from './feedback/DashboardSkeleton'"));
      assert.ok(content.includes("export { default as HabitsSkeleton } from './feedback/HabitsSkeleton'"));
      assert.ok(content.includes("export { default as AnalyticsSkeleton } from './feedback/AnalyticsSkeleton'"));
    });
  });

  describe('3. Route Transition, Page-Level Loading & Auth Protection Integration', () => {
    it('should verify dashboard loading.js renders DashboardSkeleton', () => {
      const content = readWebFile('src/app/(protected)/dashboard/loading.js');
      assert.ok(content.includes('<DashboardSkeleton />'), 'Dashboard loading must render DashboardSkeleton');
      assert.ok(!content.includes('LoadingSpinner'), 'Must not render LoadingSpinner');
    });

    it('should verify habits loading.js renders HabitsSkeleton', () => {
      const content = readWebFile('src/app/(protected)/habits/loading.js');
      assert.ok(content.includes('<HabitsSkeleton />'), 'Habits loading must render HabitsSkeleton');
      assert.ok(!content.includes('LoadingSpinner'), 'Must not render LoadingSpinner');
    });

    it('should verify analytics loading.js renders AnalyticsSkeleton', () => {
      const content = readWebFile('src/app/(protected)/analytics/loading.js');
      assert.ok(content.includes('<AnalyticsSkeleton />'), 'Analytics loading must render AnalyticsSkeleton');
      assert.ok(!content.includes('LoadingSpinner'), 'Must not render LoadingSpinner');
    });

    it('should verify DashboardPage uses DashboardSkeleton during data loading without duplicate TopNav', () => {
      const content = readWebFile('src/app/(protected)/dashboard/page.js');
      assert.ok(content.includes('<DashboardSkeleton />'), 'DashboardPage must render DashboardSkeleton when loading');
      assert.ok(!content.includes('<TopNav'), 'DashboardPage must not render TopNav (owned by ProtectedLayout)');
      assert.ok(!content.includes('LoadingSpinner'), 'DashboardPage must not contain LoadingSpinner');
    });

    it('should verify HabitsPage uses HabitsSkeleton during data loading without duplicate TopNav', () => {
      const content = readWebFile('src/app/(protected)/habits/page.js');
      assert.ok(content.includes('return <HabitsSkeleton />;'), 'HabitsPage must return HabitsSkeleton when loading');
      assert.ok(!content.includes('<TopNav'), 'HabitsPage must not render TopNav (owned by ProtectedLayout)');
      assert.ok(!content.includes('LoadingSpinner'), 'HabitsPage must not contain LoadingSpinner');
    });

    it('should verify AnalyticsPage uses AnalyticsSkeleton during data loading without duplicate TopNav', () => {
      const content = readWebFile('src/app/(protected)/analytics/page.js');
      assert.ok(content.includes('<AnalyticsSkeleton />'), 'AnalyticsPage must render AnalyticsSkeleton when loading');
      assert.ok(!content.includes('<TopNav'), 'AnalyticsPage must not render TopNav (owned by ProtectedLayout)');
      assert.ok(!content.includes('LoadingSpinner'), 'AnalyticsPage must not contain LoadingSpinner');
    });

    it('should verify ProtectedLayout owns shell with TopNav, BottomNav, and auth splash resolution', () => {
      const content = readWebFile('src/app/(protected)/layout.js');
      assert.ok(content.includes('usePathname'), 'ProtectedLayout must inspect pathname for contextual routing');
      assert.ok(content.includes('<TopNav'), 'ProtectedLayout shell must own TopNav');
      assert.ok(content.includes('<BottomNav'), 'ProtectedLayout shell must own BottomNav');
      assert.ok(content.includes('<LoadingSpinner'), 'Must render calm LoadingSpinner during initial auth resolution');
      assert.ok(content.includes("router.push('/login')"), 'Must preserve unauthenticated redirect to login');
    });

    it('should verify LoginPage renders calm LoadingSpinner during auth resolution', () => {
      const content = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(content.includes('<LoadingSpinner'), 'LoginPage must render LoadingSpinner during auth resolution');
      assert.ok(content.includes("router.push('/dashboard')"), 'LoginPage must redirect authenticated user to dashboard');
    });

    it('should verify root Home page renders brand LoadingSpinner during initial auth redirect', () => {
      const content = readWebFile('src/app/page.js');
      assert.ok(content.includes('<LoadingSpinner'), 'Home page must render LoadingSpinner gateway');
      assert.ok(!content.includes('<DashboardSkeleton'), 'Home page must not render protected DashboardSkeleton to unauthenticated users');
    });
  });
});
