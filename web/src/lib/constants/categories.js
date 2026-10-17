/**
 * Centralized Category Configuration for Vritta.
 * Single source of truth for all habit categories, styling tokens, and display labels.
 *
 * Implements an authoritative, general-purpose life-area taxonomy:
 * 1. Health & Fitness          — Bodyweight conditioning, functional strength, movement, and nutrition
 * 2. Learning & Growth         — Vocabulary study, reading, language practice, and cognitive skills
 * 3. Mindfulness & Spirit      — Contemplative listening, meditation, self-inquiry, and awareness
 * 4. Reflection & Journaling   — Daily introspection, learning notes, gratitude, and private diary
 * 5. Work & Career             — Focus blocks, deep work sessions, professional craft, and productivity
 * 6. Creativity & Hobbies      — Creative writing, musical practice, arts, and expressive crafts
 * 7. Relationships & Family    — Connection with family, friends, loved ones, and social communication
 * 8. Rest & Recovery           — Restorative rest, sleep hygiene, evening wind-down, and recharging
 * 9. Other                     — User-defined custom life area with validated customCategory label
 *
 * Strict Canonical Model:
 * - One authoritative definition for selector options, metadata, icons, styling, and validation.
 * - Distinguishes the canonical 'Other' category from the user's customCategory label.
 * - Strictly eliminates legacy color tokens (preserves Restorative Juniper & Warm Amber system).
 */

export const CATEGORIES = [
  'Health & Fitness',
  'Learning & Growth',
  'Mindfulness & Spirit',
  'Reflection & Journaling',
  'Work & Career',
  'Creativity & Hobbies',
  'Relationships & Family',
  'Rest & Recovery',
  'Other',
];

export const CANONICAL_CATEGORIES = CATEGORIES;

/**
 * Validates whether a category is one of the 9 canonical categories.
 * @param {*} category
 * @returns {boolean}
 */
export function isValidCategory(category) {
  return typeof category === 'string' && CATEGORIES.includes(category);
}

/**
 * Validates a custom category label for the 'Other' category.
 * @param {*} customLabel
 * @returns {boolean}
 */
export function isValidCustomCategory(customLabel) {
  return typeof customLabel === 'string' && customLabel.trim().length >= 1 && customLabel.trim().length <= 40;
}

export const CATEGORY_CONFIG = {
  'Health & Fitness': {
    label: 'Health & Fitness',
    borderColor: 'border-l-teal-600 dark:border-l-teal-400',
    borderTopColor: 'border-t-teal-600 dark:border-t-teal-400',
    bgColor: 'bg-teal-50/70 dark:bg-teal-950/40',
    bgColorDone: 'bg-teal-100/60 dark:bg-teal-900/40',
    badgeClasses: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60',
    textColor: 'text-teal-700 dark:text-teal-400',
    dotColor: 'bg-teal-600 dark:bg-teal-400',
    iconName: 'Activity',
    description: 'Bodyweight conditioning, functional strength, movement, and nutrition',
  },
  'Learning & Growth': {
    label: 'Learning & Growth',
    borderColor: 'border-l-emerald-600 dark:border-l-emerald-400',
    borderTopColor: 'border-t-emerald-600 dark:border-t-emerald-400',
    bgColor: 'bg-emerald-50/70 dark:bg-emerald-950/40',
    bgColorDone: 'bg-emerald-100/60 dark:bg-emerald-900/40',
    badgeClasses: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-600 dark:bg-emerald-400',
    iconName: 'BookOpen',
    description: 'Vocabulary study, reading, language practice, and cognitive skills',
  },
  'Mindfulness & Spirit': {
    label: 'Mindfulness & Spirit',
    borderColor: 'border-l-amber-500 dark:border-l-amber-400',
    borderTopColor: 'border-t-amber-500 dark:border-t-amber-400',
    bgColor: 'bg-amber-50/70 dark:bg-amber-950/40',
    bgColorDone: 'bg-amber-100/60 dark:bg-amber-900/40',
    badgeClasses: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    textColor: 'text-amber-700 dark:text-amber-400',
    dotColor: 'bg-amber-500 dark:bg-amber-400',
    iconName: 'Headphones',
    description: 'Contemplative listening, meditation, self-inquiry, and awareness',
  },
  'Reflection & Journaling': {
    label: 'Reflection & Journaling',
    borderColor: 'border-l-rose-500 dark:border-l-rose-400',
    borderTopColor: 'border-t-rose-500 dark:border-t-rose-400',
    bgColor: 'bg-rose-50/70 dark:bg-rose-950/40',
    bgColorDone: 'bg-rose-100/60 dark:bg-rose-900/40',
    badgeClasses: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    textColor: 'text-rose-700 dark:text-rose-400',
    dotColor: 'bg-rose-500 dark:bg-rose-400',
    iconName: 'PenTool',
    description: 'Daily introspection, learning notes, gratitude, and private diary',
  },
  'Work & Career': {
    label: 'Work & Career',
    borderColor: 'border-l-sky-600 dark:border-l-sky-400',
    borderTopColor: 'border-t-sky-600 dark:border-t-sky-400',
    bgColor: 'bg-sky-50/70 dark:bg-sky-950/40',
    bgColorDone: 'bg-sky-100/60 dark:bg-sky-900/40',
    badgeClasses: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
    textColor: 'text-sky-700 dark:text-sky-400',
    dotColor: 'bg-sky-600 dark:bg-sky-400',
    iconName: 'Briefcase',
    description: 'Focus blocks, deep work sessions, professional craft, and productivity',
  },
  'Creativity & Hobbies': {
    label: 'Creativity & Hobbies',
    borderColor: 'border-l-cyan-600 dark:border-l-cyan-400',
    borderTopColor: 'border-t-cyan-600 dark:border-t-cyan-400',
    bgColor: 'bg-cyan-50/70 dark:bg-cyan-950/40',
    bgColorDone: 'bg-cyan-100/60 dark:bg-cyan-900/40',
    badgeClasses: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/60',
    textColor: 'text-cyan-700 dark:text-cyan-400',
    dotColor: 'bg-cyan-600 dark:bg-cyan-400',
    iconName: 'Palette',
    description: 'Creative writing, musical practice, arts, and expressive crafts',
  },
  'Relationships & Family': {
    label: 'Relationships & Family',
    borderColor: 'border-l-orange-500 dark:border-l-orange-400',
    borderTopColor: 'border-t-orange-500 dark:border-t-orange-400',
    bgColor: 'bg-orange-50/70 dark:bg-orange-950/40',
    bgColorDone: 'bg-orange-100/60 dark:bg-orange-900/40',
    badgeClasses: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/60',
    textColor: 'text-orange-700 dark:text-orange-400',
    dotColor: 'bg-orange-500 dark:bg-orange-400',
    iconName: 'Users',
    description: 'Connection with family, friends, loved ones, and social communication',
  },
  'Rest & Recovery': {
    label: 'Rest & Recovery',
    borderColor: 'border-l-slate-500 dark:border-l-slate-400',
    borderTopColor: 'border-t-slate-500 dark:border-t-slate-400',
    bgColor: 'bg-slate-50/70 dark:bg-slate-900/40',
    bgColorDone: 'bg-slate-100/60 dark:bg-slate-800/40',
    badgeClasses: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    textColor: 'text-slate-700 dark:text-slate-300',
    dotColor: 'bg-slate-500 dark:bg-slate-400',
    iconName: 'Moon',
    description: 'Restorative rest, sleep hygiene, evening wind-down, and recharging',
  },
  'Other': {
    label: 'Other',
    borderColor: 'border-l-stone-500 dark:border-l-stone-400',
    borderTopColor: 'border-t-stone-500 dark:border-t-stone-400',
    bgColor: 'bg-stone-50/70 dark:bg-stone-900/40',
    bgColorDone: 'bg-stone-100/60 dark:bg-stone-800/40',
    badgeClasses: 'bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
    textColor: 'text-stone-700 dark:text-stone-300',
    dotColor: 'bg-stone-500 dark:bg-stone-400',
    iconName: 'Compass',
    description: 'Custom user-defined life area with custom label',
  },
};

/**
 * Retrieve styling and label configuration for a category with safe fallback and custom label support.
 * @param {string} category
 * @param {string} [customCategory] - Optional user-defined custom label when category is 'Other'
 * @returns {Object}
 */
export function getCategoryConfig(category, customCategory = '') {
  const base = CATEGORY_CONFIG[category] || {
    label: category || 'General',
    borderColor: 'border-l-slate-400 dark:border-l-slate-600',
    borderTopColor: 'border-t-slate-400 dark:border-t-slate-600',
    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
    bgColorDone: 'bg-slate-100 dark:bg-slate-800',
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    textColor: 'text-slate-700 dark:text-slate-300',
    dotColor: 'bg-slate-400 dark:bg-slate-600',
    iconName: 'CheckCircle2',
    description: '',
  };

  if (category === 'Other' && customCategory && typeof customCategory === 'string' && customCategory.trim()) {
    return {
      ...base,
      label: customCategory.trim(),
    };
  }

  return base;
}
