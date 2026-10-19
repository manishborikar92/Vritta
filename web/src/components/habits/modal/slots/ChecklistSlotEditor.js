'use client';

import { CheckSquare, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';

/**
 * ChecklistSlotEditor — Step-by-Step Checklist feature slot configuration editor.
 */
export function ChecklistSlotEditor({
  feature,
  checklistItems,
  onToggle,
  updateChecklistItemLabel,
  moveChecklistItem,
  removeChecklistItem,
  newChecklistItem,
  setNewChecklistItem,
  addChecklistItem,
}) {
  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      feature.enabled
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
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
            feature.enabled
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-muted'
          }`}
        >
          {feature.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {feature.enabled && (
        <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40 space-y-2">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {checklistItems.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-2 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <span className="text-2xs font-bold text-slate-400 w-4 text-center select-none flex-shrink-0">
                  {index + 1}.
                </span>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateChecklistItemLabel(index, e.target.value)}
                  className="flex-1 min-w-0 text-xs bg-transparent text-slate-800 dark:text-slate-200 border-0 focus:outline-none focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-1"
                  placeholder="Step description..."
                  aria-label={`Step ${index + 1} description`}
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="flex items-center bg-surface border border-subtle rounded-md">
                    <button
                      type="button"
                      onClick={() => moveChecklistItem(index, -1)}
                      disabled={index === 0}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-l"
                      aria-label={`Move step ${index + 1} up`}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChecklistItem(index, 1)}
                      disabled={index === checklistItems.length - 1}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-r"
                      aria-label={`Move step ${index + 1} down`}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    className="w-6 h-6 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
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
              className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addChecklistItem}
                disabled={!newChecklistItem.trim()}
                className="px-3 py-1.5 bg-teal-700 dark:bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
