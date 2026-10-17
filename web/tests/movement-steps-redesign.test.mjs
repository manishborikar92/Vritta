import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath) {
  const fullPath = path.join(webRoot, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Phase 4: Progressive Day Schedule & Movement Steps Architecture (SlotDaySchedule)', () => {
  const slotPath = 'src/components/habits/slots/SlotDaySchedule.js';

  describe('1. Component Architecture & Memoization Invariant', () => {
    it('should verify SlotDaySchedule exists and exports a memoized component', () => {
      const content = readWebFile(slotPath);
      assert.ok(content.length > 0, 'SlotDaySchedule.js must exist and not be empty');
      assert.ok(
        content.includes('export default memo(SlotDaySchedule)'),
        'SlotDaySchedule must export a memoized component'
      );
    });
  });

  describe('2. Step Card Structure & Checkbox Alignment', () => {
    it('should verify each exercise step is rendered with structured card styling', () => {
      const content = readWebFile(slotPath);
      assert.ok(
        content.includes('rounded-xl') || content.includes('rounded-2xl'),
        'Exercise step must be styled with rounded container'
      );
    });

    it('should verify checkbox is aligned alongside exercise title with accessible label', () => {
      const content = readWebFile(slotPath);
      assert.ok(
        content.includes('aria-label={`Toggle ${item.name}`}') || content.includes('type="checkbox"'),
        'Step card must include an interactive toggle with accessible label'
      );
      assert.ok(
        content.includes('item.name'),
        'Step title must render exercise item name'
      );
    });
  });

  describe('3. Target & Duration Badge Responsive Placement', () => {
    it('should verify target/duration information is rendered for exercises', () => {
      const content = readWebFile(slotPath);
      assert.ok(
        content.includes('item.target') || content.includes('item.duration') || content.includes('item.cues'),
        'SlotDaySchedule must render target, duration, or posture cues'
      );
    });

    it('should place exercise info cleanly within responsive layout', () => {
      const content = readWebFile(slotPath);
      assert.ok(
        content.includes('flex items-center') || content.includes('flex flex-col'),
        'Exercise items must use responsive flex layout'
      );
    });
  });

  describe('4. Posture Cues & Expandable Details', () => {
    it('should support posture cues and progression notes', () => {
      const content = readWebFile(slotPath);
      assert.ok(
        content.includes('cues') || content.includes('progression'),
        'SlotDaySchedule must support posture cues or progression'
      );
    });

    it('should provide expandable detail trigger for exercise items', () => {
      const content = readWebFile(slotPath);
      assert.ok(
        content.includes('expandedExerciseId') || content.includes('isDetailExpanded'),
        'SlotDaySchedule must support expandable exercise detail state'
      );
    });
  });

  describe('5. Preservation of Business Logic & Safety Guidance', () => {
    it('should preserve Sunday and planned rest day exclusion logic', () => {
      const content = readWebFile(slotPath);
      assert.ok(content.includes('isRestDay') || content.includes('Sun'), 'Must preserve rest day logic');
      assert.ok(content.includes('Rest & Restoration Day') || content.includes('Rest and Recovery'), 'Must render rest day banner');
    });

    it('should preserve safety guidance modal and stop signals', () => {
      const content = readWebFile(slotPath);
      assert.ok(content.includes('showSafetyModal'), 'Must preserve Safety Modal state');
      assert.ok(content.includes('STOP_SIGNALS'), 'Must preserve stop signals fixture');
      assert.ok(content.includes('Safety'), 'Must render Safety modal trigger');
    });
  });

  describe('6. Design System & Prohibited Color Audit', () => {
    it('should verify zero occurrences of "purple" or "indigo" in SlotDaySchedule', () => {
      const content = readWebFile(slotPath);
      assert.ok(!/purple/i.test(content), 'Prohibited color "purple" found in SlotDaySchedule.js');
      assert.ok(!/indigo/i.test(content), 'Prohibited color "indigo" found in SlotDaySchedule.js');
    });
  });
});
