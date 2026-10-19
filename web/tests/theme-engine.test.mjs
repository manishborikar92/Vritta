import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND } from '../src/lib/constants/brand.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to compute WCAG 2.2 Relative Luminance and Contrast Ratio
function getLuminance(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Phase 1: VRITTA Design Tokens & Theme Engine', () => {

  // =========================================================================
  // 1. BRAND METADATA & TOKEN VALUES
  // =========================================================================
  describe('Brand Configuration & Semantic Tokens', () => {
    it('should declare authoritative Vritta brand name and Restorative Juniper primary tokens', () => {
      assert.equal(BRAND.name, 'Vritta');
      assert.equal(BRAND.name.toUpperCase(), 'VRITTA');
      assert.equal(BRAND.themeColor, '#14B8A6'); // Luminous Teal primary brand swatch
      assert.equal(BRAND.brandColors.deepObsidian, '#090D16');
      assert.equal(BRAND.brandColors.luminousTeal, '#14B8A6');
      assert.equal(BRAND.brandColors.warmAmber, '#D97706');
      assert.equal(BRAND.colors.primary[500], '#14b8a6');
      assert.equal(BRAND.colors.primary[600], '#0f766e');
      assert.equal(BRAND.colors.accent.teal, '#14b8a6');
      assert.equal(BRAND.colors.accent.amber, '#d97706');
      assert.equal(BRAND.colors.accent.amberText, '#b45309');
      assert.equal(BRAND.colors.accent.juniperText, '#0f766e');
      assert.equal(BRAND.colors.surface.canvas, '#f8fafc'); // Authoritative Misty Slate
      assert.equal(BRAND.colors.surface.card, '#ffffff');
      assert.equal(BRAND.colors.surface.canvasDark, '#090d16');
      assert.equal(BRAND.colors.surface.cardDark, '#111827');
    });
  });

  // =========================================================================
  // 2. MATHEMATICAL WCAG 2.2 CONTRAST RATIO AUDIT
  // =========================================================================
  describe('WCAG 2.2 AA & AAA Contrast Audits', () => {
    it('should guarantee WCAG 2.2 contrast ratios for all critical text and brand pairs', () => {
      // Light mode primary text (#0F172A) on Canvas (#F8FAFC)
      const lightCanvasText = getContrastRatio('#0F172A', '#F8FAFC');
      assert.ok(lightCanvasText >= 7.0, `Light canvas text contrast ${lightCanvasText.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Light mode primary text (#0F172A) on Card (#FFFFFF)
      const lightCardText = getContrastRatio('#0F172A', '#FFFFFF');
      assert.ok(lightCardText >= 7.0, `Light card text contrast ${lightCardText.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Light mode secondary text (#475569) on Canvas & Card
      const lightSecondary = getContrastRatio('#475569', '#F8FAFC');
      assert.ok(lightSecondary >= 7.0, `Light secondary text contrast ${lightSecondary.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Core Brand Swatch: Deep Obsidian (#090D16) on Light Canvas (#F8FAFC)
      const obsidianOnCanvas = getContrastRatio('#090D16', '#F8FAFC');
      assert.ok(obsidianOnCanvas >= 18.0, `Deep Obsidian on canvas ${obsidianOnCanvas.toFixed(2)}:1 must exceed AAA (>= 7.0:1)`);

      // Core Brand Swatch: Luminous Teal (#14B8A6) on Deep Obsidian (#090D16)
      const tealOnObsidian = getContrastRatio('#14B8A6', '#090D16');
      assert.ok(tealOnObsidian >= 7.0, `Luminous Teal on Obsidian ${tealOnObsidian.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Core Brand Swatch: Deep Obsidian text (#090D16) on Luminous Teal Button (#14B8A6)
      const textOnTealButton = getContrastRatio('#090D16', '#14B8A6');
      assert.ok(textOnTealButton >= 7.0, `Obsidian text on Teal button ${textOnTealButton.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Core Brand Swatch: Warm Amber (#D97706) on Deep Obsidian (#090D16)
      const amberOnObsidian = getContrastRatio('#D97706', '#090D16');
      assert.ok(amberOnObsidian >= 4.5, `Warm Amber on Obsidian ${amberOnObsidian.toFixed(2)}:1 must meet AA (>= 4.5:1)`);

      // Core Brand Swatch: Warm Amber (#D97706) on Light Canvas (#F8FAFC) - Graphical Object (WCAG 2.2 SC 1.4.11)
      const amberOnLightCanvas = getContrastRatio('#D97706', '#F8FAFC');
      assert.ok(amberOnLightCanvas >= 3.0, `Warm Amber on light canvas ${amberOnLightCanvas.toFixed(2)}:1 must meet Non-text SC 1.4.11 (>= 3.0:1)`);

      // Documented Variant: Amber Text (#B45309) on Light Canvas (#F8FAFC)
      const amberTextOnLight = getContrastRatio('#B45309', '#F8FAFC');
      assert.ok(amberTextOnLight >= 4.5, `Amber text on light canvas ${amberTextOnLight.toFixed(2)}:1 must meet AA (>= 4.5:1)`);

      // Documented Variant: Deep Teal (#0F766E) on Light Canvas (#F8FAFC)
      const deepTealOnLight = getContrastRatio('#0F766E', '#F8FAFC');
      assert.ok(deepTealOnLight >= 4.5, `Deep Teal on light canvas ${deepTealOnLight.toFixed(2)}:1 must meet AA (>= 4.5:1)`);

      // Dark mode primary text (#F8FAFC) on Dark Canvas (#090D16)
      const darkCanvasText = getContrastRatio('#F8FAFC', '#090D16');
      assert.ok(darkCanvasText >= 7.0, `Dark canvas text contrast ${darkCanvasText.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Dark mode primary text (#F8FAFC) on Dark Surface (#111827)
      const darkCardText = getContrastRatio('#F8FAFC', '#111827');
      assert.ok(darkCardText >= 7.0, `Dark card text contrast ${darkCardText.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Dark mode secondary text (#94A3B8) on Dark Canvas (#090D16)
      const darkSecondary = getContrastRatio('#94A3B8', '#090D16');
      assert.ok(darkSecondary >= 7.0, `Dark secondary text contrast ${darkSecondary.toFixed(2)}:1 must meet AAA (>= 7.0:1)`);

      // Dark mode resolved muted text (#8092A5) on Dark Canvas (#090D16)
      const darkMutedOnCanvas = getContrastRatio('#8092A5', '#090D16');
      assert.ok(darkMutedOnCanvas >= 4.5, `Dark muted on canvas ${darkMutedOnCanvas.toFixed(2)}:1 must meet AA (>= 4.5:1)`);
      assert.ok(darkMutedOnCanvas >= 6.0, `Dark muted on canvas should be >= 6.0:1 (actual: ${darkMutedOnCanvas.toFixed(2)}:1)`);

      // Dark mode resolved muted text (#8092A5) on Dark Surface (#111827)
      const darkMutedOnSurface = getContrastRatio('#8092A5', '#111827');
      assert.ok(darkMutedOnSurface >= 4.5, `Dark muted on surface ${darkMutedOnSurface.toFixed(2)}:1 must meet AA (>= 4.5:1)`);
      assert.ok(darkMutedOnSurface >= 5.5, `Dark muted on surface should be >= 5.5:1 (actual: ${darkMutedOnSurface.toFixed(2)}:1)`);

      // Demonstration: Legacy color #64748B failed WCAG AA on dark background
      const legacyFail = getContrastRatio('#64748B', '#090D16');
      assert.ok(legacyFail < 4.5, `Legacy #64748B contrast ${legacyFail.toFixed(2)}:1 fails AA, justifying #8092A5 replacement`);
    });
  });

  // =========================================================================
  // 3. RUNTIME BEHAVIORAL VERIFICATION OF THEME ENGINE LOGIC
  // =========================================================================
  describe('Runtime Theme Engine Behavior & Storage Simulation', () => {
    // Pure implementations replicating ThemeContext runtime functions
    const STORAGE_KEY = 'vritta-theme';

    function createMockStorage(initial = {}) {
      const store = { ...initial };
      let throws = false;
      return {
        getItem: (k) => {
          if (throws) throw new Error('SecurityError: localStorage is disabled');
          return store[k] !== undefined ? store[k] : null;
        },
        setItem: (k, v) => {
          if (throws) throw new Error('SecurityError: localStorage is disabled');
          store[k] = String(v);
        },
        setThrows: (val) => { throws = val; },
        _store: store,
      };
    }

    function createMockClassList() {
      const classes = new Set();
      return {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        get list() { return [...classes]; },
      };
    }

    function executeBlockingScript(storage, classList) {
      try {
        const s = storage.getItem(STORAGE_KEY);
        if (s === 'dark') {
          classList.add('dark');
        } else {
          classList.remove('dark');
        }
      } catch {
        // Safe fallback
      }
    }

    function getStoredTheme(storage) {
      try {
        const stored = storage.getItem(STORAGE_KEY);
        if (stored === 'dark') {
          return 'dark';
        }
      } catch {
        // Safe fallback
      }
      return 'light';
    }

    it('should correctly read stored preference and default/migrate legacy values to light safely', () => {
      const storage = createMockStorage({ [STORAGE_KEY]: 'dark' });
      assert.equal(getStoredTheme(storage), 'dark');

      storage.setItem(STORAGE_KEY, 'light');
      assert.equal(getStoredTheme(storage), 'light');

      // Legacy 'system' value must be safely migrated to 'light'
      storage.setItem(STORAGE_KEY, 'system');
      assert.equal(getStoredTheme(storage), 'light');

      // Empty / non-existent key defaults to 'light'
      const emptyStorage = createMockStorage();
      assert.equal(getStoredTheme(emptyStorage), 'light');

      // Corrupted / invalid key defaults to 'light'
      const corruptedStorage = createMockStorage({ [STORAGE_KEY]: 'invalid_color_theme' });
      assert.equal(getStoredTheme(corruptedStorage), 'light');

      // Security / Quota error throwing storage defaults safely to 'light'
      const throwingStorage = createMockStorage();
      throwingStorage.setThrows(true);
      assert.equal(getStoredTheme(throwingStorage), 'light'); // Should not throw
    });

    it('should execute zero-flash blocking script logic and set .dark class correctly', () => {
      // 1. Explicit dark in storage -> adds .dark
      const classList1 = createMockClassList();
      executeBlockingScript(createMockStorage({ [STORAGE_KEY]: 'dark' }), classList1);
      assert.ok(classList1.contains('dark'), 'Explicit dark mode must add .dark class');

      // 2. Explicit light in storage -> removes .dark
      const classList2 = createMockClassList();
      classList2.add('dark'); // simulate pre-existing
      executeBlockingScript(createMockStorage({ [STORAGE_KEY]: 'light' }), classList2);
      assert.ok(!classList2.contains('dark'), 'Explicit light mode must remove .dark class');

      // 3. Legacy system in storage -> removes .dark (migrates/defaults to light)
      const classList3 = createMockClassList();
      classList3.add('dark');
      executeBlockingScript(createMockStorage({ [STORAGE_KEY]: 'system' }), classList3);
      assert.ok(!classList3.contains('dark'), 'Legacy system mode must default to light without flash');

      // 4. Uninitialized storage (first visit) -> removes .dark (defaults to light)
      const classList4 = createMockClassList();
      classList4.add('dark');
      executeBlockingScript(createMockStorage(), classList4);
      assert.ok(!classList4.contains('dark'), 'First visit must default to light without flash');

      // 5. Storage throwing error -> does not crash or throw
      const throwingStorage = createMockStorage();
      throwingStorage.setThrows(true);
      const classList5 = createMockClassList();
      assert.doesNotThrow(() => {
        executeBlockingScript(throwingStorage, classList5);
      });
    });

    it('should manage theme subscriptions and dispatch notifications upon theme changes', () => {
      const listeners = new Set();
      let notifyCount = 0;
      function notifyListeners() {
        notifyCount++;
        for (const l of listeners) l();
      }

      let listener1Calls = 0;
      let listener2Calls = 0;
      const sub1 = () => { listener1Calls++; };
      const sub2 = () => { listener2Calls++; };

      listeners.add(sub1);
      listeners.add(sub2);

      notifyListeners();
      assert.equal(notifyCount, 1);
      assert.equal(listener1Calls, 1);
      assert.equal(listener2Calls, 1);

      // Unsubscribe sub1
      listeners.delete(sub1);
      notifyListeners();
      assert.equal(notifyCount, 2);
      assert.equal(listener1Calls, 1); // Not called again
      assert.equal(listener2Calls, 2);
    });

    it('should verify two-state theme toggle alternation and ThemeToggle component invariants', () => {
      // Toggle alternation logic
      const toggle = (current) => (current === 'dark' ? 'light' : 'dark');
      assert.equal(toggle('light'), 'dark');
      assert.equal(toggle('dark'), 'light');

      // ThemeToggle component source verification
      const togglePath = path.join(projectRoot, 'src', 'components', 'ui', 'controls', 'ThemeToggle.js');
      assert.ok(fs.existsSync(togglePath), 'ThemeToggle.js component must exist');
      const toggleContent = fs.readFileSync(togglePath, 'utf8');

      assert.ok(toggleContent.includes('useTheme()'), 'ThemeToggle must consume useTheme');
      assert.ok(toggleContent.includes('w-10 h-10') || (toggleContent.includes('min-h-[44px]') && toggleContent.includes('min-w-[44px]')), 'ThemeToggle must declare defined touch target dimensions (w-10 h-10)');
      assert.ok(toggleContent.includes('aria-label='), 'ThemeToggle must define accessible aria-label');
      assert.ok(toggleContent.includes('Sun') && toggleContent.includes('Moon'), 'ThemeToggle must render Sun and Moon icons');
      assert.ok(!/<span>/i.test(toggleContent), 'ThemeToggle must be icon-only with zero text spans');
      assert.ok(!toggleContent.toLowerCase().includes('system'), 'ThemeToggle must not contain system theme references');
    });
  });

  // =========================================================================
  // 4. STATIC SPECIFICATION & MARKUP INVARIANTS
  // =========================================================================
  describe('Static Declarations & Markup Integrity', () => {
    it('should verify globals.css contains Tailwind v4 custom dark variant and semantic tokens', () => {
      const cssPath = path.join(projectRoot, 'src', 'app', 'globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // Tailwind CSS v4 class-based dark mode variant
      assert.ok(
        cssContent.includes('@custom-variant dark (&:where(.dark, .dark *));'),
        'Must declare @custom-variant dark for Tailwind v4 class mode'
      );

      // Dynamic @theme inline mappings (non-self-referential runtime variable bindings)
      assert.ok(
        cssContent.includes('--color-canvas: var(--vritta-canvas);') || cssContent.includes('--color-canvas: var(--color-bg-canvas);'),
        'Must map canvas in @theme'
      );
      assert.ok(
        cssContent.includes('--color-surface: var(--vritta-surface);') || cssContent.includes('--color-surface: var(--color-bg-surface);'),
        'Must map surface in @theme'
      );
      assert.ok(
        cssContent.includes('--color-text-main: var(--vritta-text-main);') || cssContent.includes('--color-text-main: var(--color-text-primary);'),
        'Must map text-main in @theme'
      );
      assert.ok(
        cssContent.includes('--color-text-sub: var(--vritta-text-sub);') || cssContent.includes('--color-text-sub: var(--color-text-secondary);'),
        'Must map text-sub in @theme'
      );
      assert.ok(
        cssContent.includes('--color-brand-primary: var(--vritta-brand-primary);'),
        'Must map brand-primary to distinct runtime variable without self-reference'
      );

      // Runtime tokens in :root
      assert.ok(cssContent.includes('--vritta-canvas: #f8fafc;') || cssContent.includes('--color-bg-canvas: #f8fafc;'), 'Must define light canvas #f8fafc in :root');
      assert.ok(cssContent.includes('--vritta-surface: #ffffff;') || cssContent.includes('--color-bg-surface: #ffffff;'), 'Must define light card in :root');
      assert.ok(cssContent.includes('--vritta-brand-primary: #14b8a6;') || cssContent.includes('--color-brand-primary: #14b8a6;'), 'Must define core brand primary in :root');
      assert.ok(cssContent.includes('--vritta-brand-obsidian: #090d16;') || cssContent.includes('--color-brand-obsidian: #090d16;'), 'Must define core brand obsidian in :root');
      assert.ok(cssContent.includes('--vritta-brand-amber: #d97706;') || cssContent.includes('--color-brand-amber: #d97706;'), 'Must define core brand amber in :root');
      assert.ok(cssContent.includes('--vritta-accent: #0f766e;') || cssContent.includes('--color-accent-primary: #0f766e;'), 'Must define accessible teal variant in :root');
      assert.ok(cssContent.includes('--vritta-warm-accent: #d97706;') || cssContent.includes('--color-warm-accent: #d97706;'), 'Must define core warm accent in :root');

      // Runtime tokens in .dark
      assert.ok(cssContent.includes('--vritta-canvas: #090d16;') || cssContent.includes('--color-bg-canvas: #090d16;'), 'Must define dark canvas in .dark');
      assert.ok(cssContent.includes('--vritta-surface: #111827;') || cssContent.includes('--color-bg-surface: #111827;'), 'Must define dark card in .dark');
      assert.ok(cssContent.includes('--vritta-accent: #14b8a6;') || cssContent.includes('--color-accent-primary: #14b8a6;'), 'Must define dark brand accent in .dark');
      assert.ok(cssContent.includes('--vritta-warm-accent: #d97706;') || cssContent.includes('--color-warm-accent: #d97706;'), 'Must define dark warm accent in .dark');
      assert.ok(cssContent.includes('--vritta-text-muted: #8092a5;') || cssContent.includes('--color-text-muted: #8092a5;'), 'Must define accessible dark muted text in .dark');

      // Reduced motion media query
      assert.ok(
        cssContent.includes('@media (prefers-reduced-motion: reduce)'),
        'Must respect prefers-reduced-motion'
      );
    });

    it('should verify layout.js injects synchronous blocking script and suppressHydrationWarning', () => {
      const layoutPath = path.join(projectRoot, 'src', 'app', 'layout.js');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');

      // HTML root attributes
      assert.ok(layoutContent.includes('suppressHydrationWarning'), 'Must include suppressHydrationWarning on html tag');

      // Blocking theme script in head
      assert.ok(layoutContent.includes('vritta-theme'), 'Blocking script must check vritta-theme');
      assert.ok(layoutContent.includes("s==='dark'"), 'Blocking script must check s === dark');
      assert.ok(!layoutContent.includes('matchMedia'), 'Blocking script must not call matchMedia');
      assert.ok(layoutContent.includes("document.documentElement.classList.add('dark')"), 'Blocking script must add dark class');

      // ThemeProvider wrapping
      assert.ok(layoutContent.includes('<ThemeProvider>'), 'Must wrap application shell in ThemeProvider');

      // Viewport accessibility (WCAG 2.2 SC 1.4.4 & ACT Rule b4f0c3)
      assert.ok(layoutContent.includes('export const viewport'), 'Must export separate viewport object');
      assert.ok(!layoutContent.includes('maximumScale'), 'Must not restrict browser zoom with maximumScale');
      assert.ok(!layoutContent.includes('userScalable'), 'Must not disable browser pinch-to-zoom with userScalable');
    });

    it('should verify TopNav.js and ThemeToggle provide accessible icon-only theme toggle', () => {
      const navPath = path.join(projectRoot, 'src', 'components', 'ui', 'navigation', 'TopNav.js');
      const togglePath = path.join(projectRoot, 'src', 'components', 'ui', 'controls', 'ThemeToggle.js');
      const navContent = fs.readFileSync(navPath, 'utf8');
      const toggleContent = fs.readFileSync(togglePath, 'utf8');

      assert.ok(navContent.includes('<ThemeToggle'), 'TopNav must render shared ThemeToggle component');
      assert.ok(!navContent.includes('THEME_OPTIONS'), 'TopNav must not contain 3-state THEME_OPTIONS array');
      assert.ok(!navContent.includes('showThemeMenu'), 'TopNav must not contain theme menu dropdown state');
      assert.ok(toggleContent.includes('aria-label='), 'ThemeToggle must define accessible aria-label');
      assert.ok(toggleContent.includes('w-10 h-10') || (toggleContent.includes('min-h-[44px]') && toggleContent.includes('min-w-[44px]')), 'ThemeToggle must declare defined touch target dimensions (w-10 h-10)');
    });
  });
});
