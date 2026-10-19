import { createLucideIcon } from 'lucide-react';

/**
 * Authoritative Navigation Icons for Vritta
 * Calibrated precisely against the design reference image:
 * - TodayNavIcon: Checklist with top item checkmark and bottom item open circle
 * - HabitsNavIcon: 3-line list with centered plus sign on middle line
 * - InsightsNavIcon: 3 solid rounded pill bars (consistency column chart)
 */

export const TodayNavIcon = createLucideIcon('today-nav', [
  ['path', { d: 'M2.5 6.5 L4.75 9 L9 3.5', key: 'today-chk' }],
  ['path', { d: 'M12.5 5.5 h8', key: 'today-l1' }],
  ['circle', { cx: '4.75', cy: '17.5', r: '2.25', key: 'today-circ' }],
  ['path', { d: 'M12.5 17.5 h8', key: 'today-l2' }],
]);

export const HabitsNavIcon = createLucideIcon('habits-nav', [
  ['path', { d: 'M16 5.5H3', key: 'habits-l1' }],
  ['path', { d: 'M11 12H3', key: 'habits-l2' }],
  ['path', { d: 'M16 18.5H3', key: 'habits-l3' }],
  ['path', { d: 'M18 8.5v7', key: 'habits-p1' }],
  ['path', { d: 'M21.5 12h-7', key: 'habits-p2' }],
]);

export const InsightsNavIcon = createLucideIcon('insights-nav', [
  ['rect', { x: '2', y: '8.5', width: '5', height: '11.5', rx: '2.5', fill: 'currentColor', stroke: 'none', key: 'ins-b1' }],
  ['rect', { x: '9.5', y: '2.5', width: '5', height: '17.5', rx: '2.5', fill: 'currentColor', stroke: 'none', key: 'ins-b2' }],
  ['rect', { x: '17', y: '6.5', width: '5', height: '13.5', rx: '2.5', fill: 'currentColor', stroke: 'none', key: 'ins-b3' }],
]);
