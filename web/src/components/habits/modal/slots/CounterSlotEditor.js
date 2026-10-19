'use client';

import { Hash } from 'lucide-react';

/**
 * CounterSlotEditor — Counter Stepper feature slot configuration editor.
 */
export function CounterSlotEditor({ feature, onToggle, setFormData }) {
  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      feature.enabled
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
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
            feature.enabled
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-muted'
          }`}
        >
          {feature.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {feature.enabled && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-2xs font-semibold text-main mb-1">Target Count</label>
            <input
              type="number"
              min="1"
              value={feature.targetCount}
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
              value={feature.unit}
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
  );
}
