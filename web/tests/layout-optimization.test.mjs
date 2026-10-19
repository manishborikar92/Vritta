import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND } from '../src/lib/constants/brand.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
}

describe('Next.js 16 Layout Optimization Invariants', () => {

  describe('1. Root Layout Metadata & URL Resolution', () => {
    it('should verify layout.js defines metadataBase pointing to verified production origin or env', () => {
      const content = readWebFile('src/app/layout.js');
      assert.ok(content.includes('metadataBase: new URL('), 'Must configure metadataBase with URL constructor');
      assert.ok(content.includes('myvritta.vercel.app'), 'Must use verified production domain from deployment docs');
      assert.ok(!content.includes('vritta.app'), 'Must NOT contain invented domain vritta.app');
    });

    it('should verify title template and default produce consistent brand titles', () => {
      const content = readWebFile('src/app/layout.js');
      assert.ok(content.includes('title: {'), 'Title must be configured as an object');
      assert.ok(content.includes('default: `${BRAND.name} — ${BRAND.tagline}`'), 'Must declare default brand title');
      assert.ok(content.includes('template: `%s | ${BRAND.name}`'), 'Must declare title template with brand suffix');
    });

    it('should verify metadata includes Open Graph, Twitter cards, and verified authorship', () => {
      const content = readWebFile('src/app/layout.js');
      assert.ok(content.includes('openGraph: {'), 'Must configure openGraph metadata');
      assert.ok(content.includes("type: 'website'"), 'OpenGraph type must be website');
      assert.ok(content.includes('twitter: {'), 'Must configure twitter metadata');
      assert.ok(content.includes("card: 'summary'"), 'Twitter card must be summary');
      assert.ok(content.includes('authors: [{ name: BRAND.author }]'), 'Must reference verified BRAND author');
      assert.ok(content.includes('creator: BRAND.author'), 'Must reference verified BRAND creator');
    });

    it('should preserve required file-based metadata JSDoc comment for asset pipeline tests', () => {
      const content = readWebFile('src/app/layout.js');
      assert.ok(content.includes('apple-icon.png'), 'Must document apple-icon.png');
      assert.ok(content.includes('favicon.ico'), 'Must document favicon.ico');
      assert.ok(content.includes('icon0.svg'), 'Must document icon0.svg');
      assert.ok(content.includes('manifest.json'), 'Must document manifest.json');
    });
  });

  describe('2. Font Configuration & Next.js 16 Best Practices', () => {
    it('should verify Inter font declares display: swap and subsets: latin', () => {
      const content = readWebFile('src/app/layout.js');
      assert.ok(content.includes('display: "swap"'), 'Inter font must configure display: "swap"');
      assert.ok(content.includes('subsets: ["latin"]'), 'Inter font must configure subsets: ["latin"]');
      assert.ok(content.includes('variable: "--font-inter"'), 'Inter font must configure variable: "--font-inter"');
    });
  });

  describe('3. Viewport & Theme Engine Coherence', () => {
    it('should verify viewport preserves authoritative brand themeColor and sets colorScheme', () => {
      const content = readWebFile('src/app/layout.js');
      assert.ok(content.includes('export const viewport'), 'Must export separate viewport object');
      assert.ok(content.includes('themeColor: BRAND.themeColor'), 'Must preserve authoritative brand themeColor');
      assert.ok(content.includes('colorScheme: "light dark"'), 'Must declare colorScheme: "light dark"');
      assert.ok(!content.includes('maximumScale'), 'Must not restrict browser zoom');
      assert.ok(!content.includes('userScalable'), 'Must not restrict pinch-to-zoom');
    });

    it('should preserve synchronous pre-paint theme script in <head>', () => {
      const content = readWebFile('src/app/layout.js');
      assert.ok(content.includes('suppressHydrationWarning'), 'Must have suppressHydrationWarning on html tag');
      assert.ok(content.includes('vritta-theme'), 'Must read vritta-theme from localStorage');
      assert.ok(content.includes("s==='dark'"), 'Must check s === dark');
      assert.ok(!content.includes('matchMedia'), 'Must NOT call matchMedia in blocking script');
      assert.ok(content.includes("document.documentElement.classList.add('dark')"), 'Must add .dark class');
    });

    it('should preserve provider tree ordering', () => {
      const content = readWebFile('src/app/layout.js');
      const themeIdx = content.indexOf('<ThemeProvider>');
      const authIdx = content.indexOf('<AuthProvider>');
      const dataIdx = content.indexOf('<DataProvider>');
      const soundIdx = content.indexOf('<SoundProvider>');
      const timerIdx = content.indexOf('<TimerProvider>');
      const toastIdx = content.indexOf('<ToastProvider>');

      assert.ok(themeIdx !== -1 && authIdx !== -1 && dataIdx !== -1 && soundIdx !== -1 && timerIdx !== -1 && toastIdx !== -1);
      assert.ok(themeIdx < authIdx, 'Theme before Auth');
      assert.ok(authIdx < dataIdx, 'Auth before Data');
      assert.ok(dataIdx < soundIdx, 'Data before Sound');
      assert.ok(soundIdx < timerIdx, 'Sound before Timer');
      assert.ok(timerIdx < toastIdx, 'Timer before Toast');
    });
  });

  describe('4. Skip-Link Absence Verification', () => {
    it('should verify layout.js and route layouts do not contain skip-to-content anchor or main-content IDs', () => {
      const layoutContent = readWebFile('src/app/layout.js');
      assert.ok(!layoutContent.includes('Skip to main content'), 'layout.js must not contain skip link text');
      assert.ok(!layoutContent.includes('href="#main-content"'), 'layout.js must not contain #main-content anchor');

      const protectedContent = readWebFile('src/app/(protected)/layout.js');
      assert.ok(!protectedContent.includes('id="main-content"'), '(protected)/layout.js must not contain id="main-content"');

      const authContent = readWebFile('src/app/(auth)/layout.js');
      assert.ok(!authContent.includes('id="main-content"'), '(auth)/layout.js must not contain id="main-content"');

      const homeContent = readWebFile('src/app/page.js');
      assert.ok(!homeContent.includes('id="main-content"'), 'page.js must not contain id="main-content"');

      const notFoundContent = readWebFile('src/app/not-found.js');
      assert.ok(!notFoundContent.includes('id="main-content"'), 'not-found.js must not contain id="main-content"');

      const errorContent = readWebFile('src/app/error.js');
      assert.ok(!errorContent.includes('id="main-content"'), 'error.js must not contain id="main-content"');
    });
  });
});
