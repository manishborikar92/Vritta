import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import robots from '../src/app/robots.js';
import sitemap from '../src/app/sitemap.js';
import { NAV_ITEMS, isRouteActive } from '../src/lib/constants/navigation.js';
import { TodayNavIcon, HabitsNavIcon, InsightsNavIcon } from '../src/components/ui/navigation/NavIcons.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Modern Navigation, Routes & SEO Invariants', () => {

  describe('1. Navigation Structure & Calibrated NavIcons', () => {
    it('should configure NAV_ITEMS with modern routes and reference-calibrated icons', () => {
      assert.equal(NAV_ITEMS.length, 3, 'Must have exactly 3 navigation tabs');

      const [todayItem, habitsItem, insightsItem] = NAV_ITEMS;

      // Today tab
      assert.equal(todayItem.href, '/today');
      assert.equal(todayItem.label, 'Today');
      assert.equal(todayItem.Icon, TodayNavIcon, 'Today tab must use calibrated TodayNavIcon');

      // Habits tab
      assert.equal(habitsItem.href, '/habits');
      assert.equal(habitsItem.label, 'Habits');
      assert.equal(habitsItem.Icon, HabitsNavIcon, 'Habits tab must use calibrated HabitsNavIcon');

      // Insights tab
      assert.equal(insightsItem.href, '/insights');
      assert.equal(insightsItem.label, 'Insights');
      assert.equal(insightsItem.Icon, InsightsNavIcon, 'Insights tab must use calibrated InsightsNavIcon');
    });

    it('should verify NavIcons SVG structure matches design reference image exactly', () => {
      const content = readWebFile('src/components/ui/navigation/NavIcons.js');

      // Today icon: checklist with checkmark and open circle
      assert.ok(content.includes('M2.5 6.5 L4.75 9 L9 3.5'), 'Today icon must declare precise checkmark path');
      assert.ok(content.includes("cx: '4.75', cy: '17.5', r: '2.25'"), 'Today icon must declare open circle marker');

      // Habits icon: 3-line list with centered plus
      assert.ok(content.includes('M16 5.5H3'), 'Habits icon must declare top line');
      assert.ok(content.includes('M11 12H3'), 'Habits icon must declare middle line');
      assert.ok(content.includes('M18 8.5v7'), 'Habits icon must declare plus vertical bar');
      assert.ok(content.includes('M21.5 12h-7'), 'Habits icon must declare plus horizontal bar');

      // Insights icon: 3 solid rounded pill bars (column chart)
      assert.ok(content.includes("x: '2', y: '8.5', width: '5', height: '11.5', rx: '2.5'"), 'Insights icon left bar pill');
      assert.ok(content.includes("x: '9.5', y: '2.5', width: '5', height: '17.5', rx: '2.5'"), 'Insights icon middle bar pill');
      assert.ok(content.includes("x: '17', y: '6.5', width: '5', height: '13.5', rx: '2.5'"), 'Insights icon right bar pill');
      assert.ok(content.includes("fill: 'currentColor'"), 'Insights icon must fill with currentColor');
    });


    it('should correctly determine active routes for root and nested paths', () => {
      assert.equal(isRouteActive('/today', '/today'), true);
      assert.equal(isRouteActive('/today/subpath', '/today'), true);
      assert.equal(isRouteActive('/habits', '/today'), false);
      assert.equal(isRouteActive('/habits', '/habits'), true);
      assert.equal(isRouteActive('/insights', '/insights'), true);
    });
  });

  describe('2. Bottom Navigation Textless UI & Screen-Reader Accessibility', () => {
    it('should verify BottomNav eliminates visible text labels and provides sr-only and aria-label', () => {
      const content = readWebFile('src/components/ui/navigation/BottomNav.js');

      // Zero visible label element
      assert.ok(!content.includes('<span className={cn(\'mt-0.5'), 'Must eliminate visible text label span');
      assert.ok(!content.includes('truncate text-2xs font-semibold'), 'Must eliminate visible text label typography');

      // Accessible labels for screen readers
      assert.ok(content.includes('aria-label={label}'), 'Link must define aria-label for screen readers');
      assert.ok(content.includes('<span className="sr-only">{label}</span>'), 'Link must contain sr-only accessible text element');

      // Minimum sizing and active indicators
      assert.ok(content.includes('min-h-14 min-w-[56px]'), 'Must maintain WCAG touch targets (min 56px)');
      assert.ok(content.includes('active ? \'stroke-[2.3] text-accent\' : \'stroke-[1.8] text-muted'), 'Must have clear active/inactive icon states');
    });
  });

  describe('3. Modern Route Hierarchy & Elimination of Obsolete Paths', () => {
    it('should verify /today and /insights directories exist and obsolete /dashboard and /analytics are deleted', () => {
      assert.ok(fs.existsSync(path.join(webRoot, 'src/app/(protected)/today/page.js')), 'today/page.js must exist');
      assert.ok(fs.existsSync(path.join(webRoot, 'src/app/(protected)/today/loading.js')), 'today/loading.js must exist');
      assert.ok(fs.existsSync(path.join(webRoot, 'src/app/(protected)/insights/page.js')), 'insights/page.js must exist');
      assert.ok(fs.existsSync(path.join(webRoot, 'src/app/(protected)/insights/loading.js')), 'insights/loading.js must exist');

      assert.ok(!fs.existsSync(path.join(webRoot, 'src/app/(protected)/dashboard')), 'dashboard directory must be deleted');
      assert.ok(!fs.existsSync(path.join(webRoot, 'src/app/(protected)/analytics')), 'analytics directory must be deleted');
    });

    it('should verify Home and Login redirect to /today when authenticated', () => {
      const homeContent = readWebFile('src/app/page.js');
      assert.ok(homeContent.includes("user ? '/today' : '/login'"), 'Home must redirect authenticated sessions to /today');
      assert.ok(!homeContent.includes('/dashboard'), 'Home must not reference /dashboard');

      const loginContent = readWebFile('src/app/(auth)/login/page.js');
      assert.ok(loginContent.includes("router.push('/today')"), 'Login must redirect authenticated sessions to /today');
      assert.ok(!loginContent.includes('/dashboard'), 'Login must not reference /dashboard');
    });
  });

  describe('4. robots.txt Configuration & Crawler Controls', () => {
    it('should export valid robots configuration adhering to Next.js conventions', () => {
      const config = robots();
      assert.ok(config, 'robots() must return a configuration object');
      assert.ok(config.rules, 'robots() must define rules');
      assert.equal(config.rules.userAgent, '*');
      assert.equal(config.rules.allow, '/');

      // Disallowed routes: protected private user pages
      assert.ok(Array.isArray(config.rules.disallow), 'Disallow must be an array of paths');
      assert.ok(config.rules.disallow.includes('/today'), 'Must disallow crawler access to /today');
      assert.ok(config.rules.disallow.includes('/habits'), 'Must disallow crawler access to /habits');
      assert.ok(config.rules.disallow.includes('/insights'), 'Must disallow crawler access to /insights');

      // Sitemap reference
      assert.equal(config.sitemap, 'https://myvritta.vercel.app/sitemap.xml');
    });
  });

  describe('5. sitemap.xml Generation & Public Page Entries', () => {
    it('should export sitemap entries for public pages only', () => {
      const entries = sitemap();
      assert.ok(Array.isArray(entries), 'sitemap() must return an array of entries');

      const urls = entries.map(e => e.url);
      assert.ok(urls.includes('https://myvritta.vercel.app'), 'Must include root homepage in sitemap');
      assert.ok(urls.includes('https://myvritta.vercel.app/login'), 'Must include login page in sitemap');

      // Must NOT include private protected routes
      assert.ok(!urls.some(u => u.includes('/today')), 'Sitemap must NOT expose private /today');
      assert.ok(!urls.some(u => u.includes('/habits')), 'Sitemap must NOT expose private /habits');
      assert.ok(!urls.some(u => u.includes('/insights')), 'Sitemap must NOT expose private /insights');

      for (const entry of entries) {
        assert.ok(entry.lastModified instanceof Date, 'Every entry must declare valid lastModified Date');
        assert.ok(typeof entry.changeFrequency === 'string', 'Every entry must declare changeFrequency');
        assert.ok(typeof entry.priority === 'number', 'Every entry must declare priority number');
      }
    });
  });

  describe('6. Canonical URLs and Metadata Verification', () => {
    it('should verify root layout declares canonical URL and metadataBase', () => {
      const rootContent = readWebFile('src/app/layout.js');
      assert.ok(rootContent.includes('metadataBase: new URL('), 'Must declare metadataBase');
      assert.ok(rootContent.includes('myvritta.vercel.app'), 'Must target production domain');
      assert.ok(rootContent.includes('canonical: \'/\''), 'Root layout must declare canonical URL /');
      assert.ok(rootContent.includes('openGraph: {'), 'Must configure openGraph metadata');
      assert.ok(rootContent.includes('twitter: {'), 'Must configure twitter metadata');
    });

    it('should verify auth layout declares canonical URL and social metadata', () => {
      const authContent = readWebFile('src/app/(auth)/layout.js');
      assert.ok(authContent.includes('title: \'Sign In\''), 'Auth layout must declare Sign In title');
      assert.ok(authContent.includes('canonical: \'/login\''), 'Auth layout must declare canonical URL /login');
      assert.ok(authContent.includes('url: \'/login\''), 'Auth layout must declare OG url /login');
      assert.ok(authContent.includes('openGraph: {'), 'Must declare openGraph metadata');
      assert.ok(authContent.includes('twitter: {'), 'Must declare twitter metadata');
    });
  });
});
