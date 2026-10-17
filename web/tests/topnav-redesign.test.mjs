import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath) {
  const fullPath = path.join(webRoot, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Phase 5: TopNav Responsive Sizing and Layout Refinement', () => {
  const topNavPath = 'src/components/ui/TopNav.js';

  describe('1. Component Architecture & Invariants', () => {
    it('should verify TopNav.js exists and exports default function', () => {
      const content = readWebFile(topNavPath);
      assert.ok(content.length > 0, 'TopNav.js must exist and not be empty');
      assert.ok(
        content.includes('export default function TopNav'),
        'TopNav must export default function'
      );
    });
  });

  describe('2. Logo Aspect-Ratio Protection & Sizing', () => {
    it('should verify Logo container specifies flex-shrink-0 to prevent horizontal distortion', () => {
      const content = readWebFile(topNavPath);
      assert.ok(
        content.includes('flex-shrink-0'),
        'Logo container must declare flex-shrink-0'
      );
      assert.ok(
        content.includes('w-9 h-9 sm:w-10 sm:h-10'),
        'Logo container must specify responsive w-9 h-9 sm:w-10 sm:h-10 sizing'
      );
    });
  });

  describe('3. Responsive Typography & Collision Prevention', () => {
    it('should verify title implements responsive text-base sm:text-lg lg:text-xl scaling', () => {
      const content = readWebFile(topNavPath);
      assert.ok(
        content.includes('text-base sm:text-lg lg:text-xl font-bold text-main'),
        'Title must declare responsive text-base sm:text-lg lg:text-xl typography'
      );
      assert.ok(
        content.includes('truncate'),
        'Title must truncate on narrow screens to prevent controls collision'
      );
    });

    it('should verify subtitle implements text-2xs sm:text-xs with truncation protection', () => {
      const content = readWebFile(topNavPath);
      assert.ok(
        content.includes('text-2xs sm:text-xs text-sub'),
        'Subtitle must declare text-2xs sm:text-xs'
      );
      assert.ok(
        content.includes('truncate'),
        'Subtitle must include truncate to prevent 2-line overflow'
      );
    });
  });

  describe('4. Header Controls Alignment & WCAG Touch Targets', () => {
    it('should verify ThemeToggle and Profile button provide accessible interactive controls', () => {
      const content = readWebFile(topNavPath);
      assert.ok(
        content.includes('<ThemeToggle />'),
        'TopNav must render ThemeToggle'
      );
      assert.ok(
        content.includes('aria-label="Profile menu"'),
        'Profile menu trigger must define accessible aria-label'
      );
      assert.ok(
        content.includes('p-1 sm:p-1.5') || content.includes('min-w-[44px]'),
        'Profile menu trigger must define comfortable padding for touch interaction'
      );
    });

    it('should hide ChevronDown on mobile viewports to preserve title horizontal breathing room', () => {
      const content = readWebFile(topNavPath);
      assert.ok(
        content.includes('hidden sm:block'),
        'ChevronDown next to avatar must be hidden on mobile (hidden sm:block)'
      );
    });
  });

  describe('5. Profile Dropdown & Sign Out Confirmation Invariants', () => {
    it('should preserve profile menu toggle and Sign Out modal flow', () => {
      const content = readWebFile(topNavPath);
      assert.ok(content.includes('setShowProfileMenu'), 'Must preserve profile menu state');
      assert.ok(content.includes('setShowLogoutModal'), 'Must preserve logout modal trigger');
      assert.ok(content.includes('ConfirmDialog'), 'Must render ConfirmDialog for sign out');
    });
  });

  describe('6. Design System & Prohibited Color Audit', () => {
    it('should verify zero occurrences of prohibited colors in TopNav', () => {
      const content = readWebFile(topNavPath);
      assert.ok(!/purple/i.test(content), 'Prohibited color "purple" found in TopNav.js');
      assert.ok(!/indigo/i.test(content), 'Prohibited color "indigo" found in TopNav.js');
    });
  });
});
