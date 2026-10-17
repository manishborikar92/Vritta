'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Clock,
  CheckSquare,
  Timer,
  Hash,
  FileText,
  Layers,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { CATEGORIES, getCategoryConfig } from '@/lib/constants/categories';
import { fetchScheduleTemplates } from '@/lib/firebase/firestore';

const APPROVED_FEATURE_FILTERS = [
  { id: 'all', label: 'All Features' },
  { id: 'counter', label: 'Counter', icon: Hash },
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'checklist', label: 'Checklist', icon: CheckSquare },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'catalog', label: 'Catalog', icon: BookOpen },
  { id: 'daySchedule', label: 'Day Schedule', icon: Calendar },
];

/**
 * TemplateBrowserModal — Unified Schedule Blueprint Browser & Preview.
 *
 * Designed to strictly match HabitModal conventions:
 * - Identical container, header, typography, radii, border tokens, and action bar styling.
 * - Mobile bottom-sheet layout (rounded-t-3xl on <640px) and centered dialog (sm:rounded-2xl sm:max-w-2xl).
 * - Direct browsing of authoritative scheduleTemplates collection.
 * - Category and feature slot filtering with responsive search bar.
 * - Full template preview mode showing complete routine instructions and feature breakdowns.
 * - Pre-populates HabitModal for customization and saving to user habits.
 * - WCAG 2.2 touch targets (min 44x44px) and responsive design (320px to 1280px).
 */
export default function TemplateBrowserModal({ isOpen, onClose, onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFeature, setSelectedFeature] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadTemplates() {
      setLoading(true);
      try {
        const data = await fetchScheduleTemplates();
        if (isMounted) {
          setTemplates(data || []);
        }
      } catch (err) {
        console.error('Failed to load schedule templates:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTemplates();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewTemplate) {
          setPreviewTemplate(null);
        } else {
          onClose?.();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewTemplate, onClose]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Category filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }

      // Feature filter
      if (selectedFeature !== 'all') {
        const f = t.features || {};
        if (!f[selectedFeature]?.enabled) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchCat = t.category?.toLowerCase().includes(q);
        const matchTags = Array.isArray(t.metadata?.tags) && t.metadata.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchCat && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }, [templates, selectedCategory, selectedFeature, searchQuery]);

  if (!isOpen) return null;

  const handleUseTemplate = (template) => {
    // Clone template and prepare as an unsaved user habit
    const routineData = {
      title: template.title || '',
      category: template.category || 'Health & Fitness',
      description: template.description || '',
      instructions: template.instructions || template.description || '',
      schedule: {
        frequency: Array.isArray(template.schedule?.frequency) ? [...template.schedule.frequency] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        timingType: template.schedule?.timingType || 'anytime',
        preferredPeriod: template.schedule?.preferredPeriod || 'Morning',
        relativeTiming: template.schedule?.relativeTiming || null,
        exactTime: template.schedule?.exactTime || null,
        restDays: Array.isArray(template.schedule?.restDays) ? [...template.schedule.restDays] : [],
        order: template.schedule?.order || 1,
      },
      features: {
        counter: template.features?.counter ? { ...template.features.counter } : { enabled: false },
        timer: template.features?.timer ? { ...template.features.timer } : { enabled: false },
        checklist: template.features?.checklist
          ? { enabled: Boolean(template.features.checklist.enabled), items: Array.isArray(template.features.checklist.items) ? [...template.features.checklist.items] : [] }
          : { enabled: false, items: [] },
        notes: template.features?.notes ? { ...template.features.notes } : { enabled: false },
        catalog: template.features?.catalog ? { ...template.features.catalog } : { enabled: false },
        daySchedule: template.features?.daySchedule ? { ...template.features.daySchedule } : { enabled: false },
      },
      metadata: template.metadata ? { ...template.metadata } : {},
      seedOrigin: 'template',
      templateReference: template.id,
      id: null, // Zero ID ensures new unique document is created under user's UID
    };

    onSelectTemplate?.(routineData);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-browser-title"
    >
      <div
        className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-xl sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl border-t sm:border border-subtle overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Identical structure & hierarchy to HabitModal */}
        <div className="bg-surface border-b border-subtle px-5 py-3.5 sm:py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div>
            <h2 id="template-browser-title" className="text-base sm:text-lg font-bold text-main leading-tight">
              {previewTemplate ? 'Blueprint Preview' : 'Schedule Blueprints'}
            </h2>
            <p className="text-2xs text-sub">
              {previewTemplate
                ? 'Review routine structure and customize for your rhythm'
                : 'Choose a proven blueprint to customize for your daily schedule'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (previewTemplate) {
                  setPreviewTemplate(null);
                } else {
                  onClose?.();
                }
              }}
              type="button"
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {previewTemplate ? (
          /* ==================================================================== */
          /* Detail Preview View                                                  */
          /* ==================================================================== */
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Template Identity Card */}
            <div className="p-4 rounded-xl border border-subtle bg-surface space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-2xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    getCategoryConfig(previewTemplate.category).badgeClasses
                  }`}
                >
                  {previewTemplate.category}
                </span>
                {previewTemplate.metadata?.difficulty && (
                  <span className="text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium">
                    {previewTemplate.metadata.difficulty}
                  </span>
                )}
                {previewTemplate.metadata?.estimatedMinutes && (
                  <span className="text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{previewTemplate.metadata.estimatedMinutes} min</span>
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-main leading-snug">{previewTemplate.title}</h3>
              <p className="text-xs text-sub leading-relaxed">{previewTemplate.description}</p>
            </div>

            {/* Instructions Section */}
            {previewTemplate.instructions && (
              <div className="p-4 rounded-xl bg-surface-subtle/80 border border-subtle space-y-1.5">
                <h4 className="text-2xs font-bold uppercase tracking-wider text-main">Observance Guidance</h4>
                <div className="text-xs text-sub whitespace-pre-line leading-relaxed font-normal">
                  {previewTemplate.instructions}
                </div>
              </div>
            )}

            {/* Schedule Details */}
            <div className="p-4 rounded-xl bg-surface-subtle/80 border border-subtle space-y-2">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-main">Schedule Rhythm</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted font-medium">Frequency: </span>
                  <span className="text-main font-semibold">
                    {previewTemplate.schedule?.frequency?.length === 7
                      ? 'Every day (7 days)'
                      : previewTemplate.schedule?.frequency?.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-muted font-medium">Timing: </span>
                  <span className="text-main font-semibold">
                    {previewTemplate.schedule?.preferredPeriod ||
                      previewTemplate.schedule?.relativeTiming ||
                      previewTemplate.schedule?.exactTime ||
                      'Flexible / Anytime'}
                  </span>
                </div>
              </div>
            </div>

            {/* Enabled Feature Slots */}
            <div className="space-y-2.5">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-main px-0.5">Configured Feature Slots</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Counter */}
                {previewTemplate.features?.counter?.enabled && (
                  <div className="p-3 rounded-xl border border-subtle bg-surface space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                      <Hash className="w-3.5 h-3.5" />
                      <span>Counter Slot</span>
                    </div>
                    <p className="text-xs text-sub">
                      Target: <strong className="text-main">{previewTemplate.features.counter.targetCount}</strong> {previewTemplate.features.counter.unit}
                    </p>
                  </div>
                )}

                {/* Timer */}
                {previewTemplate.features?.timer?.enabled && (
                  <div className="p-3 rounded-xl border border-subtle bg-surface space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                      <Timer className="w-3.5 h-3.5" />
                      <span>Timer Slot</span>
                    </div>
                    <p className="text-xs text-sub">
                      Target: <strong className="text-main">{previewTemplate.features.timer.targetDurationMinutes}m</strong> ({previewTemplate.features.timer.mode || 'countdown'})
                    </p>
                  </div>
                )}

                {/* Checklist */}
                {previewTemplate.features?.checklist?.enabled && (
                  <div className="p-3 rounded-xl border border-subtle bg-surface space-y-1.5 sm:col-span-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Checklist Steps ({previewTemplate.features.checklist.items?.length || 0})</span>
                    </div>
                    <ul className="space-y-1 pl-1">
                      {previewTemplate.features.checklist.items?.map((item, idx) => (
                        <li key={item.id || idx} className="text-2xs text-sub flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 mt-1.5 shrink-0" />
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {previewTemplate.features?.notes?.enabled && (
                  <div className="p-3 rounded-xl border border-subtle bg-surface space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Notes & Reflection</span>
                    </div>
                    <p className="text-xs text-sub">
                      {previewTemplate.features.notes.isPrivateDiary ? 'Private diary format with prompts' : 'Freeform reflection notes'}
                    </p>
                  </div>
                )}

                {/* Catalog */}
                {previewTemplate.features?.catalog?.enabled && (
                  <div className="p-3 rounded-xl border border-subtle bg-surface space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Multi-Item Catalog</span>
                    </div>
                    <p className="text-xs text-sub">
                      Catalog: <strong className="text-main">{previewTemplate.features.catalog.catalogTitle}</strong> ({previewTemplate.features.catalog.totalItems || previewTemplate.features.catalog.items?.length || 0} items)
                    </p>
                  </div>
                )}

                {/* Day Schedule */}
                {previewTemplate.features?.daySchedule?.enabled && (
                  <div className="p-3 rounded-xl border border-subtle bg-surface space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Progressive Day Schedule</span>
                    </div>
                    <p className="text-xs text-sub">
                      Plan: <strong className="text-main">{previewTemplate.features.daySchedule.planTitle || 'Progressive Movement'}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* Blueprint Catalog List View                                          */
          /* ==================================================================== */
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Search & Filter Bar */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blueprints by title, description, or tags..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface-subtle/80 border border-subtle text-xs text-main placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-teal-600 min-h-[40px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main text-xs p-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Pills (Horizontally Scrollable) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 min-h-[34px] ${
                    selectedCategory === 'all'
                      ? 'bg-teal-700 dark:bg-teal-600 text-white shadow-2xs'
                      : 'bg-surface-subtle border border-subtle text-sub hover:text-main'
                  }`}
                >
                  All Categories
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 min-h-[34px] ${
                      selectedCategory === cat
                        ? 'bg-teal-700 dark:bg-teal-600 text-white shadow-2xs'
                        : 'bg-surface-subtle border border-subtle text-sub hover:text-main'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Feature Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-2xs">
                <span className="text-muted font-medium shrink-0 mr-1">Feature:</span>
                {APPROVED_FEATURE_FILTERS.map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFeature(f.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors shrink-0 min-h-[34px] ${
                        selectedFeature === f.id
                          ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-stone-900 font-semibold shadow-2xs'
                          : 'bg-surface-subtle border border-subtle text-sub hover:text-main'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />}
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Template Count Header */}
            <div className="flex items-center justify-between text-2xs text-sub px-0.5 pt-0.5">
              <span>
                Showing <strong>{filteredTemplates.length}</strong> of {templates.length} blueprints
              </span>
              {(selectedCategory !== 'all' || selectedFeature !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedFeature('all');
                    setSearchQuery('');
                  }}
                  className="text-teal-700 dark:text-teal-400 hover:underline font-semibold"
                >
                  Reset filters
                </button>
              )}
            </div>

            {/* Template Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-40 rounded-xl bg-surface-subtle animate-pulse border border-subtle" />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12 px-4 bg-surface-subtle/50 rounded-xl border border-dashed border-subtle space-y-2">
                <p className="text-sm font-bold text-main">No blueprints match your filters</p>
                <p className="text-xs text-sub">Try selecting another life area or clearing your search query.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedFeature('all');
                    setSearchQuery('');
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredTemplates.map((template) => {
                  const catConfig = getCategoryConfig(template.category);
                  const f = template.features || {};

                  return (
                    <div
                      key={template.id}
                      className="rounded-xl border border-subtle bg-surface hover:border-teal-500/50 hover:shadow-xs transition-all flex flex-col justify-between p-3.5 space-y-2.5"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold border ${catConfig.badgeClasses}`}>
                            {catConfig.label || template.category}
                          </span>
                          {template.metadata?.isFoundation && (
                            <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                              Foundation
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-main leading-snug">{template.title}</h3>
                          <p className="text-xs text-sub mt-1 line-clamp-2 leading-relaxed">{template.description}</p>
                        </div>

                        {/* Feature Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {f.counter?.enabled && (
                            <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium">
                              <Hash className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span>{f.counter.targetCount} {f.counter.unit}</span>
                            </span>
                          )}
                          {f.timer?.enabled && (
                            <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium">
                              <Timer className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span>{f.timer.targetDurationMinutes}m</span>
                            </span>
                          )}
                          {f.checklist?.enabled && (
                            <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium">
                              <CheckSquare className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span>{f.checklist.items?.length || 0} steps</span>
                            </span>
                          )}
                          {f.notes?.enabled && (
                            <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium">
                              <FileText className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span>Notes</span>
                            </span>
                          )}
                          {f.catalog?.enabled && (
                            <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium">
                              <BookOpen className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span>Catalog</span>
                            </span>
                          )}
                          {f.daySchedule?.enabled && (
                            <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md bg-surface-subtle border border-subtle text-sub font-medium">
                              <Calendar className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span>Schedule</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-subtle">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(template)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-sub hover:text-main hover:bg-surface-subtle rounded-lg transition-colors min-h-[38px]"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseTemplate(template)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 dark:bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 dark:hover:bg-teal-500 transition-colors shadow-2xs min-h-[38px]"
                        >
                          <span>Use Template</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sticky Action Bar — Matching HabitModal footer convention */}
        <div className="bg-surface border-t border-subtle px-5 py-2.5 flex items-center justify-between flex-shrink-0 z-10">
          {previewTemplate ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 min-h-[40px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => handleUseTemplate(previewTemplate)}
                className="px-5 py-2 bg-teal-700 dark:bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-800 dark:hover:bg-teal-500 transition-colors shadow-2xs inline-flex items-center gap-1.5 min-h-[40px]"
              >
                <span>Use This Template</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-2xs text-muted">
                Blueprints create a customized personal routine in your daily rhythm.
              </span>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium transition-colors min-h-[40px]"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
