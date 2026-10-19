import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf8');
}

describe('Phase 1: TodayRhythmBanner Architecture & Invariants', () => {
  const bannerPath = 'src/components/ui/banners/TodayRhythmBanner.js';

  it('should verify TodayRhythmBanner file exists and exports a memoized component', () => {
    assert.ok(fs.existsSync(path.join(webRoot, bannerPath)), 'TodayRhythmBanner.js must exist');
    const content = readWebFile(bannerPath);
    assert.ok(content.includes('export default memo(TodayRhythmBanner)'), 'Component must be memoized');
  });

  it('should verify ui/index.js and banners/index.js export TodayRhythmBanner and habits/index.js does not', () => {
    const uiIndexContent = readWebFile('src/components/ui/index.js');
    assert.ok(uiIndexContent.includes("export { default as TodayRhythmBanner } from './banners/TodayRhythmBanner'"), 'ui/index.js must export TodayRhythmBanner');
    const bannersIndexContent = readWebFile('src/components/ui/banners/index.js');
    assert.ok(bannersIndexContent.includes("export { default as TodayRhythmBanner } from './TodayRhythmBanner'"), 'banners/index.js must export TodayRhythmBanner');
    const habitsIndexContent = readWebFile('src/components/habits/index.js');
    assert.ok(!habitsIndexContent.includes('TodayRhythmBanner'), 'habits/index.js must not export TodayRhythmBanner');
    assert.ok(!uiIndexContent.includes("StreakCounter"), 'Must not export legacy StreakCounter');
  });

  it('should verify TodayPage renders unified TodayRhythmBanner and eliminates duplicate progress div', () => {
    const todayContent = readWebFile('src/app/(protected)/today/page.js');
    assert.ok(todayContent.includes('<TodayRhythmBanner />'), 'Today must render TodayRhythmBanner');
    assert.ok(!todayContent.includes('<StreakCounter />'), 'Today must not render legacy StreakCounter');
    assert.ok(!todayContent.includes("Today&apos;s Rhythm"), 'Duplicate Today Rhythm banner markup must be removed from page.js');
  });

  it('should verify WCAG accessibility semantics in TodayRhythmBanner markup', () => {
    const content = readWebFile(bannerPath);
    assert.ok(content.includes('aria-label="Today\'s Rhythm and Progress"'), 'Section must have accessible label');
    assert.ok(content.includes('role="progressbar"'), 'Progress bar must define role=progressbar');
    assert.ok(content.includes('aria-valuenow='), 'Progress bar must include aria-valuenow');
    assert.ok(content.includes('aria-valuemin="0"'), 'Progress bar must include aria-valuemin');
    assert.ok(content.includes('aria-valuemax="100"'), 'Progress bar must include aria-valuemax');
  });

  it('should verify brand design tokens: Warm Amber #D97706 and Restorative Juniper / Teal', () => {
    const content = readWebFile(bannerPath);
    assert.ok(content.includes('text-amber-600') && content.includes('dark:text-amber-400'), 'Must use Warm Amber text');
    assert.ok(content.includes('bg-amber-100') && content.includes('dark:bg-amber-950/60'), 'Must use Warm Amber icon container');
    assert.ok(content.includes('text-teal-700') && content.includes('dark:text-teal-300'), 'Must use Luminous Teal metric badge');
    assert.ok(content.includes('from-teal-600 to-teal-400') || content.includes('dark:from-teal-500 dark:to-teal-300'), 'Must use brand teal gradient for progress bar');
  });
});

describe('Phase 1: TodayRhythmBanner Logic Simulation', () => {
  function computeBannerProps({ streak = 0, todayStats = { completed: 0, total: 6, percentage: 0, isSunday: false } }) {
    const allCompletedToday = todayStats.total > 0 && todayStats.completed >= todayStats.total;

    const coachingMessage = todayStats.isSunday
      ? 'Sunday restoration: Planned rest maintains your long-term consistency.'
      : streak > 0
      ? 'Consistency over rigidity. Every completed session anchors the habit.'
      : 'Begin gently today. Preferred times are soft guides, not deadlines.';

    const streakHeadline = `${streak} ${streak === 1 ? 'Day' : 'Days'} Steady Rhythm`;

    const metricBadgeText = todayStats.total > 0
      ? `${todayStats.completed} of ${todayStats.total} done • ${todayStats.percentage}%`
      : todayStats.isSunday
      ? 'Planned Rest Day'
      : 'No activities';

    return {
      allCompletedToday,
      coachingMessage,
      streakHeadline,
      metricBadgeText,
      progressPercentage: Math.min(100, Math.max(0, todayStats.percentage)),
    };
  }

  it('should correctly format 0-day streak with gentle beginning motto', () => {
    const result = computeBannerProps({ streak: 0 });
    assert.equal(result.streakHeadline, '0 Days Steady Rhythm');
    assert.equal(result.coachingMessage, 'Begin gently today. Preferred times are soft guides, not deadlines.');
    assert.equal(result.allCompletedToday, false);
  });

  it('should correctly format singular 1-day streak with consistency motto', () => {
    const result = computeBannerProps({ streak: 1, todayStats: { completed: 1, total: 6, percentage: 17, isSunday: false } });
    assert.equal(result.streakHeadline, '1 Day Steady Rhythm');
    assert.equal(result.coachingMessage, 'Consistency over rigidity. Every completed session anchors the habit.');
    assert.equal(result.metricBadgeText, '1 of 6 done • 17%');
    assert.equal(result.progressPercentage, 17);
    assert.equal(result.allCompletedToday, false);
  });

  it('should correctly format multi-day streak', () => {
    const result = computeBannerProps({ streak: 7, todayStats: { completed: 3, total: 6, percentage: 50, isSunday: false } });
    assert.equal(result.streakHeadline, '7 Days Steady Rhythm');
    assert.equal(result.coachingMessage, 'Consistency over rigidity. Every completed session anchors the habit.');
    assert.equal(result.metricBadgeText, '3 of 6 done • 50%');
    assert.equal(result.progressPercentage, 50);
  });

  it('should correctly prioritize Sunday restoration coaching regardless of streak', () => {
    const result = computeBannerProps({ streak: 10, todayStats: { completed: 2, total: 5, percentage: 40, isSunday: true } });
    assert.equal(result.coachingMessage, 'Sunday restoration: Planned rest maintains your long-term consistency.');
  });

  it('should correctly handle all-completed state', () => {
    const result = computeBannerProps({ streak: 5, todayStats: { completed: 6, total: 6, percentage: 100, isSunday: false } });
    assert.equal(result.allCompletedToday, true);
    assert.equal(result.metricBadgeText, '6 of 6 done • 100%');
    assert.equal(result.progressPercentage, 100);
  });

  it('should handle zero scheduled activities (e.g. pure rest day)', () => {
    const resultSunday = computeBannerProps({ streak: 3, todayStats: { completed: 0, total: 0, percentage: 100, isSunday: true } });
    assert.equal(resultSunday.metricBadgeText, 'Planned Rest Day');
    assert.equal(resultSunday.allCompletedToday, false);

    const resultWeekday = computeBannerProps({ streak: 0, todayStats: { completed: 0, total: 0, percentage: 100, isSunday: false } });
    assert.equal(resultWeekday.metricBadgeText, 'No activities');
  });
});
