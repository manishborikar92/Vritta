import { TodayNavIcon, HabitsNavIcon, InsightsNavIcon } from '../../components/ui/navigation/NavIcons.js';

export const NAV_ITEMS = Object.freeze([
  { href: '/today', label: 'Today', Icon: TodayNavIcon },
  { href: '/habits', label: 'Habits', Icon: HabitsNavIcon },
  { href: '/insights', label: 'Insights', Icon: InsightsNavIcon },
]);


/** A tab is active for its own route and any nested route (/habits/123). */
export const isRouteActive = (pathname, href) =>
  pathname === href || Boolean(pathname?.startsWith(`${href}/`));
