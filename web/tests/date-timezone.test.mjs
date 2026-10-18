import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayString,
  getDateString,
  getDayOfWeek,
  getDaysAgo,
  parseDateString,
  getTimingDisplay,
} from '../src/utils/date-helpers.js';

describe('Date & Timezone Handling', () => {
  it('should return local YYYY-MM-DD without UTC offset shift', () => {
    // 2:00 AM in UTC+5:30 on Oct 14 is 8:30 PM on Oct 13 in UTC
    const localDate = new Date(2026, 9, 14, 2, 0, 0); // Oct 14, 2026 02:00 AM
    const dateStr = getTodayString(localDate);
    assert.equal(dateStr, '2026-10-14', 'Date string must match local day (Oct 14), not previous day in UTC');
  });

  it('should return correct short day name in local time', () => {
    const monday = new Date(2026, 9, 12); // Oct 12, 2026 is Monday
    assert.equal(getDayOfWeek(monday), 'Mon');

    const sunday = new Date(2026, 9, 18); // Oct 18, 2026 is Sunday
    assert.equal(getDayOfWeek(sunday), 'Sun');
  });

  it('should calculate days ago accurately relative to local calendar day', () => {
    const baseDate = new Date(2026, 9, 14);
    const threeDaysAgo = getDaysAgo(3, baseDate);
    assert.equal(getDateString(threeDaysAgo), '2026-10-11');
  });

  it('should parse YYYY-MM-DD into local Date safely', () => {
    const parsed = parseDateString('2026-10-14');
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 9); // October is month 9 (0-indexed)
    assert.equal(parsed.getDate(), 14);
  });

  it('should format timing display correctly for guidance vs deadline', () => {
    assert.equal(getTimingDisplay({ timingType: 'anytime' }), 'Anytime');
    assert.equal(getTimingDisplay({ timingType: 'preferred_period', preferredPeriod: 'Afternoon' }), 'Afternoon');
    assert.equal(getTimingDisplay({ timingType: 'relative', relativeTiming: 'Before bed' }), 'Before bed');
    assert.equal(getTimingDisplay({ timingType: 'exact', time: '04:00 PM' }), '04:00 PM');
  });
});
