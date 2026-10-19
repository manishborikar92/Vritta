'use client';

import { Clock } from 'lucide-react';

/**
 * TimerSlotEditor — Duration Timer feature slot configuration editor.
 */
export function TimerSlotEditor({ feature, onToggle, setFormData }) {
  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      feature.enabled
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
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
            feature.enabled
              ? 'bg-teal-700 dark:bg-teal-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-muted'
          }`}
        >
          {feature.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {feature.enabled && (
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
                    feature.targetDurationMinutes === mins
                      ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700'
                      : 'bg-surface border-subtle text-muted hover:text-main'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
