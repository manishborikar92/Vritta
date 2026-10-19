'use client';

import { CATEGORIES } from '@/domain';

/**
 * HabitDetailsTab — Tab 1: Basic details (title, category, custom category, instructions).
 */
export function HabitDetailsTab({ formData, setFormData, errors }) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Routine Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-slate-400"
          placeholder="e.g., Practice English Workbook"
          maxLength={120}
        />
        {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title}</p>}
      </div>

      {/* Life-Area Category */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Life-Area Category
        </label>
        <select
          value={formData.category}
          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Conditional Custom Category Input for 'Other' */}
      {formData.category === 'Other' && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Custom Category Name *
          </label>
          <input
            type="text"
            value={formData.customCategory}
            onChange={(e) => setFormData(prev => ({ ...prev, customCategory: e.target.value }))}
            className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-slate-400"
            placeholder="e.g., Financial Health, Gardening, Skill Building"
            maxLength={40}
          />
          {errors.customCategory && (
            <p className="text-rose-500 text-xs mt-1">{errors.customCategory}</p>
          )}
          <p className="text-2xs text-muted mt-1">
            Distinguishes your custom life-area while adhering to the canonical domain model.
          </p>
        </div>
      )}

      {/* Instructions & Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Instructions & Purpose Notes
        </label>
        <textarea
          value={formData.instructions}
          onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
          rows={3}
          placeholder="Add purpose, instructions, or helpful notes..."
          className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent leading-relaxed placeholder-slate-400"
        />
      </div>
    </div>
  );
}
