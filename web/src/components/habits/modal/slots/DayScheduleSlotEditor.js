'use client';

import { Calendar, Sparkles, Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react';

/**
 * DayScheduleSlotEditor — Progressive Day Schedule feature slot configuration editor.
 */
export function DayScheduleSlotEditor({
  feature,
  onToggle,
  setFormData,
  errors,
  days,
  selectedDayScheduleWeekday,
  handleSelectDayScheduleWeekday,
  handleChangeDayVariationType,
  handleUpdateDayVariationMeta,
  handleUpdateDayScheduleExercise,
  handleToggleDayScheduleExerciseRequired,
  handleRemoveDayScheduleExercise,
  handleMoveDayScheduleExercise,
  handleLoad12WeekMovementDefaults,
  newDayExerciseName,
  setNewDayExerciseName,
  newDayExerciseTarget,
  setNewDayExerciseTarget,
  newDayExerciseRequired,
  setNewDayExerciseRequired,
  handleAddDayScheduleExercise,
}) {
  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      feature.enabled
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
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-2xs font-bold transition-colors ${
            feature.enabled
              ? 'bg-rose-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-muted'
          }`}
        >
          {feature.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {feature.enabled && (
        <div className="mt-3 pt-3 border-t border-rose-200/60 dark:border-rose-900/40 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-2xs font-semibold text-main mb-1">Plan Title *</label>
              <input
                type="text"
                value={feature.planTitle}
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
                  value={feature.totalWeeks || 12}
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-2xs font-semibold text-main">Weekday Variations</span>
            <button
              type="button"
              onClick={handleLoad12WeekMovementDefaults}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg bg-rose-100/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-200/80 transition-colors flex-shrink-0"
            >
              <Sparkles className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              <span>Reset 12-Week Defaults</span>
            </button>
          </div>

          {/* Weekday Selector Tabs */}
          <div
            role="tablist"
            aria-label="Select weekday variation"
            className="flex sm:grid sm:grid-cols-7 gap-1 sm:gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-thin"
          >
            {days.map(day => {
              const variation = feature.dayVariations?.[day] || {};
              const isSelected = selectedDayScheduleWeekday === day;
              const isRest = variation.type === 'rest' || day === 'Sun';
              const isWalk = variation.type === 'walk';
              return (
                <button
                  key={day}
                  role="tab"
                  id={`day-tab-${day}`}
                  aria-selected={isSelected}
                  aria-controls={`day-panel-${day}`}
                  type="button"
                  onClick={() => handleSelectDayScheduleWeekday(day)}
                  className={`flex-shrink-0 w-14 sm:w-auto h-12 min-h-[44px] flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all relative ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-surface border border-subtle text-slate-700 dark:text-slate-300 hover:bg-surface-subtle'
                  }`}
                >
                  <span>{day}</span>
                  <span className={`text-[10px] sm:text-[9px] font-medium leading-none mt-0.5 ${
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
            const activeVar = feature.dayVariations?.[activeDay] || { type: 'workout', label: '', target: '', exercises: [] };
            const exercises = activeVar.exercises || [];
            const isRest = activeVar.type === 'rest';

            return (
              <div
                id={`day-panel-${activeDay}`}
                role="tabpanel"
                aria-labelledby={`day-tab-${activeDay}`}
                className="p-3 bg-surface rounded-xl border border-subtle space-y-3"
              >
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
                    </div>

                    {/* List of exercises */}
                    <div className="space-y-1.5 md:max-h-56 md:overflow-y-auto md:pr-1">
                      {exercises.map((ex, idx) => {
                        const isRequired = ex.isRequired !== false && ex.isRequiredForCompletion !== false;
                        const hasError = errors[`daySchedule_${activeDay}_${idx}`];
                        return (
                          <div
                            key={ex.id || idx}
                            className={`grid items-center gap-x-1.5 gap-y-1.5 p-2 rounded-lg bg-surface border text-xs grid-cols-[1.25rem_minmax(0,1fr)_auto] md:grid-cols-[1.25rem_minmax(0,1fr)_7rem_auto_auto_auto] ${
                              hasError ? 'border-rose-400 bg-rose-50/20' : 'border-subtle'
                            }`}
                          >
                            {/* Step number */}
                            <span className="col-start-1 row-start-1 text-center text-2xs font-bold text-muted select-none">
                              {idx + 1}.
                            </span>

                            {/* Exercise name */}
                            <input
                              type="text"
                              value={ex.name || ex.label || ''}
                              onChange={(e) => handleUpdateDayScheduleExercise(activeDay, idx, 'name', e.target.value)}
                              placeholder="Exercise or step name *"
                              aria-label={`Step ${idx + 1} name`}
                              aria-invalid={!!hasError}
                              className={`col-start-2 row-start-1 w-full min-w-0 h-8 md:h-7 px-2.5 rounded-lg border bg-surface text-main text-xs placeholder:text-muted transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500 ${
                                hasError ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                              }`}
                            />

                            {/* Remove Button: top-right on mobile, last column on desktop */}
                            <button
                              type="button"
                              onClick={() => handleRemoveDayScheduleExercise(activeDay, idx)}
                              className="col-start-3 row-start-1 md:col-start-6 inline-flex items-center justify-center flex-shrink-0 w-8 h-8 md:w-7 md:h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Remove exercise"
                              aria-label={`Remove step ${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Row 2 on mobile (full card width, never wraps); md:contents lets children join the parent grid on desktop */}
                            <div className="col-start-1 col-span-3 row-start-2 flex flex-nowrap items-center gap-1.5 md:contents">
                              {/* Target / reps */}
                              <input
                                type="text"
                                value={ex.target || ex.reps || ''}
                                onChange={(e) => handleUpdateDayScheduleExercise(activeDay, idx, 'target', e.target.value)}
                                placeholder="Target / reps"
                                aria-label={`Step ${idx + 1} target`}
                                className="flex-1 min-w-0 md:col-start-3 md:row-start-1 w-full h-8 md:h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-surface text-main text-xs placeholder:text-muted transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500"
                              />

                              {/* Required / Optional Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleDayScheduleExerciseRequired(activeDay, idx)}
                                aria-pressed={isRequired}
                                className={`md:col-start-4 md:row-start-1 h-8 md:h-7 px-2 md:px-2.5 rounded-lg border flex-shrink-0 text-2xs font-semibold transition-colors ${
                                  isRequired
                                    ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                                title="Toggle Required / Optional for habit completion"
                              >
                                {isRequired ? 'Required' : 'Optional'}
                              </button>

                              {/* Reorder Buttons */}
                              <div className="md:col-start-5 md:row-start-1 inline-flex flex-shrink-0 overflow-hidden rounded-lg border border-subtle bg-surface">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveDayScheduleExercise(activeDay, idx, -1)}
                                  className="inline-flex items-center justify-center w-7 h-8 md:w-7 md:h-7 text-slate-400 enabled:hover:text-slate-700 enabled:hover:bg-slate-100 dark:enabled:hover:text-slate-200 dark:enabled:hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                  title="Move up"
                                  aria-label={`Move step ${idx + 1} up`}
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === exercises.length - 1}
                                  onClick={() => handleMoveDayScheduleExercise(activeDay, idx, 1)}
                                  className="inline-flex items-center justify-center w-7 h-8 md:w-7 md:h-7 border-l border-subtle text-slate-400 enabled:hover:text-slate-700 enabled:hover:bg-slate-100 dark:enabled:hover:text-slate-200 dark:enabled:hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                  title="Move down"
                                  aria-label={`Move step ${idx + 1} down`}
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Validation error: aligned under the name field */}
                            {hasError && (
                              <p className="col-start-2 col-span-2 row-start-3 md:col-span-5 md:row-start-2 text-rose-500 text-2xs">
                                {hasError}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Add new exercise row */}
                    <div className="pt-2 border-t border-subtle/80 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-7">
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
                        <div className="sm:col-span-5">
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
                      </div>

                      {/* Footer: required checkbox card (start) + Add Step button (end) */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex flex-1 min-w-0 items-center gap-2.5 h-9 pl-2 pr-3.5 rounded-full border border-subtle bg-surface cursor-pointer select-none transition-colors hover:bg-surface-subtle">
                          <input
                            type="checkbox"
                            checked={newDayExerciseRequired}
                            onChange={(e) => setNewDayExerciseRequired(e.target.checked)}
                            className="peer sr-only"
                          />
                          <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md border-2 border-slate-300 dark:border-slate-600 bg-transparent transition-colors peer-checked:bg-rose-600 peer-checked:border-rose-600 peer-focus-visible:ring-2 peer-focus-visible:ring-rose-500/40 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
                            </svg>
                          </span>
                          <span className="min-w-0 whitespace-nowrap text-xs font-medium text-main">Required step</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleAddDayScheduleExercise(activeDay)}
                          disabled={!newDayExerciseName.trim()}
                          className="inline-flex items-center justify-center gap-1 flex-shrink-0 h-9 pl-3 pr-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600"
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
          })()}

          <p className="text-2xs text-muted">
            Structured weekday-specific routines with integrated Sunday rest day support. Mutually exclusive with Multi-Item Catalog.
          </p>
        </div>
      )}
    </div>
  );
}
