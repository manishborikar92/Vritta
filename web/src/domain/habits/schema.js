/**
 * Domain Schemas, Enums & Constants for Composable Habits and Daily Logs.
 */

import {
  CATEGORIES,
  CANONICAL_CATEGORIES,
  isValidCategory,
  isValidCustomCategory,
} from '../../lib/constants/categories.js';

export { CATEGORIES, CANONICAL_CATEGORIES, isValidCategory, isValidCustomCategory };

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const TIMING_TYPES = ['anytime', 'preferred_period', 'relative', 'exact'];

export const PREFERRED_PERIODS = ['Morning', 'Afternoon', 'Evening', 'Night'];

/**
 * Strict enum for persisted habit outcomes in Firestore (/dailyLogs/{id}.habitOutcomes).
 * Persisted outcomes MUST ONLY represent explicit recorded actions.
 */
export const PERSISTED_OUTCOME_STATUSES = ['completed', 'skipped', 'missed'];

/**
 * Full domain enum for resolved habit outcomes (including runtime/derived states).
 */
export const DOMAIN_OUTCOME_STATUSES = ['completed', 'skipped', 'missed', 'unrecorded'];

/**
 * 4-tier habit-specific historical date provenance classifications.
 */
export const PROVENANCE_STATUSES = [
  'verified_creation',   // Tier 1: Authoritative createdAt, no logs precede it
  'verified_first_log',  // Tier 2: Habit-specific log precedes createdAt (re-seeded)
  'inferred_activity',   // Tier 3: Lacks createdAt, anchored to earliest habit log
  'unverifiable',        // Tier 4: Lacks createdAt and zero habit logs (horizon is null)
];

/**
 * Canonical alias for provenance status tiers matching plan specification.
 */
export const PROVENANCE_TIERS = PROVENANCE_STATUSES;

/**
 * The six canonical feature slots approved for composable habits.
 * Sub-habits or other unauthorized features are strictly prohibited.
 */
export const APPROVED_FEATURE_SLOTS = [
  'counter',
  'timer',
  'checklist',
  'notes',
  'catalog',
  'daySchedule',
];

export const SEED_ORIGINS = [
  'custom',
  'template',
];
