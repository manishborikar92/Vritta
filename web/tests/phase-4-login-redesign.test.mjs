import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath) {
  const filePath = path.join(webRoot, relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

describe('Phase 4: Login & Authentication Page Redesign', () => {

  describe('1. Brand System & Prohibited Color Elimination', () => {
    it('should verify zero occurrences of "purple" in auth layout and login page', () => {
      const layoutContent = readWebFile('src/app/(auth)/layout.js');
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(!/purple/i.test(layoutContent), 'Auth layout must not contain purple');
      assert.ok(!/purple/i.test(loginContent), 'Login page must not contain purple');
    });

    it('should verify zero occurrences of "indigo" in auth layout and login page', () => {
      const layoutContent = readWebFile('src/app/(auth)/layout.js');
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(!/indigo/i.test(layoutContent), 'Auth layout must not contain indigo');
      assert.ok(!/indigo/i.test(loginContent), 'Login page must not contain indigo');
    });

    it('should verify elimination of decorative animated blur glow', () => {
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(!loginContent.includes('blur-2xl'), 'Login page must not contain blur-2xl glow');
      assert.ok(!loginContent.includes('animate-pulse'), 'Login page must not contain decorative pulse glow');
    });

    it('should verify integration of authoritative Guiding Sutra Logo component', () => {
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(loginContent.includes('<Logo'), 'Login page must render Logo component');
      assert.ok(loginContent.includes("from '@/components/ui'"), 'Login page must import Logo from UI library');
    });
  });

  describe('2. Authentication Flow & Security Boundaries', () => {
    it('should preserve Google Sign-In handler and auth state redirection', () => {
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(loginContent.includes('useAuth()'), 'Login page must consume useAuth context');
      assert.ok(loginContent.includes('signInWithGoogle'), 'Login page must invoke signInWithGoogle');
      assert.ok(loginContent.includes('<LoadingSpinner'), 'Login page must display LoadingSpinner during auth resolution');
    });

    it('should include accessible error feedback alert', () => {
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(loginContent.includes('role="alert"'), 'Login page must include accessible error alert with role="alert"');
    });
  });

  describe('3. Ergonomics & Accessibility (WCAG 2.2 Standards)', () => {
    it('should verify Google Sign-In button meets min 48px touch target', () => {
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(loginContent.includes('min-h-[48px]'), 'Google Sign-In button must meet min-h-[48px]');
    });

    it('should verify interactive theme switcher is integrated with full accessibility labels', () => {
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      const toggleContent = readWebFile('src/components/ui/controls/ThemeToggle.js');
      assert.ok(loginContent.includes('<ThemeToggle'), 'Login page must render shared ThemeToggle component');
      assert.ok(toggleContent.includes('useTheme()'), 'ThemeToggle must consume useTheme');
      assert.ok(toggleContent.includes('aria-label='), 'Theme toggle button must define aria-label');
      assert.ok(toggleContent.includes('w-10 h-10') || toggleContent.includes('min-h-[44px]'), 'Theme toggle button must define defined touch target dimensions (w-10 h-10)');
    });

    it('should verify root layout viewport allows unrestricted browser zoom', () => {
      const layoutContent = readWebFile('src/app/layout.js');
      assert.ok(layoutContent.includes('export const viewport'), 'layout.js must export viewport');
      assert.ok(!layoutContent.includes('maximumScale'), 'viewport must not contain maximumScale');
      assert.ok(!layoutContent.includes('userScalable'), 'viewport must not contain userScalable');
    });
  });

  describe('4. Semantic Token Integration & The Four Pillars', () => {
    it('should verify all 4 routine architecture pillars are present with semantic badges', () => {
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(loginContent.includes('Routine Architecture'), 'Pillar 1 must be Routine Architecture');
      assert.ok(loginContent.includes('Adaptive Movement & Health'), 'Pillar 2 must be Adaptive Movement');
      assert.ok(loginContent.includes('Contemplative Focus'), 'Pillar 3 must be Contemplative Focus');
      assert.ok(loginContent.includes('Private Journal & Notes'), 'Pillar 4 must be Private Journal');
    });

    it('should verify semantic canvas and surface tokens on auth layout and login containers', () => {
      const authLayout = readWebFile('src/app/(auth)/layout.js');
      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(authLayout.includes('bg-canvas') && authLayout.includes('text-main'), 'Auth layout must use bg-canvas text-main');
      assert.ok(loginContent.includes('bg-canvas') && loginContent.includes('bg-surface'), 'Login page must use semantic bg-canvas and bg-surface');
      assert.ok(loginContent.includes('border-subtle'), 'Login page must use semantic border-subtle');
    });
  });
});
