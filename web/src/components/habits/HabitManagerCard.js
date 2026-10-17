'use client';

import { useState, memo } from 'react';
import {
  Clock,
  Repeat,
  ListChecks,
  Pencil,
  Trash2,
  Timer,
  Hash,
  PenLine,
  Layers,
  Activity,
  ChevronDown,
} from 'lucide-react';
import { getCategoryConfig } from '@/lib/constants/categories';
import { getTimingDisplay, getFrequencyDisplay } from '@/utils/date-helpers';

/**
 * HabitManagerCard — Unified Routine Manager Card for the Routines & Observance page (/habits).
 * Phase 3: Universal Habit Card System
 *
 * Implements:
 * - Clear, consistent display of routine title, canonical category, and active feature indicators.
 * - Schedule and timing recurrence display.
 * - WCAG 2.2 AA compliant touch targets (min 44x44px) for Edit and Delete actions.
 * - Collapsible instructions accordion preventing visual clutter on mobile.
 * - Zero hardcoding of personal email accounts or legacy category aliases.
 */
function HabitManagerCard({ habit, onEdit, onDelete }) {
  const [showInstructions, setShowInstructions] = useState(false);

  if (!habit) return null;

  const config = getCategoryConfig(habit.category, habit.customCategory);
  const timingText = getTimingDisplay(habit);
  const frequencyText = getFrequencyDisplay(habit.frequency);

  const isPersonal = habit.seedOrigin === 'personal_preset' || habit.stableKey?.startsWith('canonical_');
  const isFoundation = !isPersonal && Boolean(habit.stableKey || habit.isSystemSeed);

  // Active feature slots
  const features = habit.features || {};
  const activeFeatures = [];

  if (features.counter?.enabled || habit.completionMethod === 'workbook_sessions') {
    activeFeatures.push({
      key: 'counter',
      label: `Counter: ${features.counter?.targetCount || 2} ${features.counter?.unit || 'sessions'}`,
      icon: Hash,
    });
  }

  const hasTimer = Boolean(
    features.timer?.enabled ?? (
      habit.completionMethod === 'reading_duration' ||
      habit.stableKey === 'canonical_read_books'
    )
  );
  if (hasTimer) {
    activeFeatures.push({
      key: 'timer',
      label: `Timer: ${features.timer?.targetDurationMinutes || habit.targetMinutes || 30}m`,
      icon: Timer,
    });
  }

  const checklistCount = Array.isArray(features.checklist?.items) && features.checklist.items.length > 0
    ? features.checklist.items.length
    : Array.isArray(habit.checklistItems)
    ? habit.checklistItems.length
    : 0;

  if (checklistCount > 0) {
    activeFeatures.push({
      key: 'checklist',
      label: `${checklistCount} Steps Checklist`,
      icon: ListChecks,
    });
  }

  if (features.notes?.enabled || habit.completionMethod === 'simple_with_notes' || habit.completionMethod === 'diary_entry') {
    activeFeatures.push({
      key: 'notes',
      label: features.notes?.isPrivateDiary || habit.completionMethod === 'diary_entry' ? 'Private Diary' : 'Reflection Notes',
      icon: PenLine,
    });
  }

  if (features.catalog?.enabled || habit.completionMethod === 'osho_listening') {
    activeFeatures.push({
      key: 'catalog',
      label: features.catalog?.catalogTitle || 'Discourse Library',
      icon: Layers,
    });
  }

  if (features.daySchedule?.enabled || habit.completionMethod === 'exercise_plan') {
    activeFeatures.push({
      key: 'daySchedule',
      label: 'Day Schedule Plan',
      icon: Activity,
    });
  }

  const instructions = habit.instructions || habit.description || '';
  const hasLongInstructions = instructions.length > 80;

  return (
    <div
      className={`bg-surface rounded-2xl p-4 sm:p-5 shadow-2xs border border-subtle border-t-[3px] ${
        config.borderTopColor || 'border-t-teal-600 dark:border-t-teal-400'
      } hover:shadow-xs transition-shadow`}
    >
      {/* Header row: Categories, Tags, and Action buttons */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <span className={`text-2xs sm:text-xs px-2.5 py-0.5 rounded-full font-semibold border ${config.badgeClasses}`}>
            {config.label || habit.category}
          </span>

          {isPersonal && (
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
              Personal
            </span>
          )}

          {isFoundation && (
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-surface-subtle text-sub border border-subtle">
              Foundation
            </span>
          )}
        </div>

        {/* Action buttons: Edit & Delete (WCAG min 44x44px touch targets) */}
        <div className="flex items-center gap-1 -mr-1 -mt-1 sm:mr-0 sm:mt-0 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit?.(habit)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-95"
            title="Edit Routine"
            aria-label={`Edit ${habit.title}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(habit.id)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95"
            title="Delete Routine"
            aria-label={`Delete ${habit.title}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content area: Title & Instructions */}
      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-main leading-snug">
          {habit.title}
        </h3>

        {instructions && (
          <div>
            {hasLongInstructions ? (
              <div>
                {showInstructions ? (
                  <p className="text-xs sm:text-sm text-sub whitespace-pre-line leading-relaxed">
                    {instructions}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-sub line-clamp-1 leading-relaxed">
                    {instructions}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowInstructions(prev => !prev)}
                  className="text-2xs font-semibold text-teal-700 dark:text-teal-400 hover:underline mt-0.5 inline-flex items-center gap-0.5"
                >
                  {showInstructions ? 'Hide instructions' : 'Show full instructions'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
                </button>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-sub leading-relaxed">
                {instructions}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Feature Slots Badges (Shows all configured slots) */}
      {activeFeatures.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {activeFeatures.map(feat => {
            const Icon = feat.icon;
            return (
              <span
                key={feat.key}
                className="inline-flex items-center gap-1 text-2xs text-teal-800 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800/60 px-2 py-0.5 rounded-md font-medium"
              >
                <Icon className="w-3 h-3" />
                <span>{feat.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Metadata & Recurrence row */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-subtle/60">
        <span className="inline-flex items-center gap-1.5 text-2xs sm:text-xs text-sub bg-surface-subtle border border-subtle px-2 py-0.5 rounded-md font-medium">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{timingText}</span>
        </span>

        <span
          className="inline-flex items-center gap-1.5 text-2xs sm:text-xs text-sub bg-surface-subtle border border-subtle px-2 py-0.5 rounded-md font-medium"
          title={Array.isArray(habit.frequency) ? `Active on: ${habit.frequency.join(', ')}` : habit.frequency ? `Active: ${habit.frequency}` : 'Active every day'}
        >
          <Repeat className="w-3 h-3 text-slate-400" />
          <span>{frequencyText}</span>
        </span>
      </div>
    </div>
  );
}

export default memo(HabitManagerCard);
