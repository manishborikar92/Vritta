'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Clock,
  Info,
  Sparkles,
  Sunrise,
  Moon,
  ChevronUp,
  ChevronDown,
  Hash,
  CheckSquare,
  FileText,
  Layers,
  Calendar,
  Sliders,
  Plus,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';
import { WEEKDAYS, APPROVED_FEATURE_SLOTS, validateComposableHabit } from '@/lib/constants/habit-models';
import { OSHO_LIBRARY } from '@/lib/fixtures/osho-library';
import { normalizeChecklistItems } from '@/utils/checklist-helpers';
import {
  DEFAULT_READING_DURATION,
  getReadingTargetMinutes,
} from '@/utils/reading-helpers';
import {
  MOVEMENT_SCHEDULE,
  WORKOUT_EXERCISES,
  WALK_DAY_ROUTINE,
} from '@/lib/fixtures/exercise-plan';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function buildDefaultDayVariations(existingVariations = {}) {
  const result = {};
  for (const day of DAYS) {
    const existing = existingVariations?.[day];
    if (existing && Array.isArray(existing.exercises)) {
      result[day] = {
        type: existing.type || (day === 'Sun' ? 'rest' : (day === 'Tue' || day === 'Thu' || day === 'Sat') ? 'walk' : 'workout'),
        label: existing.label || MOVEMENT_SCHEDULE[day]?.label || `${day} Routine`,
        target: existing.target || MOVEMENT_SCHEDULE[day]?.target || '',
        exercises: existing.exercises.map((ex, idx) => ({
          id: ex.id || `ex_${day.toLowerCase()}_${idx + 1}`,
          name: ex.name || ex.label || '',
          label: ex.name || ex.label || '',
          target: ex.target || ex.reps || '',
          reps: ex.reps || ex.target || '',
          cues: ex.cues || '',
          isRequired: Boolean(ex.isRequired ?? ex.isRequiredForCompletion ?? true),
          isRequiredForCompletion: Boolean(ex.isRequired ?? ex.isRequiredForCompletion ?? true),
        })),
      };
    } else {
      const defaultSched = MOVEMENT_SCHEDULE[day] || MOVEMENT_SCHEDULE.Mon;
      const exercises = defaultSched.type === 'rest' || day === 'Sun'
        ? []
        : defaultSched.type === 'walk'
        ? WALK_DAY_ROUTINE.map(ex => ({ ...ex, isRequired: true, isRequiredForCompletion: true }))
        : WORKOUT_EXERCISES.map(ex => ({ ...ex, isRequired: true, isRequiredForCompletion: true }));
      result[day] = {
        type: defaultSched.type || 'workout',
        label: defaultSched.label || `${day} Routine`,
        target: defaultSched.target || '',
        exercises,
      };
    }
  }
  return result;
}

const TIMING_TYPES = [
  { id: 'anytime', label: 'Anytime', description: 'Flexible rhythm', icon: Sparkles },
  { id: 'preferred_period', label: 'Day Period', description: 'Morning, Aft, Eve', icon: Sunrise },
  { id: 'relative', label: 'Relative', description: 'e.g. Before bed', icon: Moon },
  { id: 'exact', label: 'Exact Time', description: 'Suggested target', icon: Clock },
];

const GENERIC_COMPLETION_STYLES = [
  { id: 'simple', label: 'Standard Check-off', description: 'One tap to mark as completed' },
  { id: 'checklist', label: 'Step-by-Step Checklist', description: 'List of steps or sub-tasks to guide your routine' },
  { id: 'diary_entry', label: 'Reflection & Notes', description: 'Private journal note with guided prompts' },
];

export const SPECIALIZED_COMPLETION_STYLES = {
  workbook_sessions: { label: 'Specialized: Two-Session Workbook Counter', description: 'Word Power Made Easy 2-session tracker' },
  exercise_plan: { label: 'Specialized: Structured Movement Plan', description: '12-week progressive movement schedule' },
  osho_listening: { label: 'Specialized: Discourse Listening Session', description: '30-discourse audio library catalog' },
  reading_duration: { label: 'Specialized: Reading Duration Target', description: 'Configurable reading timer session' },
  simple_with_notes: { label: 'Specialized: Speaking Practice with Notes', description: 'Conversational practice with autosaving notes' },
};

/**
 * Universal Composable Habit Modal.
 * Phase 2: Composable Habit Configuration Engine
 */
export default function HabitModal({ habit, onSave, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    title: habit?.title || '',
    category: habit?.category || 'Health & Fitness',
    customCategory: habit?.customCategory || '',
    completionMethod: habit?.completionMethod || 'simple',
    timingType: 'anytime',
    preferredPeriod: 'Afternoon',
    relativeTiming: 'Before bed',
    time: 'Flexible',
    instructions: '',
    frequency: [...DAYS],
    restDays: [],
    checklistItems: [],
    targetMinutes: habit?.features?.timer?.enabled ? getReadingTargetMinutes(habit) : null,
    order: habit?.order || 99,
    stableKey: null,
    seedOrigin: habit?.seedOrigin || 'custom',
    features: {
      counter: { enabled: false, targetCount: 2, unit: 'sessions', step: 1, minCount: 0 },
      timer: { enabled: false, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: true },
      checklist: { enabled: false, items: [] },
      notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
      catalog: { enabled: false, catalogId: 'custom_catalog', catalogTitle: 'Catalog Items', totalItems: 0, items: [] },
      daySchedule: { enabled: false, planTitle: '12-Week Progressive Movement Plan', totalWeeks: 12, dayVariations: buildDefaultDayVariations() },
    },
  });

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'features' | 'schedule'
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newPromptChip, setNewPromptChip] = useState('');
  const [newCatalogItemTitle, setNewCatalogItemTitle] = useState('');
  const [newCatalogItemUrl, setNewCatalogItemUrl] = useState('');
  const [newCatalogItemDesc, setNewCatalogItemDesc] = useState('');
  const [selectedDayScheduleWeekday, setSelectedDayScheduleWeekday] = useState('Mon');
  const [newDayExerciseName, setNewDayExerciseName] = useState('');
  const [newDayExerciseTarget, setNewDayExerciseTarget] = useState('');
  const [newDayExerciseRequired, setNewDayExerciseRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (habit) {
      // Map features
      let features = {
        counter: { enabled: false, targetCount: 2, unit: 'sessions', step: 1, minCount: 0 },
        timer: { enabled: false, targetDurationMinutes: 30, mode: 'countdown', soundOnComplete: true },
        checklist: { enabled: false, items: [] },
        notes: { enabled: false, isPrivateDiary: false, placeholder: '', reflectionPrompts: [] },
        catalog: { enabled: false, catalogId: 'custom_catalog', catalogTitle: 'Catalog Items', totalItems: 0, items: [] },
        daySchedule: { enabled: false, planTitle: '12-Week Progressive Movement Plan', totalWeeks: 12, dayVariations: buildDefaultDayVariations() },
      };

      if (habit.features && typeof habit.features === 'object') {
        features = {
          counter: habit.features.counter ? { ...features.counter, ...habit.features.counter } : features.counter,
          timer: habit.features.timer
            ? { ...features.timer, ...habit.features.timer, enabled: Boolean(habit.features.timer.enabled) }
            : features.timer,
          checklist: habit.features.checklist
            ? { ...features.checklist, enabled: Boolean(habit.features.checklist.enabled), items: Array.isArray(habit.features.checklist.items) ? [...habit.features.checklist.items] : [] }
            : features.checklist,
          notes: habit.features.notes ? { ...features.notes, ...habit.features.notes } : features.notes,
          catalog: habit.features.catalog ? { ...features.catalog, ...habit.features.catalog } : features.catalog,
          daySchedule: habit.features.daySchedule
            ? {
                ...features.daySchedule,
                ...habit.features.daySchedule,
                enabled: Boolean(habit.features.daySchedule.enabled),
                dayVariations: buildDefaultDayVariations(habit.features.daySchedule.dayVariations),
              }
            : features.daySchedule,
        };
      } else {
        const cm = habit.completionMethod;
        if (cm === 'workbook_sessions') {
          features.counter = { enabled: true, targetCount: habit.metadata?.dailySessionsTarget || 2, unit: 'sessions', step: 1, minCount: 0 };
          if (Array.isArray(habit.checklistItems) && habit.checklistItems.length > 0) {
            features.checklist = { enabled: true, items: normalizeChecklistItems(habit.checklistItems) };
          }
        } else if (cm === 'reading_duration') {
          features.timer = { enabled: true, targetDurationMinutes: getReadingTargetMinutes(habit), mode: 'countdown', soundOnComplete: true };
        } else if (cm === 'simple_with_notes') {
          features.notes = { enabled: true, isPrivateDiary: false, placeholder: 'Practice English speaking notes...' };
        } else if (cm === 'diary_entry') {
          features.notes = {
            enabled: true,
            isPrivateDiary: true,
            reflectionPrompts: habit.metadata?.reflectivePrompts || habit.metadata?.reflectionPrompts || [],
            placeholder: 'Write in your personal diary...',
          };
        } else if (cm === 'exercise_plan') {
          features.daySchedule = {
            enabled: true,
            planTitle: '12-Week Progressive Movement Plan',
            totalWeeks: 12,
            dayVariations: buildDefaultDayVariations(),
          };
        } else if (cm === 'osho_listening') {
          features.catalog = { enabled: true, catalogId: 'osho_discourses', catalogTitle: 'Osho Discourses', totalItems: 30, items: [] };
          features.timer = { enabled: false, targetDurationMinutes: habit.targetMinutes || 30, mode: 'countdown', soundOnComplete: false };
        } else if (Array.isArray(habit.checklistItems) && habit.checklistItems.length > 0) {
          features.checklist = { enabled: true, items: normalizeChecklistItems(habit.checklistItems) };
        }
      }

      const schedule = habit.schedule || {};
      const frequency = Array.isArray(schedule.frequency) && schedule.frequency.length > 0
        ? schedule.frequency
        : Array.isArray(habit.frequency) && habit.frequency.length > 0
          ? habit.frequency
          : [...DAYS];

      const restDays = Array.isArray(schedule.restDays)
        ? schedule.restDays
        : Array.isArray(habit.metadata?.restDays)
          ? habit.metadata.restDays
          : [];

      const targetMinutes = features.timer.enabled
        ? (Number(features.timer.targetDurationMinutes) || Number(habit.targetMinutes) || 30)
        : null;

      setFormData({
        title: habit.title || '',
        category: habit.category || 'Health & Fitness',
        customCategory: habit.customCategory || '',
        completionMethod: habit.completionMethod || (habit.checklistItems?.length > 0 ? 'checklist' : 'simple'),
        timingType: schedule.timingType || habit.timingType || (habit.time === 'Afternoon' ? 'preferred_period' : habit.time === 'Before bed' ? 'relative' : 'anytime'),
        preferredPeriod: schedule.preferredPeriod || habit.preferredPeriod || 'Afternoon',
        relativeTiming: schedule.relativeTiming || habit.relativeTiming || 'Before bed',
        time: schedule.exactTime || habit.time || 'Flexible',
        instructions: habit.instructions || habit.description || '',
        frequency,
        restDays,
        checklistItems: normalizeChecklistItems(habit.checklistItems || features.checklist.items),
        targetMinutes,
        order: typeof schedule.order === 'number' ? schedule.order : (habit.order || 1),
        stableKey: habit.stableKey || null,
        seedOrigin: habit.seedOrigin || 'custom',
        features,
      });
    }
  }, [habit]);

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length > 120) {
      newErrors.title = 'Title must be 120 characters or less';
    }
    if (formData.frequency.length === 0) {
      newErrors.frequency = 'Select at least one active day';
    }
    if (formData.category === 'Other') {
      const customLabel = (formData.customCategory || '').trim();
      if (!customLabel) {
        newErrors.customCategory = 'Please enter a name for your custom category';
      } else if (customLabel.length > 40) {
        newErrors.customCategory = 'Custom category label must be 40 characters or less';
      }
    }
    if (formData.features.catalog.enabled) {
      if (!formData.features.catalog.catalogTitle?.trim()) {
        newErrors.catalogTitle = 'Catalog title is required';
      }
      const items = formData.features.catalog.items || [];
      if (items.length === 0) {
        newErrors.catalogItems = 'Add at least one catalog item';
      } else {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item?.title?.trim() && !item?.label?.trim()) {
            newErrors[`catalogItem_${i}`] = `Item #${i + 1} requires a title`;
          }
        }
      }
    }
    if (formData.features.daySchedule.enabled) {
      if (!formData.features.daySchedule.planTitle.trim()) {
        newErrors.dayScheduleTitle = 'Plan title is required';
      }
      const dayVars = formData.features.daySchedule.dayVariations || {};
      for (const [dayKey, dayVar] of Object.entries(dayVars)) {
        if (dayVar.type !== 'rest' && Array.isArray(dayVar.exercises)) {
          for (let i = 0; i < dayVar.exercises.length; i++) {
            const ex = dayVar.exercises[i];
            if (!ex.name?.trim() && !ex.label?.trim()) {
              newErrors[`daySchedule_${dayKey}_${i}`] = `Exercise #${i + 1} on ${dayKey} requires a name`;
            }
          }
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    let displayTime = 'Flexible';
    if (formData.timingType === 'preferred_period') {
      displayTime = formData.preferredPeriod || 'Afternoon';
    } else if (formData.timingType === 'relative') {
      displayTime = formData.relativeTiming || 'Before bed';
    } else if (formData.timingType === 'exact') {
      displayTime = formData.time || '08:00 AM';
    }

    const targetMinutes = formData.features.timer.enabled
      ? (Number(formData.features.timer.targetDurationMinutes) || parseInt(formData.targetMinutes, 10) || 30)
      : null;
    const cleanMetadata = { ...(habit?.metadata || {}) };
    delete cleanMetadata.targetMinutes;

    // Synchronize features and legacy fields
    const cleanFeatures = {
      counter: formData.features.counter.enabled
        ? {
            enabled: true,
            targetCount: Number(formData.features.counter.targetCount) || 1,
            unit: (formData.features.counter.unit || 'sessions').trim(),
            step: Number(formData.features.counter.step) || 1,
            minCount: Number(formData.features.counter.minCount) || 0,
          }
        : { enabled: false },
      timer: formData.features.timer.enabled
        ? {
            enabled: true,
            targetDurationMinutes: targetMinutes,
            mode: formData.features.timer.mode || 'countdown',
            soundOnComplete: Boolean(formData.features.timer.soundOnComplete),
          }
        : { enabled: false },
      checklist: (formData.features.checklist.enabled || formData.checklistItems.length > 0)
        ? {
            enabled: true,
            items: normalizeChecklistItems(formData.checklistItems.length > 0 ? formData.checklistItems : formData.features.checklist.items).map((item, idx) => ({
              id: item.id || `step_${Date.now()}_${idx}`,
              label: item.label.trim(),
              isRequiredForCompletion: Boolean(item.isRequiredForCompletion ?? true),
            })),
          }
        : { enabled: false, items: [] },
      notes: formData.features.notes.enabled
        ? {
            enabled: true,
            isPrivateDiary: Boolean(formData.features.notes.isPrivateDiary),
            placeholder: formData.features.notes.placeholder || '',
            reflectionPrompts: Array.isArray(formData.features.notes.reflectionPrompts)
              ? [...formData.features.notes.reflectionPrompts]
              : [],
          }
        : { enabled: false },
      catalog: formData.features.catalog.enabled
        ? {
            enabled: true,
            catalogId: formData.features.catalog.catalogId || 'custom_catalog',
            catalogTitle: (formData.features.catalog.catalogTitle || 'Library').trim(),
            totalItems: (formData.features.catalog.items || []).filter(item => item && (item.title || item.label)?.trim()).length,
            items: (formData.features.catalog.items || [])
              .filter(item => item && (item.title || item.label)?.trim())
              .map((item, idx) => ({
                id: item.id || `item_${idx + 1}`,
                title: (item.title || item.label || '').trim(),
                order: idx + 1,
                ...(item.description?.trim() ? { description: item.description.trim() } : {}),
                ...(item.url?.trim() ? { url: item.url.trim() } : {}),
              })),
          }
        : { enabled: false },
      daySchedule: formData.features.daySchedule.enabled
        ? {
            enabled: true,
            planTitle: (formData.features.daySchedule.planTitle || 'Weekly Plan').trim(),
            totalWeeks: Number(formData.features.daySchedule.totalWeeks) || 12,
            dayVariations: Object.fromEntries(
              DAYS.map(dayKey => {
                const variation = formData.features.daySchedule.dayVariations?.[dayKey] || {};
                return [
                  dayKey,
                  {
                    type: variation.type || (dayKey === 'Sun' ? 'rest' : 'workout'),
                    label: (variation.label || '').trim(),
                    target: (variation.target || '').trim(),
                    exercises: Array.isArray(variation.exercises)
                      ? variation.exercises
                          .filter(ex => ex && (ex.name || ex.label)?.trim())
                          .map((ex, idx) => ({
                            id: ex.id || `ex_${dayKey.toLowerCase()}_${idx + 1}`,
                            name: (ex.name || ex.label || '').trim(),
                            label: (ex.name || ex.label || '').trim(),
                            target: (ex.target || ex.reps || '').trim(),
                            reps: (ex.reps || ex.target || '').trim(),
                            cues: (ex.cues || '').trim(),
                            isRequired: Boolean(ex.isRequired ?? ex.isRequiredForCompletion ?? true),
                            isRequiredForCompletion: Boolean(ex.isRequired ?? ex.isRequiredForCompletion ?? true),
                          }))
                      : [],
                  },
                ];
              })
            ),
          }
        : { enabled: false },
    };

    const schedule = {
      frequency: [...formData.frequency],
      timingType: formData.timingType,
      preferredPeriod: formData.timingType === 'preferred_period' ? formData.preferredPeriod : null,
      relativeTiming: formData.timingType === 'relative' ? formData.relativeTiming : null,
      exactTime: formData.timingType === 'exact' ? formData.time : null,
      restDays: DAYS.filter(d => !formData.frequency.includes(d)),
      order: formData.order || 1,
    };

    let legacyCompletionMethod = formData.completionMethod;
    if (cleanFeatures.counter.enabled && cleanFeatures.checklist.enabled) {
      legacyCompletionMethod = 'workbook_sessions';
    } else if (cleanFeatures.daySchedule.enabled) {
      legacyCompletionMethod = 'exercise_plan';
    } else if (cleanFeatures.catalog.enabled) {
      if (cleanFeatures.catalog.catalogId === 'osho_discourses' || formData.stableKey === 'canonical_listen_osho' || formData.title?.toLowerCase().includes('osho')) {
        legacyCompletionMethod = 'osho_listening';
      } else {
        legacyCompletionMethod = 'catalog';
      }
    } else if (cleanFeatures.timer.enabled) {
      legacyCompletionMethod = 'reading_duration';
    } else if (cleanFeatures.notes.enabled) {
      legacyCompletionMethod = cleanFeatures.notes.isPrivateDiary ? 'diary_entry' : 'simple_with_notes';
    } else if (cleanFeatures.checklist.enabled) {
      legacyCompletionMethod = 'checklist';
    }

    const payload = {
      ...formData,
      title: formData.title.trim(),
      category: formData.category,
      customCategory: formData.category === 'Other' ? (formData.customCategory || '').trim() : null,
      instructions: formData.instructions.trim(),
      description: formData.instructions.trim(),
      time: displayTime,
      targetMinutes,
      checklistItems: normalizeChecklistItems(formData.checklistItems),
      metadata: cleanMetadata,
      schedule,
      features: cleanFeatures,
      completionMethod: legacyCompletionMethod,
      seedOrigin: formData.seedOrigin,
    };

    setSaving(true);
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      frequency: prev.frequency.includes(day)
        ? prev.frequency.filter(d => d !== day)
        : [...prev.frequency, day],
    }));
  };

  const toggleFeatureSlot = (slotKey) => {
    setFormData(prev => {
      const nextEnabled = !prev.features[slotKey]?.enabled;
      const updatedFeatures = {
        ...prev.features,
        [slotKey]: {
          ...prev.features[slotKey],
          enabled: nextEnabled,
        },
      };

      // Mutex rule: catalog and daySchedule cannot both be enabled simultaneously
      if (slotKey === 'catalog' && nextEnabled) {
        updatedFeatures.daySchedule = {
          ...updatedFeatures.daySchedule,
          enabled: false,
        };
      } else if (slotKey === 'daySchedule' && nextEnabled) {
        updatedFeatures.catalog = {
          ...updatedFeatures.catalog,
          enabled: false,
        };
      }

      return {
        ...prev,
        features: updatedFeatures,
      };
    });
  };

  const addCatalogItem = () => {
    if (!newCatalogItemTitle.trim()) return;
    const title = newCatalogItemTitle.trim();
    const url = newCatalogItemUrl.trim();
    const desc = newCatalogItemDesc.trim();
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      order: (formData.features.catalog.items?.length || 0) + 1,
      ...(url ? { url } : {}),
      ...(desc ? { description: desc } : {}),
    };
    const currentItems = Array.isArray(formData.features.catalog.items) ? formData.features.catalog.items : [];
    const updatedItems = [...currentItems, newItem];
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        catalog: {
          ...prev.features.catalog,
          items: updatedItems,
          totalItems: updatedItems.length,
        },
      },
    }));
    setNewCatalogItemTitle('');
    setNewCatalogItemUrl('');
    setNewCatalogItemDesc('');
  };

  const removeCatalogItem = (index) => {
    const currentItems = Array.isArray(formData.features.catalog.items) ? formData.features.catalog.items : [];
    const updatedItems = currentItems.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        catalog: {
          ...prev.features.catalog,
          items: updatedItems,
          totalItems: updatedItems.length,
        },
      },
    }));
  };

  const moveCatalogItem = (index, direction) => {
    const currentItems = Array.isArray(formData.features.catalog.items) ? [...formData.features.catalog.items] : [];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentItems.length) return;
    const [moved] = currentItems.splice(index, 1);
    currentItems.splice(targetIndex, 0, moved);
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        catalog: {
          ...prev.features.catalog,
          items: currentItems,
        },
      },
    }));
  };

  const loadOshoPreset = () => {
    const oshoItems = OSHO_LIBRARY.map((s) => ({
      id: s.id,
      title: `${s.order}. ${s.title}`,
      description: `${s.theme} (${s.language})`,
      order: s.order,
      ...(s.url ? { url: s.url } : {}),
    }));
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        catalog: {
          enabled: true,
          catalogId: 'osho_discourses',
          catalogTitle: 'Osho Discourse Audio Library',
          totalItems: 30,
          items: oshoItems,
        },
        daySchedule: {
          ...prev.features.daySchedule,
          enabled: false,
        },
      },
    }));
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const stableId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem = { id: stableId, label: newChecklistItem.trim() };
    setFormData(prev => ({
      ...prev,
      checklistItems: [...prev.checklistItems, newItem],
      features: {
        ...prev.features,
        checklist: {
          ...prev.features.checklist,
          enabled: true,
          items: [...prev.features.checklist.items, newItem],
        },
      },
    }));
    setNewChecklistItem('');
  };

  const updateChecklistItemLabel = (index, newLabel) => {
    setFormData(prev => ({
      ...prev,
      checklistItems: prev.checklistItems.map((item, i) =>
        i === index ? { ...item, label: newLabel } : item
      ),
      features: {
        ...prev.features,
        checklist: {
          ...prev.features.checklist,
          items: prev.features.checklist.items.map((item, i) =>
            i === index ? { ...item, label: newLabel } : item
          ),
        },
      },
    }));
  };

  const moveChecklistItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= formData.checklistItems.length) return;
    const items = [...formData.checklistItems];
    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);
    setFormData(prev => ({
      ...prev,
      checklistItems: items,
      features: {
        ...prev.features,
        checklist: { ...prev.features.checklist, items },
      },
    }));
  };

  const removeChecklistItem = (index) => {
    setFormData(prev => ({
      ...prev,
      checklistItems: prev.checklistItems.filter((_, i) => i !== index),
      features: {
        ...prev.features,
        checklist: {
          ...prev.features.checklist,
          items: prev.features.checklist.items.filter((_, i) => i !== index),
        },
      },
    }));
  };

  const addPromptChip = () => {
    if (!newPromptChip.trim()) return;
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        notes: {
          ...prev.features.notes,
          reflectionPrompts: [
            ...(prev.features.notes.reflectionPrompts || []),
            newPromptChip.trim(),
          ],
        },
      },
    }));
    setNewPromptChip('');
  };

  const removePromptChip = (idx) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        notes: {
          ...prev.features.notes,
          reflectionPrompts: prev.features.notes.reflectionPrompts.filter((_, i) => i !== idx),
        },
      },
    }));
  };

  const handleSelectDayScheduleWeekday = (day) => {
    setSelectedDayScheduleWeekday(day);
  };

  const handleChangeDayVariationType = (day, newType) => {
    setFormData(prev => {
      const currentVars = prev.features.daySchedule.dayVariations || {};
      const currentVar = currentVars[day] || {};
      let updatedExercises = currentVar.exercises || [];
      let label = currentVar.label;
      let target = currentVar.target;

      if (newType === 'rest') {
        label = 'Planned Rest & Recovery';
        target = 'No workout required';
        updatedExercises = [];
      } else if (newType === 'walk') {
        label = 'Easy Walk & Stretches';
        target = 'Walk 10–20 minutes, then 3 stretches';
        if (updatedExercises.length === 0) {
          updatedExercises = WALK_DAY_ROUTINE.map(ex => ({ ...ex, isRequired: true, isRequiredForCompletion: true }));
        }
      } else if (newType === 'workout') {
        label = 'Strength and Posture Workout';
        target = 'About 30 minutes';
        if (updatedExercises.length === 0) {
          updatedExercises = WORKOUT_EXERCISES.map(ex => ({ ...ex, isRequired: true, isRequiredForCompletion: true }));
        }
      } else if (newType === 'custom') {
        label = label || `${day} Custom Routine`;
        target = target || '20–30 minutes';
      }

      return {
        ...prev,
        features: {
          ...prev.features,
          daySchedule: {
            ...prev.features.daySchedule,
            dayVariations: {
              ...currentVars,
              [day]: {
                ...currentVar,
                type: newType,
                label,
                target,
                exercises: updatedExercises,
              },
            },
          },
        },
      };
    });
  };

  const handleUpdateDayVariationMeta = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        daySchedule: {
          ...prev.features.daySchedule,
          dayVariations: {
            ...prev.features.daySchedule.dayVariations,
            [day]: {
              ...prev.features.daySchedule.dayVariations?.[day],
              [field]: value,
            },
          },
        },
      },
    }));
  };

  const handleAddDayScheduleExercise = (day) => {
    if (!newDayExerciseName.trim()) return;
    const newEx = {
      id: `ex_${day.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newDayExerciseName.trim(),
      label: newDayExerciseName.trim(),
      target: newDayExerciseTarget.trim(),
      reps: newDayExerciseTarget.trim(),
      isRequired: Boolean(newDayExerciseRequired),
      isRequiredForCompletion: Boolean(newDayExerciseRequired),
    };

    setFormData(prev => {
      const currentVars = prev.features.daySchedule.dayVariations || {};
      const currentDayVar = currentVars[day] || { type: 'workout', label: `${day} Routine`, exercises: [] };
      const currentExs = Array.isArray(currentDayVar.exercises) ? currentDayVar.exercises : [];
      return {
        ...prev,
        features: {
          ...prev.features,
          daySchedule: {
            ...prev.features.daySchedule,
            dayVariations: {
              ...currentVars,
              [day]: {
                ...currentDayVar,
                exercises: [...currentExs, newEx],
              },
            },
          },
        },
      };
    });

    setNewDayExerciseName('');
    setNewDayExerciseTarget('');
    setNewDayExerciseRequired(true);
  };

  const handleUpdateDayScheduleExercise = (day, index, field, value) => {
    setFormData(prev => {
      const currentVars = prev.features.daySchedule.dayVariations || {};
      const currentDayVar = currentVars[day] || {};
      const currentExs = [...(currentDayVar.exercises || [])];
      if (!currentExs[index]) return prev;
      currentExs[index] = {
        ...currentExs[index],
        [field]: value,
        ...(field === 'name' ? { label: value } : {}),
      };
      return {
        ...prev,
        features: {
          ...prev.features,
          daySchedule: {
            ...prev.features.daySchedule,
            dayVariations: {
              ...currentVars,
              [day]: {
                ...currentDayVar,
                exercises: currentExs,
              },
            },
          },
        },
      };
    });
  };

  const handleToggleDayScheduleExerciseRequired = (day, index) => {
    setFormData(prev => {
      const currentVars = prev.features.daySchedule.dayVariations || {};
      const currentDayVar = currentVars[day] || {};
      const currentExs = [...(currentDayVar.exercises || [])];
      if (!currentExs[index]) return prev;
      const nextRequired = !Boolean(currentExs[index].isRequired ?? currentExs[index].isRequiredForCompletion ?? true);
      currentExs[index] = {
        ...currentExs[index],
        isRequired: nextRequired,
        isRequiredForCompletion: nextRequired,
      };
      return {
        ...prev,
        features: {
          ...prev.features,
          daySchedule: {
            ...prev.features.daySchedule,
            dayVariations: {
              ...currentVars,
              [day]: {
                ...currentDayVar,
                exercises: currentExs,
              },
            },
          },
        },
      };
    });
  };

  const handleRemoveDayScheduleExercise = (day, index) => {
    setFormData(prev => {
      const currentVars = prev.features.daySchedule.dayVariations || {};
      const currentDayVar = currentVars[day] || {};
      const currentExs = (currentDayVar.exercises || []).filter((_, i) => i !== index);
      return {
        ...prev,
        features: {
          ...prev.features,
          daySchedule: {
            ...prev.features.daySchedule,
            dayVariations: {
              ...currentVars,
              [day]: {
                ...currentDayVar,
                exercises: currentExs,
              },
            },
          },
        },
      };
    });
  };

  const handleMoveDayScheduleExercise = (day, index, direction) => {
    setFormData(prev => {
      const currentVars = prev.features.daySchedule.dayVariations || {};
      const currentDayVar = currentVars[day] || {};
      const currentExs = [...(currentDayVar.exercises || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= currentExs.length) return prev;
      const [moved] = currentExs.splice(index, 1);
      currentExs.splice(targetIndex, 0, moved);
      return {
        ...prev,
        features: {
          ...prev.features,
          daySchedule: {
            ...prev.features.daySchedule,
            dayVariations: {
              ...currentVars,
              [day]: {
                ...currentDayVar,
                exercises: currentExs,
              },
            },
          },
        },
      };
    });
  };

  const handleLoad12WeekMovementDefaults = () => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        daySchedule: {
          enabled: true,
          planTitle: '12-Week Progressive Movement Plan',
          totalWeeks: 12,
          dayVariations: buildDefaultDayVariations(),
        },
      },
    }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl border-t sm:border border-subtle overflow-hidden">
        {/* Header */}
        <div className="bg-surface border-b border-subtle px-5 py-3.5 sm:py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-main leading-tight">
              {habit?.id ? 'Edit Routine' : 'Create New Routine'}
            </h2>
            <p className="text-2xs text-sub">
              Configure features, scheduling, and observance rhythm
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 bg-surface border-b border-subtle flex items-center gap-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'details'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            Basics & Category
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'features'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Features ({Object.values(formData.features).filter(f => f.enabled).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'schedule'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            Rhythm & Schedule
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* TAB 1: BASIC DETAILS */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Routine Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-slate-400"
                    placeholder="e.g., Practice English Workbook"
                    maxLength={120}
                  />
                  {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title}</p>}
                </div>

                {/* Life-Area Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Life-Area Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Conditional Custom Category Input for 'Other' */}
                {formData.category === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Custom Category Name *
                    </label>
                    <input
                      type="text"
                      value={formData.customCategory}
                      onChange={(e) => setFormData(prev => ({ ...prev, customCategory: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-slate-400"
                      placeholder="e.g., Financial Health, Gardening, Skill Building"
                      maxLength={40}
                    />
                    {errors.customCategory && (
                      <p className="text-rose-500 text-xs mt-1">{errors.customCategory}</p>
                    )}
                    <p className="text-2xs text-muted mt-1">
                      Distinguishes your custom life-area while adhering to the canonical domain model.
                    </p>
                  </div>
                )}

                {/* Instructions & Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Instructions & Purpose Notes
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    rows={3}
                    placeholder="Add purpose, instructions, or helpful notes..."
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent leading-relaxed placeholder-slate-400"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: RHYTHM & SCHEDULE */}
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                {/* Timing Preference Model (Compact 2x2 Responsive Architecture) */}
                <div className="p-3 sm:p-3.5 bg-surface-subtle dark:bg-slate-800/40 rounded-xl border border-subtle dark:border-slate-700/80 space-y-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-main mb-1.5">
                      Timing Preference (Soft Target, Not a Deadline)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      {TIMING_TYPES.map(t => {
                        const Icon = t.icon;
                        const isSelected = formData.timingType === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, timingType: t.id }))}
                            className={`min-h-[46px] p-2 sm:p-2.5 rounded-xl font-medium text-left border transition-all flex items-center gap-2 ${
                              isSelected
                                ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-600 shadow-2xs'
                                : 'bg-surface dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-subtle dark:border-slate-700 hover:bg-surface-subtle dark:hover:bg-slate-700/80'
                            }`}
                          >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold leading-tight truncate">{t.label}</span>
                              <span className={`block text-2xs leading-tight truncate mt-0.5 ${isSelected ? 'text-teal-100 dark:text-teal-200' : 'text-muted'}`}>
                                {t.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.timingType === 'preferred_period' && (
                    <div className="pt-1.5 border-t border-subtle/70">
                      <label className="block text-2xs font-semibold text-muted mb-1.5">
                        Preferred Period of Day:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {['Morning', 'Afternoon', 'Evening'].map(period => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, preferredPeriod: period }))}
                            className={`min-h-[40px] py-1.5 px-2 text-xs rounded-lg font-medium border text-center transition-colors ${
                              formData.preferredPeriod === period
                                ? 'bg-amber-600 dark:bg-amber-500 text-white border-amber-600 dark:border-amber-500 font-semibold shadow-2xs'
                                : 'bg-surface dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-subtle dark:border-slate-700 hover:bg-surface-subtle'
                            }`}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.timingType === 'relative' && (
                    <div className="pt-1.5 border-t border-subtle/70 space-y-1.5">
                      <label className="block text-2xs font-semibold text-muted">
                        Relative Anchor:
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {['Before bed', 'After waking', 'After lunch', 'Evening wind-down'].map(chip => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, relativeTiming: chip }))}
                            className={`text-2xs px-2.5 py-1 rounded-full border transition-colors ${
                              formData.relativeTiming === chip
                                ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700 font-semibold'
                                : 'bg-surface dark:bg-slate-800 text-muted hover:text-main border-subtle'
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={formData.relativeTiming}
                        onChange={(e) => setFormData(prev => ({ ...prev, relativeTiming: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-base sm:text-xs bg-surface text-main placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="e.g., Before bed, After waking"
                      />
                    </div>
                  )}

                  {formData.timingType === 'exact' && (
                    <div className="pt-1.5 border-t border-subtle/70 space-y-1.5">
                      <label className="block text-2xs font-semibold text-muted">
                        Suggested Target Time:
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {['07:00 AM', '12:30 PM', '05:00 PM', '09:00 PM'].map(chip => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, time: chip }))}
                            className={`text-2xs px-2.5 py-1 rounded-full border transition-colors ${
                              formData.time === chip
                                ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700 font-semibold'
                                : 'bg-surface dark:bg-slate-800 text-muted hover:text-main border-subtle'
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={formData.time}
                        onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-base sm:text-xs bg-surface text-main placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="e.g., 04:30 PM"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-2xs text-muted pt-0.5">
                    <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                    <span>Preferred times guide your day without penalty for completing at other times.</span>
                  </div>
                </div>

                {/* Active Days / Recurrence */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Active Weekdays
                    </label>
                    <span className="text-2xs text-muted">Single source of schedule truth</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`w-full h-11 min-h-[44px] flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                          formData.frequency.includes(day)
                            ? 'bg-teal-700 dark:bg-teal-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  {errors.frequency && <p className="text-rose-500 text-xs mt-1">{errors.frequency}</p>}

                  {/* Integrated Planned Rest Days Notice (Single source of truth) */}
                  <div className="mt-2.5 flex items-start gap-2 p-2.5 bg-surface-subtle dark:bg-slate-800/40 rounded-xl border border-subtle dark:border-slate-700/60 text-2xs text-sub leading-relaxed">
                    <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-main font-semibold">Planned Rest Days:</strong> Weekdays not selected above are automatically treated as planned rest days and will never break streaks.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: COMPOSABLE FEATURE SLOTS */}
            {activeTab === 'features' && (
              <div className="space-y-3.5">
                {/* 1. Counter Slot */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  formData.features.counter.enabled
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                    : 'bg-surface border-subtle'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-main block">Counter Stepper</span>
                        <span className="text-2xs text-muted block">Multi-session or countable quantity tracking</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeatureSlot('counter')}
                      className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
                        formData.features.counter.enabled
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted'
                      }`}
                    >
                      {formData.features.counter.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {formData.features.counter.enabled && (
                    <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-2xs font-semibold text-main mb-1">Target Count</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.features.counter.targetCount}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            features: {
                              ...prev.features,
                              counter: { ...prev.features.counter, targetCount: parseInt(e.target.value, 10) || 1 },
                            },
                          }))}
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-semibold text-main mb-1">Unit Label</label>
                        <input
                          type="text"
                          value={formData.features.counter.unit}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            features: {
                              ...prev.features,
                              counter: { ...prev.features.counter, unit: e.target.value },
                            },
                          }))}
                          placeholder="e.g. sessions, glasses"
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Timer Slot */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  formData.features.timer.enabled
                    ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800'
                    : 'bg-surface border-subtle'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-main block">Duration Timer</span>
                        <span className="text-2xs text-muted block">Focus countdown with Web Audio chime</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeatureSlot('timer')}
                      className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
                        formData.features.timer.enabled
                          ? 'bg-teal-700 dark:bg-teal-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted'
                      }`}
                    >
                      {formData.features.timer.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {formData.features.timer.enabled && (
                    <div className="mt-3 pt-3 border-t border-sky-200/60 dark:border-sky-900/40 space-y-2.5">
                      <div>
                        <label className="block text-2xs font-semibold text-main mb-1.5">Target Duration (Minutes)</label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[10, 15, 20, 25, 30, 45, 60].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                targetMinutes: mins,
                                features: {
                                  ...prev.features,
                                  timer: { ...prev.features.timer, targetDurationMinutes: mins },
                                },
                              }))}
                              className={`px-2.5 py-1 text-2xs rounded-lg font-semibold border transition-colors ${
                                formData.features.timer.targetDurationMinutes === mins
                                  ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700'
                                  : 'bg-surface border-subtle text-muted hover:text-main'
                              }`}
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="text-2xs text-muted flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.features.timer.soundOnComplete}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              features: {
                                ...prev.features,
                                timer: { ...prev.features.timer, soundOnComplete: e.target.checked },
                              },
                            }))}
                            className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                          />
                          <span>Play peaceful audio chime on timer completion</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Checklist Slot */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  formData.features.checklist.enabled
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-surface border-subtle'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-main block">Step-by-Step Checklist</span>
                        <span className="text-2xs text-muted block">Multi-step action sequence or prerequisites</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeatureSlot('checklist')}
                      className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
                        formData.features.checklist.enabled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted'
                      }`}
                    >
                      {formData.features.checklist.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {formData.features.checklist.enabled && (
                    <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40 space-y-2">
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {formData.checklistItems.map((item, index) => (
                          <div
                            key={item.id || index}
                            className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                          >
                            <span className="text-2xs font-bold text-slate-400 w-4 text-center select-none flex-shrink-0">
                              {index + 1}.
                            </span>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => updateChecklistItemLabel(index, e.target.value)}
                              className="flex-1 text-xs bg-transparent text-slate-800 dark:text-slate-200 border-0 focus:outline-none focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-1"
                              placeholder="Step description..."
                              aria-label={`Step ${index + 1} description`}
                            />
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => moveChecklistItem(index, -1)}
                                disabled={index === 0}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                aria-label={`Move step ${index + 1} up`}
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChecklistItem(index, 1)}
                                disabled={index === formData.checklistItems.length - 1}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                aria-label={`Move step ${index + 1} down`}
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeChecklistItem(index)}
                                className="w-7 h-7 flex items-center justify-center text-rose-500 hover:text-rose-700 rounded"
                                aria-label={`Remove step ${index + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newChecklistItem}
                          onChange={(e) => setNewChecklistItem(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addChecklistItem();
                            }
                          }}
                          placeholder="Add step or exercise..."
                          className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-base sm:text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                        />
                        <button
                          type="button"
                          onClick={addChecklistItem}
                          className="min-h-[38px] px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        >
                          Add Step
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Notes & Reflection Slot */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  formData.features.notes.enabled
                    ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-300 dark:border-teal-800'
                    : 'bg-surface border-subtle'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-main block">Notes & Reflection</span>
                        <span className="text-2xs text-muted block">Autosaved journal entry with optional guided prompt chips</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeatureSlot('notes')}
                      className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
                        formData.features.notes.enabled
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted'
                      }`}
                    >
                      {formData.features.notes.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {formData.features.notes.enabled && (
                    <div className="mt-3 pt-3 border-t border-teal-200/60 dark:border-teal-900/40 space-y-2.5">
                      <label className="text-2xs text-muted flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.features.notes.isPrivateDiary)}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            features: {
                              ...prev.features,
                              notes: { ...prev.features.notes, isPrivateDiary: e.target.checked },
                            },
                          }))}
                          className="rounded text-teal-600 w-3.5 h-3.5"
                        />
                        <span className="font-semibold text-main">Private Diary Mode (Strict user isolation)</span>
                      </label>

                      <div>
                        <label className="block text-2xs font-semibold text-main mb-1">Textarea Placeholder</label>
                        <input
                          type="text"
                          value={formData.features.notes.placeholder || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            features: {
                              ...prev.features,
                              notes: { ...prev.features.notes, placeholder: e.target.value },
                            },
                          }))}
                          placeholder="e.g., Today's learnings, insights, or gratitude..."
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                        />
                      </div>

                      {/* Reflection Prompt Chips */}
                      <div>
                        <label className="block text-2xs font-semibold text-main mb-1.5">Guiding Prompt Chips</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {(formData.features.notes.reflectionPrompts || []).map((prompt, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 text-2xs"
                            >
                              <span>{prompt}</span>
                              <button
                                type="button"
                                onClick={() => removePromptChip(idx)}
                                className="text-teal-500 hover:text-teal-700"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newPromptChip}
                            onChange={(e) => setNewPromptChip(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addPromptChip();
                              }
                            }}
                            placeholder="Add a guiding prompt chip..."
                            className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                          />
                          <button
                            type="button"
                            onClick={addPromptChip}
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold"
                          >
                            Add Chip
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Catalog Slot */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  formData.features.catalog.enabled
                    ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800'
                    : 'bg-surface border-subtle'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-main block">Multi-Item Catalog</span>
                        <span className="text-2xs text-muted block">Curated discourse syllabus or lecture audio collection</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeatureSlot('catalog')}
                      className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
                        formData.features.catalog.enabled
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted'
                      }`}
                    >
                      {formData.features.catalog.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {formData.features.catalog.enabled && (
                    <div className="mt-3 pt-3 border-t border-sky-200/60 dark:border-sky-900/40 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <label className="block text-2xs font-semibold text-main mb-1">Catalog Title</label>
                          <input
                            type="text"
                            value={formData.features.catalog.catalogTitle}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              features: {
                                ...prev.features,
                                catalog: { ...prev.features.catalog, catalogTitle: e.target.value },
                              },
                            }))}
                            placeholder="e.g., Contemplative Discourses"
                            className={`w-full px-3 py-1.5 border rounded-lg text-xs bg-surface text-main ${
                              errors.catalogTitle ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                          {errors.catalogTitle && (
                            <p className="text-2xs text-rose-500 mt-1">{errors.catalogTitle}</p>
                          )}
                        </div>
                        <div className="pt-4">
                          <button
                            type="button"
                            onClick={loadOshoPreset}
                            className="px-2.5 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-200 border border-amber-300 dark:border-amber-700/60 rounded-lg text-2xs font-semibold flex items-center gap-1 transition-colors"
                            title="Load 30 Osho Discourses preset"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Load Osho (30)</span>
                          </button>
                        </div>
                      </div>

                      {/* Catalog Items Management */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-2xs font-semibold text-main">
                          <span>Catalog Items ({formData.features.catalog.items?.length || 0})</span>
                          <span className="text-muted">Interactive curriculum items</span>
                        </div>

                        {errors.catalogItems && (
                          <p className="text-2xs text-rose-500 font-semibold">{errors.catalogItems}</p>
                        )}

                        {/* Existing items list */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {(formData.features.catalog.items || []).map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="p-2 rounded-lg bg-surface border border-subtle space-y-1 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-2xs font-bold text-slate-400 w-4 text-center select-none flex-shrink-0">
                                  {idx + 1}.
                                </span>
                                <input
                                  type="text"
                                  value={item.title || item.label || ''}
                                  onChange={(e) => {
                                    const updated = [...(formData.features.catalog.items || [])];
                                    updated[idx] = { ...updated[idx], title: e.target.value };
                                    setFormData(prev => ({
                                      ...prev,
                                      features: {
                                        ...prev.features,
                                        catalog: { ...prev.features.catalog, items: updated },
                                      },
                                    }));
                                  }}
                                  placeholder="Item title..."
                                  className="flex-1 text-xs bg-transparent text-main border-0 focus:outline-none focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-0.5"
                                />
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => moveCatalogItem(idx, -1)}
                                    disabled={idx === 0}
                                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-main disabled:opacity-30 rounded"
                                    aria-label={`Move item ${idx + 1} up`}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveCatalogItem(idx, 1)}
                                    disabled={idx === (formData.features.catalog.items?.length || 0) - 1}
                                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-main disabled:opacity-30 rounded"
                                    aria-label={`Move item ${idx + 1} down`}
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeCatalogItem(idx)}
                                    className="w-6 h-6 flex items-center justify-center text-rose-500 hover:text-rose-700 rounded"
                                    aria-label={`Remove item ${idx + 1}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {item.description && (
                                <div className="pl-6 text-2xs text-sub truncate">
                                  {item.description}
                                </div>
                              )}
                              {item.url && (
                                <div className="pl-6 text-2xs text-muted truncate">
                                  Link: {item.url}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Add new catalog item */}
                        <div className="p-2.5 rounded-lg bg-surface-subtle border border-dashed border-subtle space-y-2">
                          <span className="block text-2xs font-semibold text-main">Add New Catalog Item</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={newCatalogItemTitle}
                              onChange={(e) => setNewCatalogItemTitle(e.target.value)}
                              placeholder="Item title or discourse name *"
                              className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                            />
                            <input
                              type="text"
                              value={newCatalogItemUrl}
                              onChange={(e) => setNewCatalogItemUrl(e.target.value)}
                              placeholder="Audio / video link (optional)"
                              className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                            />
                            <input
                              type="text"
                              value={newCatalogItemDesc}
                              onChange={(e) => setNewCatalogItemDesc(e.target.value)}
                              placeholder="Brief description or focus area (optional)"
                              className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main sm:col-span-2"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={addCatalogItem}
                              disabled={!newCatalogItemTitle.trim()}
                              className="px-3 py-1.5 bg-teal-700 dark:bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Item</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="text-2xs text-muted">
                        <strong>Note:</strong> Multi-Item Catalog is mutually exclusive with Progressive Day Schedule.
                      </p>
                    </div>
                  )}
                </div>

                {/* 6. Day Schedule Slot */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  formData.features.daySchedule.enabled
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                    : 'bg-surface border-subtle'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-main block">Progressive Day Schedule</span>
                        <span className="text-2xs text-muted block">Multi-week conditioning plan with day variations</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeatureSlot('daySchedule')}
                      className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
                        formData.features.daySchedule.enabled
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted'
                      }`}
                    >
                      {formData.features.daySchedule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {formData.features.daySchedule.enabled && (
                    <div className="mt-3 pt-3 border-t border-rose-200/60 dark:border-rose-900/40 space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-2xs font-semibold text-main mb-1">Plan Title *</label>
                          <input
                            type="text"
                            value={formData.features.daySchedule.planTitle}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              features: {
                                ...prev.features,
                                daySchedule: { ...prev.features.daySchedule, planTitle: e.target.value },
                              },
                            }))}
                            placeholder="e.g. 12-Week Progressive Movement Plan"
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                          />
                          {errors.dayScheduleTitle && (
                            <p className="text-rose-500 text-2xs mt-0.5">{errors.dayScheduleTitle}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-2xs font-semibold text-main mb-1">Total Duration</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="52"
                              value={formData.features.daySchedule.totalWeeks || 12}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                features: {
                                  ...prev.features,
                                  daySchedule: { ...prev.features.daySchedule, totalWeeks: parseInt(e.target.value, 10) || 12 },
                                },
                              }))}
                              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                            />
                            <span className="text-2xs text-muted flex-shrink-0">Weeks</span>
                          </div>
                        </div>
                      </div>

                      {/* Presets & Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-2xs font-semibold text-main">Weekday Variations</span>
                        <button
                          type="button"
                          onClick={handleLoad12WeekMovementDefaults}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg bg-rose-100/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-200/80 transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>Reset 12-Week Defaults</span>
                        </button>
                      </div>

                      {/* Weekday Selector Tabs */}
                      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                        {DAYS.map(day => {
                          const variation = formData.features.daySchedule.dayVariations?.[day] || {};
                          const isSelected = selectedDayScheduleWeekday === day;
                          const isRest = variation.type === 'rest' || day === 'Sun';
                          const isWalk = variation.type === 'walk';
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleSelectDayScheduleWeekday(day)}
                              className={`h-11 min-h-[44px] flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all relative ${
                                isSelected
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-surface border border-subtle text-slate-700 dark:text-slate-300 hover:bg-surface-subtle'
                              }`}
                            >
                              <span>{day}</span>
                              <span className={`text-[9px] font-medium leading-none mt-0.5 ${
                                isSelected
                                  ? 'text-rose-100'
                                  : isRest
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isWalk
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {isRest ? 'Rest' : isWalk ? 'Walk' : 'Wkout'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Day Detail & Exercises Configuration */}
                      {(() => {
                        const activeDay = selectedDayScheduleWeekday;
                        const activeVar = formData.features.daySchedule.dayVariations?.[activeDay] || { type: 'workout', label: '', target: '', exercises: [] };
                        const exercises = activeVar.exercises || [];
                        const isRest = activeVar.type === 'rest';

                        return (
                          <div className="p-3 bg-surface rounded-xl border border-subtle space-y-3">
                            {/* Day Meta Header */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-2xs font-semibold text-main mb-1">{activeDay} Type</label>
                                <select
                                  value={activeVar.type || 'workout'}
                                  onChange={(e) => handleChangeDayVariationType(activeDay, e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                                >
                                  <option value="workout">Workout / Strength</option>
                                  <option value="walk">Easy Walk & Stretches</option>
                                  <option value="rest">Planned Rest Day</option>
                                  <option value="custom">Custom Routine</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-2xs font-semibold text-main mb-1">Routine Label</label>
                                <input
                                  type="text"
                                  value={activeVar.label || ''}
                                  onChange={(e) => handleUpdateDayVariationMeta(activeDay, 'label', e.target.value)}
                                  placeholder="e.g. Strength & Posture"
                                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                                />
                              </div>
                              <div>
                                <label className="block text-2xs font-semibold text-main mb-1">Target / Duration</label>
                                <input
                                  type="text"
                                  value={activeVar.target || ''}
                                  onChange={(e) => handleUpdateDayVariationMeta(activeDay, 'target', e.target.value)}
                                  placeholder="e.g. About 30 minutes"
                                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                                />
                              </div>
                            </div>

                            {/* Exercises / Checklist for this day */}
                            {isRest ? (
                              <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-900/60 text-2xs text-teal-800 dark:text-teal-200">
                                <strong>Rest & Recovery Day:</strong> No daily exercises or workouts required. This day automatically preserves consistency and will never break streaks.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-2xs font-semibold text-main">
                                  <span>{activeDay} Exercises & Steps ({exercises.length})</span>
                                  <span className="text-muted">Required items gate completion</span>
                                </div>

                                {/* List of exercises */}
                                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                  {exercises.map((ex, idx) => {
                                    const isRequired = ex.isRequired !== false && ex.isRequiredForCompletion !== false;
                                    const hasError = errors[`daySchedule_${activeDay}_${idx}`];
                                    return (
                                      <div
                                        key={ex.id || idx}
                                        className={`p-2 rounded-lg bg-surface border space-y-1.5 text-xs ${
                                          hasError ? 'border-rose-400 bg-rose-50/20' : 'border-subtle'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-2xs font-bold text-muted w-4 text-center select-none flex-shrink-0">
                                            {idx + 1}.
                                          </span>
                                          <input
                                            type="text"
                                            value={ex.name || ex.label || ''}
                                            onChange={(e) => handleUpdateDayScheduleExercise(activeDay, idx, 'name', e.target.value)}
                                            placeholder="Exercise or step name *"
                                            className={`flex-1 min-w-0 px-2 py-1 border rounded text-xs bg-surface text-main ${
                                              hasError ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                          />
                                          <input
                                            type="text"
                                            value={ex.target || ex.reps || ''}
                                            onChange={(e) => handleUpdateDayScheduleExercise(activeDay, idx, 'target', e.target.value)}
                                            placeholder="Target / reps"
                                            className="w-24 sm:w-32 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs bg-surface text-main"
                                          />

                                          {/* Required / Optional Toggle */}
                                          <button
                                            type="button"
                                            onClick={() => handleToggleDayScheduleExerciseRequired(activeDay, idx)}
                                            className={`px-2 py-1 rounded text-2xs font-semibold transition-colors flex-shrink-0 min-h-[32px] ${
                                              isRequired
                                                ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                            }`}
                                            title="Toggle Required / Optional for habit completion"
                                          >
                                            {isRequired ? 'Required' : 'Optional'}
                                          </button>

                                          {/* Reorder Buttons */}
                                          <div className="flex items-center gap-0.5 flex-shrink-0">
                                            <button
                                              type="button"
                                              disabled={idx === 0}
                                              onClick={() => handleMoveDayScheduleExercise(activeDay, idx, -1)}
                                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
                                              title="Move up"
                                            >
                                              <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={idx === exercises.length - 1}
                                              onClick={() => handleMoveDayScheduleExercise(activeDay, idx, 1)}
                                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
                                              title="Move down"
                                            >
                                              <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          {/* Remove Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveDayScheduleExercise(activeDay, idx)}
                                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex-shrink-0"
                                            title="Remove exercise"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        {hasError && (
                                          <p className="text-rose-500 text-2xs pl-6">{hasError}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Add new exercise row */}
                                <div className="pt-2 border-t border-subtle/80 space-y-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                    <div className="sm:col-span-6">
                                      <input
                                        type="text"
                                        value={newDayExerciseName}
                                        onChange={(e) => setNewDayExerciseName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddDayScheduleExercise(activeDay);
                                          }
                                        }}
                                        placeholder="New exercise or step name *"
                                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                                      />
                                    </div>
                                    <div className="sm:col-span-4">
                                      <input
                                        type="text"
                                        value={newDayExerciseTarget}
                                        onChange={(e) => setNewDayExerciseTarget(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddDayScheduleExercise(activeDay);
                                          }
                                        }}
                                        placeholder="Target (e.g. 10 reps, 20m)"
                                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
                                      />
                                    </div>
                                    <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleAddDayScheduleExercise(activeDay)}
                                        disabled={!newDayExerciseName.trim()}
                                        className="w-full min-h-[34px] px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1 transition-colors"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add</span>
                                      </button>
                                    </div>
                                  </div>
                                  <label className="flex items-center gap-1.5 text-2xs text-muted cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={newDayExerciseRequired}
                                      onChange={(e) => setNewDayExerciseRequired(e.target.checked)}
                                      className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                                    />
                                    <span>Mark as required for day completion</span>
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <p className="text-2xs text-muted">
                        Structured weekday-specific routines with integrated Sunday rest day support. Mutually exclusive with Multi-Item Catalog.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Modal Action Bar */}
          <div className="bg-surface border-t border-subtle px-5 py-2 flex items-center gap-3 flex-shrink-0 z-10">
            {habit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(habit.id)}
                className="px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-teal-700 dark:bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-800 dark:hover:bg-teal-500 transition-colors disabled:opacity-50 shadow-2xs"
            >
              {saving ? 'Saving...' : habit ? 'Update Routine' : 'Create Routine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}