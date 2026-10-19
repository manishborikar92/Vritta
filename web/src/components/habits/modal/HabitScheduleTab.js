'use client';

import { Info } from 'lucide-react';

/**
 * HabitScheduleTab — Tab 2: Timing preference and active weekdays.
 */
export function HabitScheduleTab({
  formData,
  setFormData,
  errors,
  timingTypes,
  weekdays,
  toggleDay,
}) {
  return (
    <div className="space-y-4">
      {/* Timing Preference Model (Compact 2x2 Responsive Architecture) */}
      <div className="p-3 sm:p-3.5 bg-surface-subtle dark:bg-slate-800/40 rounded-xl border border-subtle dark:border-slate-700/80 space-y-2.5">
        <div>
          <label className="block text-xs font-semibold text-main mb-1.5">
            Timing Preference (Soft Target, Not a Deadline)
          </label>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {timingTypes.map(t => {
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
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-surface text-main placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
          {weekdays.map(day => (
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
      </div>
    </div>
  );
}
