/**
 * Canonical entrypoint for Vritta Domain Analytics layer.
 *
 * Decomposes analytics logic into focused, single-responsibility modules:
 * - timeframe: Timeframe definitions, date ranges, and timezone formatting
 * - truth-table: 8-scenario outcome evaluator and daily log completion checks
 * - consistency: Single-habit and multi-habit lifetime consistency & dual-metric calculations
 * - calendar-grid: Month-based calendar grid and rhythm heatmap derivation
 */

export * from './timeframe.js';
export * from './truth-table.js';
export * from './consistency.js';
export * from './calendar-grid.js';
