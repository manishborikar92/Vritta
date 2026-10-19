import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATEGORIES,
  CANONICAL_CATEGORIES,
  getCategoryConfig,
  isValidCategory,
} from '../src/lib/constants/categories.js';

import {
  APPROVED_FEATURE_SLOTS,
  validateComposableHabit,
} from '../src/domain/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Phase 3: Unified Habit Card Architecture & Behavioral Integrity', () => {
  describe('1. Component Architecture & Universal Exports', () => {
    it('should export HabitTrackerCard and HabitConfigCard from habits barrel', () => {
      const habitsIndexContent = readWebFile('src/components/habits/index.js');
      assert.ok(
        habitsIndexContent.includes("export { default as HabitTrackerCard } from './HabitTrackerCard'"),
        'habits/index.js must export HabitTrackerCard'
      );
      assert.ok(
        habitsIndexContent.includes("export { default as HabitConfigCard } from './HabitConfigCard'"),
        'habits/index.js must export HabitConfigCard'
      );
    });

    it('should export all six approved atomic feature slots from slots barrel', () => {
      const slotsIndexContent = readWebFile('src/components/habits/slots/index.js');
      const habitsIndexContent = readWebFile('src/components/habits/index.js');
      const requiredSlots = [
        'SlotTimer',
        'SlotStepper',
        'SlotChecklist',
        'SlotNotes',
        'SlotCatalog',
        'SlotDaySchedule',
      ];
      for (const slotName of requiredSlots) {
        assert.ok(
          slotsIndexContent.includes(`export { default as ${slotName} }`),
          `slots/index.js must export ${slotName}`
        );
      }
      assert.ok(
        habitsIndexContent.includes("export * from './slots'"),
        'habits/index.js must re-export all slots via export * from ./slots'
      );
    });

    it('should verify today/page.js renders HabitTrackerCard and eliminates specialized branches', () => {
      const todayContent = readWebFile('src/app/(protected)/today/page.js');
      assert.ok(
        todayContent.includes('HabitTrackerCard'),
        'today/page.js must import HabitTrackerCard'
      );
      assert.ok(
        todayContent.includes('<HabitTrackerCard'),
        'today/page.js must render <HabitTrackerCard />'
      );
      // Verify specialized cards are not directly rendered in today/page.js
      assert.ok(
        !todayContent.includes('<WorkbookCard'),
        'today/page.js must NOT directly render <WorkbookCard'
      );
      assert.ok(
        !todayContent.includes('<MovementCard'),
        'today/page.js must NOT directly render <MovementCard'
      );
      assert.ok(
        !todayContent.includes('<OshoCard'),
        'today/page.js must NOT directly render <OshoCard'
      );
      assert.ok(
        !todayContent.includes('<ReadingCard'),
        'today/page.js must NOT directly render <ReadingCard'
      );
      assert.ok(
        !todayContent.includes('<SpeakingCard'),
        'today/page.js must NOT directly render <SpeakingCard'
      );
      assert.ok(
        !todayContent.includes('<DiaryCard'),
        'today/page.js must NOT directly render <DiaryCard'
      );
    });

    it('should verify habits/page.js renders HabitConfigCard', () => {
      const habitsContent = readWebFile('src/app/(protected)/habits/page.js');
      assert.ok(
        habitsContent.includes('HabitConfigCard'),
        'habits/page.js must import HabitConfigCard'
      );
      assert.ok(
        habitsContent.includes('<HabitConfigCard'),
        'habits/page.js must render <HabitConfigCard />'
      );
    });
  });

  describe('2. Canonical Category & Styling Token Conformance', () => {
    it('should verify HabitTrackerCard and HabitConfigCard consume getCategoryConfig', () => {
      const dashboardCardContent = readWebFile('src/components/habits/HabitTrackerCard.js');
      const managerCardContent = readWebFile('src/components/habits/HabitConfigCard.js');

      assert.ok(
        dashboardCardContent.includes('getCategoryConfig'),
        'HabitTrackerCard must call getCategoryConfig'
      );
      assert.ok(
        managerCardContent.includes('getCategoryConfig'),
        'HabitConfigCard must call getCategoryConfig'
      );
    });

    it('should verify zero title sniffing or category substring matches in unified cards', () => {
      const dashboardCardContent = readWebFile('src/components/habits/HabitTrackerCard.js');
      const managerCardContent = readWebFile('src/components/habits/HabitConfigCard.js');

      // Prohibited title sniffing
      assert.ok(!dashboardCardContent.includes("title.includes('workbook')"));
      assert.ok(!dashboardCardContent.includes("title.includes('exercise')"));
      assert.ok(!dashboardCardContent.includes("title.includes('reading')"));
      assert.ok(!dashboardCardContent.includes("title.includes('speaking')"));
      assert.ok(!dashboardCardContent.includes("title.includes('diary')"));

      assert.ok(!managerCardContent.includes("title.includes('workbook')"));
      assert.ok(!managerCardContent.includes("title.includes('exercise')"));
    });
  });

  describe('3. Irrevocable Osho Disclosure & Catalog Content Preservation', () => {
    it('should verify SlotCatalog preserves exact Osho disclosure and explore button', () => {
      const slotCatalogContent = readWebFile('src/components/habits/slots/SlotCatalog.js');

      assert.ok(
        slotCatalogContent.includes('Daily listening for awareness & self-inquiry • Series progress is separate'),
        'SlotCatalog must preserve exact disclosure: Daily listening for awareness & self-inquiry • Series progress is separate'
      );
      assert.ok(
        slotCatalogContent.includes('Explore All 30 Discourse Titles & Links'),
        'SlotCatalog must preserve exact library action: Explore All 30 Discourse Titles & Links'
      );
      assert.ok(
        slotCatalogContent.includes('OshoLibraryModal'),
        'SlotCatalog must mount OshoLibraryModal'
      );
    });
  });

  describe('4. Gate 0 Mobile Density: Collapsible Instructions Accordion', () => {
    it('should verify HabitTrackerCard and HabitConfigCard implement collapsible instructions', () => {
      const dashboardCardContent = readWebFile('src/components/habits/HabitTrackerCard.js');
      const managerCardContent = readWebFile('src/components/habits/HabitConfigCard.js');

      assert.ok(
        dashboardCardContent.includes('showInstructions') && dashboardCardContent.includes('setShowInstructions'),
        'HabitTrackerCard must implement collapsible instructions accordion'
      );
      assert.ok(
        managerCardContent.includes('showInstructions') && managerCardContent.includes('setShowInstructions'),
        'HabitConfigCard must implement collapsible instructions accordion'
      );
    });
  });

  describe('5. WCAG 2.2 AAA Touch Targets & Action Controls', () => {
    it('should verify primary circular completion button satisfies min 44x44px touch target', () => {
      const dashboardCardContent = readWebFile('src/components/habits/HabitTrackerCard.js');
      assert.ok(
        dashboardCardContent.includes('min-w-[44px]') && dashboardCardContent.includes('min-h-[44px]'),
        'Primary circular completion button in HabitTrackerCard must meet min 44x44px'
      );
    });

    it('should verify SlotStepper buttons satisfy min 44x44px touch targets', () => {
      const stepperContent = readWebFile('src/components/habits/slots/SlotStepper.js');
      assert.ok(
        stepperContent.includes('min-w-[44px]') && stepperContent.includes('min-h-[44px]'),
        'Increment and decrement buttons in SlotStepper must meet min 44x44px'
      );
    });

    it('should verify SlotTimer controls satisfy min 44x44px touch targets', () => {
      const timerContent = readWebFile('src/components/habits/slots/SlotTimer.js');
      assert.ok(
        timerContent.includes('min-w-[44px]') && timerContent.includes('min-h-[44px]'),
        'Reset button in SlotTimer must meet min 44x44px'
      );
    });

    it('should verify HabitConfigCard Edit and Delete buttons satisfy min 44x44px touch targets', () => {
      const managerCardContent = readWebFile('src/components/habits/HabitConfigCard.js');
      assert.ok(
        managerCardContent.includes('min-w-[44px]') && managerCardContent.includes('min-h-[44px]'),
        'Edit and delete buttons in HabitConfigCard must meet min 44x44px'
      );
    });
  });

  describe('6. Note-Taking Autosave & Data Loss Prevention', () => {
    it('should verify SlotNotes implements 400ms debounce, blur flush, unmount flush, and pagehide flush', () => {
      const notesContent = readWebFile('src/components/habits/slots/SlotNotes.js');

      assert.ok(notesContent.includes('400'), 'SlotNotes must use 400ms debounce');
      assert.ok(notesContent.includes('handleBlur'), 'SlotNotes must implement blur handler');
      assert.ok(notesContent.includes('pagehide'), 'SlotNotes must flush on pagehide event');
      assert.ok(!notesContent.includes('isPrivateDiary'), 'SlotNotes must not contain obsolete isPrivateDiary flag');
      assert.ok(notesContent.includes('reflectionPrompts'), 'SlotNotes must support reflection prompts');
    });
  });

  describe('7. Action Outcomes Menu Elimination & Simplified Contract', () => {
    it('should verify HabitTrackerCard establishes primary circular checkbox as sole toggle without action menu', () => {
      const dashboardCardContent = readWebFile('src/components/habits/HabitTrackerCard.js');

      assert.ok(
        !dashboardCardContent.includes('Skip Today') && !dashboardCardContent.includes('Skip / Rest Today'),
        'HabitTrackerCard must eliminate manual Skip Today action'
      );
      assert.ok(
        !dashboardCardContent.includes('Mark as Missed'),
        'HabitTrackerCard must eliminate manual Mark as Missed action'
      );
      assert.ok(
        dashboardCardContent.includes('handlePrimaryToggle'),
        'HabitTrackerCard must use primary circular toggle as single mechanism'
      );
    });
  });
});
