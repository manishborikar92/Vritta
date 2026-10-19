'use client';

import { useState, memo } from 'react';
import { Headphones, BookOpen, Layers, ExternalLink, Check } from 'lucide-react';
import { OSHO_LIBRARY } from '@/lib/fixtures/osho-library';
import OshoLibraryModal from '../OshoLibraryModal';

/**
 * SlotCatalog — Universal catalog & curriculum listening slot.
 *
 * Configured via `habit.features.catalog`:
 * - `catalogId`: Identifier (e.g., 'osho_discourses')
 * - `catalogTitle`: Title (e.g., 'Osho Discourse Audio Library')
 * - `items`: Optional custom catalog items array
 *
 * Irrevocably preserves:
 * - Osho listening disclosure: "Daily listening for awareness & self-inquiry • Series progress is separate"
 * - Action button: "Explore All 30 Discourse Titles & Links"
 * - Full Osho audio library modal and independent series progression.
 */
function SlotCatalog({
  feature = {},
  habit = {},
  progress = {},
  onChange,
  userProfile = {},
  onUpdateProfile,
  disabled = false,
}) {
  const [showModal, setShowModal] = useState(false);

  const isOshoCatalog = feature.catalogId === 'osho_discourses' ||
    habit.stableKey === 'canonical_listen_osho' ||
    habit.id?.includes('canonical_listen_osho') ||
    (feature.catalogId !== 'custom_catalog' && habit.title?.toLowerCase().includes('osho'));

  // If Osho catalog, synchronize with profile state
  const activeSeriesId = userProfile?.activeOshoSeriesId || 'osho_01';
  const activeSeries = OSHO_LIBRARY.find(s => s.id === activeSeriesId) || OSHO_LIBRARY[0];
  const seriesProgress = userProfile?.oshoSeriesProgress || {};
  const currentSeriesProgress = seriesProgress[activeSeriesId] || { completedTalks: 0 };

  const handleSelectSeries = (seriesId) => {
    onUpdateProfile?.({
      activeOshoSeriesId: seriesId,
    });
  };

  const handleUpdateTalkProgress = (seriesId, completedTalks) => {
    const updated = {
      ...seriesProgress,
      [seriesId]: {
        ...(seriesProgress[seriesId] || {}),
        completedTalks,
        lastUpdated: new Date().toISOString(),
      },
    };
    onUpdateProfile?.({
      oshoSeriesProgress: updated,
    });
  };

  if (!isOshoCatalog) {
    // Generic Catalog interactive view
    const items = Array.isArray(feature.items) ? feature.items : [];
    const completedIds = Array.isArray(progress.completedCatalogItemIds) ? progress.completedCatalogItemIds : [];
    const completedCount = items.filter(item => completedIds.includes(item.id || item.title)).length;

    const handleToggleItem = (itemId, e) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();
      if (disabled) return;
      const isDone = completedIds.includes(itemId);
      const updated = isDone
        ? completedIds.filter(id => id !== itemId)
        : [...completedIds, itemId];
      const allDone = items.length > 0 && items.every(item => updated.includes(item.id || item.title));
      onChange?.({
        ...progress,
        completedCatalogItemIds: updated,
        catalogItemCompleted: allDone,
      });
    };

    return (
      <div className="rounded-xl p-3 sm:p-3.5 bg-surface-subtle/80 dark:bg-stone-900/60 border border-subtle space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-main text-2xs uppercase tracking-tight">
            <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{feature.catalogTitle || 'Curriculum Catalog'}</span>
          </div>
          <span className="text-2xs text-sub font-medium">
            {completedCount} of {items.length} completed
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-2xs text-muted italic">No items configured in catalog.</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {items.map((item, idx) => {
              const itemId = item.id || item.title || `item_${idx}`;
              const isChecked = completedIds.includes(itemId);
              return (
                <div
                  key={itemId}
                  role="checkbox"
                  aria-checked={isChecked}
                  aria-disabled={disabled}
                  tabIndex={disabled ? -1 : 0}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                    disabled ? 'cursor-not-allowed opacity-60 pointer-events-none select-none' : ''
                  } ${
                    isChecked
                      ? 'bg-teal-50/50 dark:bg-teal-950/30 border-teal-200/60 dark:border-teal-800/60'
                      : 'bg-surface border-subtle hover:bg-surface-subtle'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      if (disabled) return;
                      handleToggleItem(itemId, e);
                    }}
                    disabled={disabled}
                    aria-disabled={disabled}
                    tabIndex={disabled ? -1 : 0}
                    className="flex-1 flex items-center gap-2.5 text-left min-h-[44px] py-1 focus-visible:outline-none"
                  >
                    <div
                      className={`w-5 h-5 min-w-[20px] rounded-md border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-teal-600 dark:bg-teal-500 border-teal-600 dark:border-teal-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-surface'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs block leading-tight font-medium ${isChecked ? 'line-through text-muted' : 'text-main'}`}>
                        {item.title || item.label || `Item ${idx + 1}`}
                      </span>
                      {item.description && (
                        <span className="text-2xs text-muted block truncate mt-0.5">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </button>

                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-teal-600 hover:text-teal-700 dark:text-teal-400 rounded-lg hover:bg-surface transition-colors"
                      title="Open external resource"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl p-3 sm:p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 space-y-2.5">
        {/* Attribution & Irrevocable Disclosure */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-2xs uppercase tracking-wider">
            <Headphones className="w-3.5 h-3.5" />
            <span>Daily Listening Catalog</span>
          </div>
          <p className="text-2xs sm:text-xs text-sub leading-relaxed">
            Daily listening for awareness & self-inquiry • Series progress is separate
          </p>
        </div>

        {/* Currently Selected Series Banner (No Title Clipping) */}
        <div className="p-3 bg-surface/90 dark:bg-stone-900/80 rounded-xl border border-amber-200/60 dark:border-amber-800/40 space-y-2">
          {/* Top row of banner: Label + Language on left, Change Series on right */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 max-[400px]:flex-col max-[400px]:items-start max-[400px]:gap-1">
              <span className="text-2xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Active Series
              </span>
              <span className="text-2xs px-1.5 py-0.5 bg-surface rounded border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 font-semibold">
                {activeSeries.language}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={disabled}
              className="px-3 py-1.5 bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Change Series
            </button>
          </div>

          {/* Title row */}
          <div className="space-y-0.5">
            <h4 className="text-xs sm:text-sm font-bold text-main leading-snug">
              {activeSeries.order}. {activeSeries.title}
            </h4>
            <p className="text-2xs text-muted line-clamp-1">
              {activeSeries.theme}
            </p>
          </div>

          {/* Series Progress */}
          <div className="text-xs text-amber-900 dark:text-amber-300 font-semibold pt-0.5">
            Series Progress: Talk {currentSeriesProgress.completedTalks}
            {activeSeries.talkCount ? ` of ${activeSeries.talkCount}` : ' (Ongoing)'}
          </div>
        </div>

        {/* Footer Action: Irrevocable Explore Link */}
        <div className="pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={disabled}
            className="py-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:underline"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Explore All 30 Discourse Titles & Links</span>
          </button>
        </div>
      </div>

      <OshoLibraryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        currentSeriesId={activeSeriesId}
        seriesProgress={seriesProgress}
        onSelectSeries={handleSelectSeries}
        onUpdateTalkProgress={handleUpdateTalkProgress}
      />
    </>
  );
}

export default memo(SlotCatalog);
