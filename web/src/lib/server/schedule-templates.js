/**
 * Server-Only Module: Authoritative Consolidated Schedule Templates Catalog for Vritta.
 * 
 * Consolidates all reusable schedule blueprints, foundation wellness routines, and
 * structured discipline plans into a single, authoritative server-side source.
 * 
 * Architectural Invariants:
 * 1. Strict Server-Only: Pure Node ESM module without client bundles; client components
 *    must never bundle this module directly, accessing templates instead via Firestore
 *    or server-side APIs.
 * 2. Separation of Concerns: Contains reusable template blueprints only — completely
 *    decoupled from individual user documents, UID paths, completion logs, or private notes.
 * 3. Stable Template IDs: Every template declares a deterministic, collision-free `id`.
 * 4. General-Purpose Taxonomy: Every template uses the 9 canonical life-area categories.
 * 5. Full Feature Configuration: Explicitly defines all 6 atomic feature slots.
 */

import { OSHO_LIBRARY, OSHO_GROUPS } from '../fixtures/osho-library.js';
import {
  MOVEMENT_SCHEDULE,
  WORKOUT_EXERCISES,
  WALK_DAY_ROUTINE,
  PROGRESSION_PHASES,
  READINESS_CRITERIA,
  STOP_SIGNALS,
  GENERAL_HEALTH_NOTES,
} from '../fixtures/exercise-plan.js';
import { CATEGORIES } from '../constants/categories.js';

export {
  OSHO_LIBRARY,
  OSHO_GROUPS,
  MOVEMENT_SCHEDULE,
  WORKOUT_EXERCISES,
  WALK_DAY_ROUTINE,
  PROGRESSION_PHASES,
  READINESS_CRITERIA,
  STOP_SIGNALS,
  GENERAL_HEALTH_NOTES,
};

const ALL_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WORKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/**
 * Authoritative Master Catalog of Reusable Schedule Templates.
 */
export const SCHEDULE_TEMPLATES = [
  // ============================================================================
  // 1. Foundation Routines (Universal Wellness & Daily Rhythm)
  // ============================================================================
  {
    id: 'template_morning_hydration',
    stableKey: 'routine_hydration_mindfulness',
    title: 'Morning Hydration & Mindfulness',
    category: 'Mindfulness & Spirit',
    description: 'Begin your morning with fresh water and quiet, centered breathing before screens or work.',
    instructions: 'Begin your morning with a tall glass of fresh water and 5 minutes of quiet, centered breathing before engaging with digital screens or work.\n\n1. Drink 1–2 glasses of room-temperature water.\n2. Sit quietly for 5 minutes of slow, diaphragmatic breathing.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'preferred_period',
      preferredPeriod: 'Morning',
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 1,
    },
    features: {
      counter: { enabled: true, targetCount: 2, unit: 'glasses', step: 1, minCount: 0 },
      timer: { enabled: true, targetDurationMinutes: 5, mode: 'countdown', soundOnComplete: true },
      checklist: {
        enabled: true,
        items: [
          { id: 'hydrate', label: 'Drink 1-2 glasses of water', isRequiredForCompletion: true, order: 0 },
          { id: 'breathe', label: '5 minutes of quiet breathing or gentle stretch', isRequiredForCompletion: true, order: 1 },
        ],
      },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['morning', 'mindfulness', 'hydration', 'energy'],
      iconName: 'Sparkles',
      estimatedMinutes: 10,
      difficulty: 'Easy',
      isFoundation: true,
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_daily_movement',
    stableKey: 'routine_physical_movement',
    title: 'Daily Physical Movement',
    category: 'Health & Fitness',
    description: '20–30 minutes of intentional movement: walking, mobility exercises, or functional yoga.',
    instructions: 'Dedicate 20 to 30 minutes to intentional movement: an outdoor walk, bodyweight mobility exercises, yoga, or functional conditioning.\n\n• Warm-up & joint mobility (3–5 min)\n• Main movement session (20–25 min)\n• Cool-down & gentle stretch',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'preferred_period',
      preferredPeriod: 'Afternoon',
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 2,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'sessions', step: 1, minCount: 0 },
      timer: { enabled: true, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: true },
      checklist: {
        enabled: true,
        items: [
          { id: 'warmup', label: 'Warm-up & joint mobility (3–5 min)', isRequiredForCompletion: true, order: 0 },
          { id: 'main', label: 'Main movement session (20–25 min)', isRequiredForCompletion: true, order: 1 },
          { id: 'cooldown', label: 'Cool-down & gentle stretch', isRequiredForCompletion: true, order: 2 },
        ],
      },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['fitness', 'mobility', 'health', 'daily'],
      iconName: 'Activity',
      estimatedMinutes: 30,
      difficulty: 'Moderate',
      isFoundation: true,
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_deep_work_focus',
    stableKey: 'routine_focus_block',
    title: 'Deep Work & Focus Block',
    category: 'Work & Career',
    description: '45–90 minutes of distraction-free focus on your highest-priority creative or engineering goal.',
    instructions: 'Dedicate 45 to 90 minutes of distraction-free focus to your highest-priority creative, engineering, or study goal. Silence all notifications and avoid task-switching.\n\n1. Clear your desk and close unrelated browser tabs.\n2. Set timer for 60 minutes.\n3. Execute single-task focus until timer rings.',
    schedule: {
      frequency: [...WORKDAYS],
      timingType: 'preferred_period',
      preferredPeriod: 'Morning',
      relativeTiming: null,
      exactTime: null,
      restDays: ['Sat', 'Sun'],
      order: 3,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'blocks', step: 1, minCount: 0 },
      timer: { enabled: true, targetDurationMinutes: 60, mode: 'countdown', soundOnComplete: true },
      checklist: {
        enabled: true,
        items: [
          { id: 'prep', label: 'Clear workspace and silence notifications', isRequiredForCompletion: true, order: 0 },
          { id: 'sprint', label: 'Complete uninterrupted deep work sprint', isRequiredForCompletion: true, order: 1 },
        ],
      },
      notes: { enabled: true, isPrivateDiary: false, placeholder: 'What was accomplished in this focus sprint?', reflectionPrompts: ['Main output completed:', 'Blockers encountered:'] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['work', 'focus', 'deep-work', 'productivity'],
      iconName: 'Briefcase',
      estimatedMinutes: 60,
      difficulty: 'Moderate',
      isFoundation: true,
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_balanced_nutrition',
    stableKey: 'routine_balanced_nutrition',
    title: 'Balanced Nourishment & Hydration',
    category: 'Health & Fitness',
    description: 'Wholesome meals, steady water intake (2L+), and mindful eating habits throughout the day.',
    instructions: 'Support sustained energy and cognitive clarity with wholesome meals, regular water intake, and mindful eating habits without rushed snacking.\n\n• Track daily water intake (8 glasses / 2L)\n• Eat whole-food meals with adequate protein and fiber',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'anytime',
      preferredPeriod: null,
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 4,
    },
    features: {
      counter: { enabled: true, targetCount: 8, unit: 'glasses', step: 1, minCount: 0 },
      timer: { enabled: false, targetDurationMinutes: 0, mode: 'countdown', soundOnComplete: false },
      checklist: {
        enabled: true,
        items: [
          { id: 'water', label: 'Hydrate consistently throughout the day (2L+)', isRequiredForCompletion: true, order: 0 },
          { id: 'meals', label: 'Eat balanced, whole-food meals without rushed snacking', isRequiredForCompletion: true, order: 1 },
        ],
      },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['health', 'nutrition', 'water', 'energy'],
      iconName: 'Activity',
      estimatedMinutes: 15,
      difficulty: 'Easy',
      isFoundation: true,
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_evening_winddown',
    stableKey: 'routine_digital_winddown',
    title: 'Evening Digital Wind-Down',
    category: 'Rest & Recovery',
    description: 'Disconnect from high-stimulation work screens and social feeds 45 minutes before bedtime.',
    instructions: 'Disconnect from high-stimulation work screens, email, and social feeds 45 minutes before bedtime to allow the nervous system to relax and prepare for deep restorative sleep.\n\n1. Put phones/laptops on charger outside arm reach.\n2. Dim bright overhead room lights.\n3. Transition to gentle, screen-free reading or stretching.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'preferred_period',
      preferredPeriod: 'Evening',
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 5,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'evenings', step: 1, minCount: 0 },
      timer: { enabled: true, targetDurationMinutes: 45, mode: 'countdown', soundOnComplete: true },
      checklist: {
        enabled: true,
        items: [
          { id: 'screens', label: 'Put work devices away 45 minutes before sleep', isRequiredForCompletion: true, order: 0 },
          { id: 'relax', label: 'Engage in a quiet, screen-free evening transition', isRequiredForCompletion: true, order: 1 },
        ],
      },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['sleep', 'recovery', 'wind-down', 'evening'],
      iconName: 'Moon',
      estimatedMinutes: 45,
      difficulty: 'Easy',
      isFoundation: true,
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_daily_reflection',
    stableKey: 'routine_daily_reflection',
    title: 'Daily Reflection & Gratitude',
    category: 'Reflection & Journaling',
    description: 'Brief evening journaling to synthesize learnings, record gratitude, and clear the mind.',
    instructions: 'Take 5–10 minutes each evening to close the day with clarity, gratitude, and purposeful introspection.\n\n• What went well today and why?\n• What challenge or friction did I encounter?\n• What is one small learning or next step for tomorrow?',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'preferred_period',
      preferredPeriod: 'Night',
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 6,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'entries', step: 1, minCount: 0 },
      timer: { enabled: false, targetDurationMinutes: 10, mode: 'countdown', soundOnComplete: false },
      checklist: { enabled: false, items: [] },
      notes: {
        enabled: true,
        isPrivateDiary: true,
        placeholder: 'Write your evening reflections here...',
        reflectionPrompts: [
          'What went well today and why?',
          'What challenge or friction did I encounter?',
          'What is one small learning or next step for tomorrow?',
        ],
      },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['reflection', 'journal', 'gratitude', 'mindset'],
      iconName: 'PenTool',
      estimatedMinutes: 10,
      difficulty: 'Easy',
      isFoundation: true,
    },
    isPublic: true,
    version: '1.0.0',
  },

  // ============================================================================
  // 2. Structured Learning & Conditioning Blueprints (Specialized Catalogs)
  // ============================================================================
  {
    id: 'template_english_workbook',
    stableKey: 'canonical_english_workbook',
    title: 'Practice English Workbook',
    category: 'Learning & Growth',
    description: 'Daily vocabulary-building with Word Power Made Easy (Norman Lewis). 2 sessions per day with review.',
    instructions: 'Daily vocabulary-building with Word Power Made Easy by Norman Lewis to strengthen English vocabulary and build confident speaking, writing, and reading.\n\nRequired steps:\n1. Review and revise the previous day\'s work before beginning new work (if previous work exists).\n2. Complete Session 1.\n3. Complete Session 2.\n4. Note whether at least one session was completed without interruption.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'anytime',
      preferredPeriod: null,
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 7,
    },
    features: {
      counter: {
        enabled: true,
        targetCount: 2,
        unit: 'sessions',
        step: 1,
        minCount: 0,
      },
      timer: { enabled: false, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: true },
      checklist: {
        enabled: true,
        items: [
          { id: 'step_1', label: 'Review previous day\'s workbook notes', isRequiredForCompletion: true, order: 0 },
          { id: 'step_2', label: 'Session 1 completed', isRequiredForCompletion: true, order: 1 },
          { id: 'step_3', label: 'Session 2 completed', isRequiredForCompletion: true, order: 2 },
          { id: 'step_4', label: 'At least one session completed uninterrupted', isRequiredForCompletion: true, order: 3 },
        ],
      },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['english', 'vocabulary', 'study', 'workbook'],
      iconName: 'BookOpen',
      estimatedMinutes: 30,
      difficulty: 'Moderate',
      bookTitle: 'Word Power Made Easy',
      bookAuthor: 'Norman Lewis',
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_movement_plan_12w',
    stableKey: 'canonical_exercise_plan',
    title: '12-Week Progressive Movement Plan',
    category: 'Health & Fitness',
    description: 'A 12-week bodyweight and functional conditioning routine for posture, mobility, and strength with Sunday rest.',
    instructions: 'A 12-week progressive movement plan for posture, mobility, basic functional strength, and overall well-being at home with no equipment.\n\nSchedule:\n• Mon, Wed, Fri: Strength and Posture Workout (~30 min)\n• Tue, Thu, Sat: Easy Walk (10–20 min) and 3 Stretches\n• Sun: Planned Rest & Recovery (no workout required)\n\nPreferred timing is Afternoon. Completing your movement at any point today counts fully.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'preferred_period',
      preferredPeriod: 'Afternoon',
      relativeTiming: null,
      exactTime: null,
      restDays: ['Sun'],
      order: 8,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'sessions', step: 1, minCount: 0 },
      timer: { enabled: false, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: false },
      checklist: { enabled: false, items: [] },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: {
        enabled: true,
        planTitle: '12-Week Movement Plan',
        totalWeeks: 12,
        dayVariations: MOVEMENT_SCHEDULE,
      },
    },
    metadata: {
      tags: ['workout', 'conditioning', 'posture', 'strength', 'restorative'],
      iconName: 'Activity',
      estimatedMinutes: 30,
      difficulty: 'Moderate',
      totalWeeks: 12,
      is12WeekPlan: true,
      hasPlannedRestDays: true,
      restDays: ['Sun'],
      workoutDays: ['Mon', 'Wed', 'Fri'],
      walkDays: ['Tue', 'Thu', 'Sat'],
      targetDurationMinutes: 30,
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_listen_osho',
    stableKey: 'canonical_listen_osho',
    title: 'Listen to Osho Discourses',
    category: 'Mindfulness & Spirit',
    description: 'Daily contemplative listening for awareness, meditation, and inquiry from the 30-discourse library.',
    instructions: 'Listen to an Osho discourse daily for awareness, meditation, and thoughtful inquiry. Explore the 30-entry listening library across 6 thematic groups (Hindi series 1–23, English series 24–30) at your own pace.\n\nDaily listening for awareness & self-inquiry • Series progress is separate.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'preferred_period',
      preferredPeriod: 'Afternoon',
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 9,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'sessions', step: 1, minCount: 0 },
      timer: { enabled: true, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: true },
      checklist: { enabled: false, items: [] },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: {
        enabled: true,
        catalogId: 'osho_discourses',
        catalogTitle: 'Osho Discourses',
        totalItems: 30,
        items: OSHO_LIBRARY.map((item, idx) => ({
          id: `osho_${item.id || idx + 1}`,
          title: item.title,
          url: item.youtubeUrl || '',
          description: `${item.series || ''} • Language: ${item.language || 'Hindi'}`,
        })),
      },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['meditation', 'awareness', 'contemplation', 'philosophy', 'osho'],
      iconName: 'Headphones',
      estimatedMinutes: 30,
      difficulty: 'Easy',
      totalDiscourses: 30,
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_evening_reading',
    stableKey: 'canonical_read_books',
    title: 'Evening Book Reading',
    category: 'Learning & Growth',
    description: 'Read for 30 minutes before sleep to unwind, expand perspective, and settle the mind.',
    instructions: 'Read a book for 30 minutes before going to sleep. Relative timing: Before bed (no rigid clock time). Helps unwind and settle the mind without screen stimulation.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'relative',
      preferredPeriod: null,
      relativeTiming: 'Before bed',
      exactTime: null,
      restDays: [],
      order: 10,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'sessions', step: 1, minCount: 0 },
      timer: { enabled: true, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: true },
      checklist: { enabled: false, items: [] },
      notes: { enabled: true, isPrivateDiary: false, placeholder: 'Key quotes or reflections from tonight\'s reading...', reflectionPrompts: ['Memorable quote or idea:'] },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['reading', 'books', 'night', 'learning'],
      iconName: 'BookOpen',
      estimatedMinutes: 30,
      difficulty: 'Easy',
      context: 'Before going to sleep',
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_english_speaking',
    stableKey: 'canonical_english_speaking',
    title: 'Practice English Speaking',
    category: 'Learning & Growth',
    description: 'Conversational English practice with voice AI or partner for fluency, pronunciation, and confidence.',
    instructions: 'Practise speaking English with ChatGPT Voice or conversational partner. Practice conversational fluency, pronunciation, and confident expression at any time during the day.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'anytime',
      preferredPeriod: null,
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 11,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'sessions', step: 1, minCount: 0 },
      timer: { enabled: true, targetDurationMinutes: 15, mode: 'countdown', soundOnComplete: true },
      checklist: { enabled: false, items: [] },
      notes: {
        enabled: true,
        isPrivateDiary: false,
        placeholder: 'New words or phrases used in speaking practice...',
        reflectionPrompts: ['Topic discussed:', 'Phrases or expressions practiced:'],
      },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['english', 'speaking', 'fluency', 'conversation'],
      iconName: 'Mic',
      estimatedMinutes: 15,
      difficulty: 'Moderate',
    },
    isPublic: true,
    version: '1.0.0',
  },

  {
    id: 'template_maintain_diary',
    stableKey: 'canonical_maintain_diary',
    title: 'Maintain a Reflective Diary',
    category: 'Reflection & Journaling',
    description: 'Private daily journaling with 5 cognitive reflection prompts for deep self-awareness.',
    instructions: 'Write in your personal diary about what you learned and your personal thoughts. Private to your account. Reflection prompts are provided in the journal view.',
    schedule: {
      frequency: [...ALL_WEEKDAYS],
      timingType: 'anytime',
      preferredPeriod: null,
      relativeTiming: null,
      exactTime: null,
      restDays: [],
      order: 12,
    },
    features: {
      counter: { enabled: false, targetCount: 1, unit: 'entries', step: 1, minCount: 0 },
      timer: { enabled: false, targetDurationMinutes: 15, mode: 'countdown', soundOnComplete: false },
      checklist: { enabled: false, items: [] },
      notes: {
        enabled: true,
        isPrivateDiary: true,
        placeholder: 'Write your private diary thoughts here...',
        reflectionPrompts: [
          'What happened or what thought came to mind?',
          'What did I feel?',
          'What assumption might I be making?',
          'What did I learn?',
          'Is there a small next step?',
        ],
      },
      catalog: { enabled: false, catalogId: '', catalogTitle: '', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '', totalWeeks: 0, dayVariations: {} },
    },
    metadata: {
      tags: ['journal', 'diary', 'reflection', 'introspection', 'private'],
      iconName: 'PenTool',
      estimatedMinutes: 15,
      difficulty: 'Easy',
      isPrivateJournal: true,
    },
    isPublic: true,
    version: '1.0.0',
  },
];

/**
 * Retrieve a template by stable ID.
 * @param {string} templateId
 * @returns {Object|null}
 */
export function getScheduleTemplateById(templateId) {
  if (!templateId) return null;
  return SCHEDULE_TEMPLATES.find(t => t.id === templateId || t.stableKey === templateId) || null;
}

/**
 * Retrieve templates by canonical life area category.
 * @param {string} category
 * @returns {Array<Object>}
 */
export function getScheduleTemplatesByCategory(category) {
  if (!category) return [...SCHEDULE_TEMPLATES];
  return SCHEDULE_TEMPLATES.filter(t => t.category === category);
}

/**
 * Validate a schedule template against the canonical schema.
 * @param {Object} template
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateScheduleTemplate(template) {
  const errors = [];
  if (!template) {
    return { valid: false, errors: ['Template object is required'] };
  }
  if (!template.id || typeof template.id !== 'string' || !template.id.trim()) {
    errors.push('Template id is required');
  }
  if (!template.title || typeof template.title !== 'string' || !template.title.trim()) {
    errors.push('Template title is required');
  }
  if (!template.category || !CATEGORIES.includes(template.category)) {
    errors.push(`Template category '${template.category}' is invalid. Allowed: ${CATEGORIES.join(', ')}`);
  }
  if (!template.schedule || !Array.isArray(template.schedule.frequency)) {
    errors.push('Template schedule.frequency must be an array');
  }
  if (!template.features || typeof template.features !== 'object') {
    errors.push('Template features configuration is required');
  }
  if (template.features?.catalog?.enabled && template.features?.daySchedule?.enabled) {
    errors.push('Catalog and DaySchedule features cannot be enabled simultaneously on the same template.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==============================================================================
// Backward-Compatibility Server-Side Mappings (to preserve existing test suites)
// ==============================================================================

export const MANISH_PERSONAL_ROUTINES = SCHEDULE_TEMPLATES
  .filter(t => t.stableKey && t.stableKey.startsWith('canonical_'))
  .map(t => ({
    stableKey: t.stableKey,
    title: t.title,
    category: t.category,
    completionMethod: t.features.counter.enabled
      ? 'workbook_sessions'
      : t.features.daySchedule.enabled
      ? 'exercise_plan'
      : t.features.catalog.enabled
      ? 'osho_listening'
      : t.features.timer.enabled && t.metadata?.tags?.includes('reading')
      ? 'reading_duration'
      : t.features.notes.enabled && t.metadata?.isPrivateJournal
      ? 'diary_entry'
      : 'simple_with_notes',
    timingType: t.schedule.timingType,
    preferredPeriod: t.schedule.preferredPeriod,
    relativeTiming: t.schedule.relativeTiming,
    time: t.schedule.exactTime || (t.schedule.relativeTiming || t.schedule.preferredPeriod || 'Flexible'),
    frequency: [...t.schedule.frequency],
    order: t.schedule.order,
    isSystemSeed: true,
    seedOrigin: 'personal_preset',
    targetMinutes: t.features.timer?.targetDurationMinutes || null,
    metadata: {
      ...t.metadata,
      restDays: [...(t.schedule.restDays || [])],
      ...(t.features.notes.reflectionPrompts?.length > 0 ? { reflectivePrompts: t.features.notes.reflectionPrompts } : {}),
      ...(t.metadata.bookTitle ? { bookTitle: t.metadata.bookTitle, bookAuthor: t.metadata.bookAuthor, dailySessionsTarget: t.features.counter.targetCount } : {}),
    },
    instructions: t.instructions,
    checklistItems: t.features.checklist.items.map(i => ({ label: i.label })),
  }));

export const CANONICAL_ROUTINES = MANISH_PERSONAL_ROUTINES;

export const DEFAULT_ROUTINES = SCHEDULE_TEMPLATES
  .filter(t => t.metadata?.isFoundation)
  .map(t => ({
    stableKey: t.stableKey,
    title: t.title,
    category: t.category,
    completionMethod: t.features.notes?.enabled ? 'diary_entry' : t.features.checklist?.enabled ? 'checklist' : 'simple',
    timingType: t.schedule.timingType,
    preferredPeriod: t.schedule.preferredPeriod,
    time: t.schedule.preferredPeriod || 'Flexible',
    frequency: [...t.schedule.frequency],
    order: t.schedule.order,
    isSystemSeed: true,
    seedOrigin: 'foundation_preset',
    metadata: { ...t.metadata },
    instructions: t.instructions,
    checklistItems: t.features.checklist?.items?.map(i => ({ label: i.label })) || [],
  }));
