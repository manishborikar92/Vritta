'use client';

import { Layers, BookOpen, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';

/**
 * CatalogSlotEditor — Multi-Item Catalog feature slot configuration editor.
 */
export function CatalogSlotEditor({
  feature,
  onToggle,
  setFormData,
  errors,
  loadOshoPreset,
  moveCatalogItem,
  removeCatalogItem,
  newCatalogItemTitle,
  setNewCatalogItemTitle,
  newCatalogItemUrl,
  setNewCatalogItemUrl,
  newCatalogItemDesc,
  setNewCatalogItemDesc,
  addCatalogItem,
}) {
  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      feature.enabled
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
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
            feature.enabled
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-muted'
          }`}
        >
          {feature.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {feature.enabled && (
        <div className="mt-3 pt-3 border-t border-sky-200/60 dark:border-sky-900/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-2xs font-semibold text-main mb-1">Catalog Title</label>
              <input
                type="text"
                value={feature.catalogTitle}
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
            <div className="flex-shrink-0 sm:pt-4">
              <button
                type="button"
                onClick={loadOshoPreset}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-200 border border-amber-300 dark:border-amber-700/60 rounded-lg text-2xs font-semibold flex items-center justify-center gap-1 transition-colors"
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
              <span>Catalog Items ({feature.items?.length || 0})</span>
              <span className="text-muted">Interactive curriculum items</span>
            </div>

            {errors.catalogItems && (
              <p className="text-2xs text-rose-500 font-semibold">{errors.catalogItems}</p>
            )}

            {/* Existing items list */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(feature.items || []).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-2 sm:p-2.5 rounded-lg bg-surface border border-subtle space-y-1.5 text-xs"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-2xs font-bold text-slate-400 w-4 text-center select-none flex-shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={item.title || item.label || ''}
                      onChange={(e) => {
                        const updated = [...(feature.items || [])];
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
                      className="min-w-0 flex-1 text-xs bg-surface-subtle text-main border border-subtle focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 rounded-lg px-2.5 py-1.5"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="flex items-center border border-subtle bg-surface rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => moveCatalogItem(idx, -1)}
                          disabled={idx === 0}
                          className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-slate-400 hover:text-main disabled:opacity-30 rounded hover:bg-surface-subtle transition-colors"
                          aria-label={`Move item ${idx + 1} up`}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCatalogItem(idx, 1)}
                          disabled={idx === (feature.items?.length || 0) - 1}
                          className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-slate-400 hover:text-main disabled:opacity-30 rounded hover:bg-surface-subtle transition-colors"
                          aria-label={`Move item ${idx + 1} down`}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCatalogItem(idx)}
                        className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-subtle rounded-md transition-colors ml-0.5"
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
                  className="px-3 py-1.5 bg-teal-700 dark:bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
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
  );
}
