/**
 * Lifetime Consistency Engine for Vritta.
 * Phase 4: Mathematically Defensible Lifetime Analytics Engine
 *
 * Facade coordinating domain analytics modules:
 * - timeframe: Date range derivation and timezone formatting
 * - truth-table: 8-scenario outcome evaluation and completion checks
 * - consistency: Single-habit and multi-habit lifetime consistency & dual-metric calculations
 * - calendar-grid: Month-based calendar grid and rhythm heatmap derivation
 *
 * All domain logic has been modularized into pure, framework-independent
 * submodules under `web/src/domain/analytics/`. This file re-exports all symbols
 * to preserve 100% backward compatibility for all consumers and tests.
 */

export * from '../../domain/analytics/index.js';
