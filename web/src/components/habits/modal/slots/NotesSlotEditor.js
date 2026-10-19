'use client';

import { FileText, X, Plus } from 'lucide-react';

/**
 * NotesSlotEditor — Notes & Reflection feature slot configuration editor.
 */
export function NotesSlotEditor({
  feature,
  onToggle,
  setFormData,
  newPromptChip,
  setNewPromptChip,
  addPromptChip,
  removePromptChip,
}) {
  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      feature.enabled
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
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
            feature.enabled
              ? 'bg-teal-700 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-muted'
          }`}
        >
          {feature.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {feature.enabled && (
        <div className="mt-3 pt-3 border-t border-teal-200/60 dark:border-teal-900/40 space-y-2.5">
          <div>
            <label className="block text-2xs font-semibold text-main mb-1">Textarea Placeholder</label>
            <input
              type="text"
              value={feature.placeholder || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                features: {
                  ...prev.features,
                  notes: { ...prev.features.notes, placeholder: e.target.value },
                },
              }))}
              placeholder="e.g., Today's learnings, insights, or gratitude..."
              className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
            />
          </div>

          {/* Reflection Prompt Chips */}
          <div>
            <label className="block text-2xs font-semibold text-main mb-1.5">Guiding Prompt Chips</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(feature.reflectionPrompts || []).map((prompt, idx) => (
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
            <div className="space-y-2">
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
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addPromptChip}
                  disabled={!newPromptChip.trim()}
                  className="px-3 py-1.5 bg-teal-700 dark:bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Chip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
