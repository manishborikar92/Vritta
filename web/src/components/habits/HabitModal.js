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
import { WEEKDAYS, APPROVED_FEATURE_SLOTS, validateComposableHabit } from '@/domain';
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
import { HabitDetailsTab, HabitScheduleTab, HabitFeaturesTab } from './modal';

/**
 * Six approved composable feature slots:
 * - Counter Stepper
 * - Duration Timer
 * - Step-by-Step Checklist
 * - Notes & Reflection
 * - Multi-Item Catalog
 * - Progressive Day Schedule
 */

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

export const SPECIALIZED_COMPLETION_STYLES = {
  workbook_sessions: { label: 'Specialized: Two-Session Workbook Counter', description: 'Word Power Made Easy 2-session tracker' },
  exercise_plan: { label: 'Specialized: Structured Movement Plan', description: '12-week progressive movement schedule' },
  osho_listening: { label: 'Specialized: Discourse Listening Session', description: '30-discourse audio library catalog' },
  reading_duration: { label: 'Specialized: Reading Duration Target', description: 'Configurable reading timer session' },
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
    stableKey: null,
    seedOrigin: habit?.seedOrigin || 'custom',
    features: {
      counter: { enabled: false, targetCount: 2, unit: 'sessions', step: 1, minCount: 0 },
      timer: { enabled: false, targetDurationMinutes: 30, mode: 'countdown' },
      checklist: { enabled: false, items: [] },
      notes: { enabled: false, placeholder: '', reflectionPrompts: [] },
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
        timer: { enabled: false, targetDurationMinutes: 30, mode: 'countdown' },
        checklist: { enabled: false, items: [] },
        notes: { enabled: false, placeholder: '', reflectionPrompts: [] },
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
          features.timer = { enabled: true, targetDurationMinutes: getReadingTargetMinutes(habit), mode: 'countdown' };
        } else if (cm === 'notes') {
          features.notes = {
            enabled: true,
            reflectionPrompts: habit.metadata?.reflectivePrompts || habit.metadata?.reflectionPrompts || [],
            placeholder: habit.features?.notes?.placeholder || '',
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
          features.timer = { enabled: false, targetDurationMinutes: habit.targetMinutes || 30, mode: 'countdown' };
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
    };

    // Derive canonical completionMethod from active composable features for document schema and analytics consistency
    let derivedCompletionMethod = formData.completionMethod || 'simple';
    if (cleanFeatures.counter.enabled && cleanFeatures.checklist.enabled) {
      derivedCompletionMethod = 'workbook_sessions';
    } else if (cleanFeatures.daySchedule.enabled) {
      derivedCompletionMethod = 'exercise_plan';
    } else if (cleanFeatures.catalog.enabled) {
      if (cleanFeatures.catalog.catalogId === 'osho_discourses' || formData.stableKey === 'canonical_listen_osho' || formData.title?.toLowerCase().includes('osho')) {
        derivedCompletionMethod = 'osho_listening';
      } else {
        derivedCompletionMethod = 'catalog';
      }
    } else if (cleanFeatures.timer.enabled) {
      derivedCompletionMethod = 'reading_duration';
    } else if (cleanFeatures.checklist.enabled) {
      derivedCompletionMethod = 'checklist';
    } else {
      derivedCompletionMethod = 'simple';
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
      completionMethod: derivedCompletionMethod,
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
            onClick={() => setActiveTab('schedule')}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'schedule'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            Schedule
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
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* TAB 1: BASIC DETAILS */}
            {activeTab === 'details' && (
              <HabitDetailsTab
                formData={formData}
                setFormData={setFormData}
                errors={errors}
              />
            )}

            {/* TAB 2: SCHEDULE */}
            {activeTab === 'schedule' && (
              <HabitScheduleTab
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                timingTypes={TIMING_TYPES}
                weekdays={DAYS}
                toggleDay={toggleDay}
              />
            )}

            {/* TAB 3: COMPOSABLE FEATURE SLOTS */}
            {activeTab === 'features' && (
              <HabitFeaturesTab
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                toggleFeatureSlot={toggleFeatureSlot}
                updateChecklistItemLabel={updateChecklistItemLabel}
                moveChecklistItem={moveChecklistItem}
                removeChecklistItem={removeChecklistItem}
                newChecklistItem={newChecklistItem}
                setNewChecklistItem={setNewChecklistItem}
                addChecklistItem={addChecklistItem}
                newPromptChip={newPromptChip}
                setNewPromptChip={setNewPromptChip}
                addPromptChip={addPromptChip}
                removePromptChip={removePromptChip}
                loadOshoPreset={loadOshoPreset}
                moveCatalogItem={moveCatalogItem}
                removeCatalogItem={removeCatalogItem}
                newCatalogItemTitle={newCatalogItemTitle}
                setNewCatalogItemTitle={setNewCatalogItemTitle}
                newCatalogItemUrl={newCatalogItemUrl}
                setNewCatalogItemUrl={setNewCatalogItemUrl}
                newCatalogItemDesc={newCatalogItemDesc}
                setNewCatalogItemDesc={setNewCatalogItemDesc}
                addCatalogItem={addCatalogItem}
                days={DAYS}
                selectedDayScheduleWeekday={selectedDayScheduleWeekday}
                handleSelectDayScheduleWeekday={handleSelectDayScheduleWeekday}
                handleChangeDayVariationType={handleChangeDayVariationType}
                handleUpdateDayVariationMeta={handleUpdateDayVariationMeta}
                handleUpdateDayScheduleExercise={handleUpdateDayScheduleExercise}
                handleToggleDayScheduleExerciseRequired={handleToggleDayScheduleExerciseRequired}
                handleRemoveDayScheduleExercise={handleRemoveDayScheduleExercise}
                handleMoveDayScheduleExercise={handleMoveDayScheduleExercise}
                handleLoad12WeekMovementDefaults={handleLoad12WeekMovementDefaults}
                newDayExerciseName={newDayExerciseName}
                setNewDayExerciseName={setNewDayExerciseName}
                newDayExerciseTarget={newDayExerciseTarget}
                setNewDayExerciseTarget={setNewDayExerciseTarget}
                newDayExerciseRequired={newDayExerciseRequired}
                setNewDayExerciseRequired={setNewDayExerciseRequired}
                handleAddDayScheduleExercise={handleAddDayScheduleExercise}
              />
            )}
          </div>

          {/* Sticky Modal Action Bar */}
          <div className="bg-surface border-t border-subtle px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 flex-shrink-0 z-10">
            {habit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(habit.id)}
                className="min-h-[40px] sm:min-h-[36px] px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] sm:min-h-[36px] px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] sm:min-h-[36px] px-5 py-2 bg-teal-700 dark:bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-800 dark:hover:bg-teal-500 transition-colors disabled:opacity-50 shadow-2xs"
            >
              {saving ? 'Saving...' : habit ? 'Update Routine' : 'Create Routine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}