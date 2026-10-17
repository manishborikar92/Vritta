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
} from '../src/lib/constants/habit-models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Phase 3: Unified Habit Card Architecture & Behavioral Integrity', () => {
  describe('1. Component Architecture & Universal Exports', () => {
    it('should export DashboardHabitCard and HabitManagerCard from habits barrel', () => {
      const habitsIndexContent = readWebFile('src/components/habits/index.js');
      assert.ok(
        habitsIndexContent.includes("export { default as DashboardHabitCard } from './DashboardHabitCard'"),
        'habits/index.js must export DashboardHabitCard'
      );
      assert.ok(
        habitsIndexContent.includes("export { default as HabitManagerCard } from './HabitManagerCard'"),
        'habits/index.js must export HabitManagerCard'
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

    it('should verify dashboard/page.js renders DashboardHabitCard and eliminates specialized branches', () => {
      const dashboardContent = readWebFile('src/app/(protected)/dashboard/page.js');
      assert.ok(
        dashboardContent.includes('DashboardHabitCard'),
        'dashboard/page.js must import DashboardHabitCard'
      );
      assert.ok(
        dashboardContent.includes('<DashboardHabitCard'),
        'dashboard/page.js must render <DashboardHabitCard />'
      );
      // Verify specialized cards are not directly rendered in dashboard/page.js
      assert.ok(
        !dashboardContent.includes('<WorkbookCard'),
        'dashboard/page.js must NOT directly render <WorkbookCard'
      );
      assert.ok(
        !dashboardContent.includes('<MovementCard'),
        'dashboard/page.js must NOT directly render <MovementCard'
      );
      assert.ok(
        !dashboardContent.includes('<OshoCard'),
        'dashboard/page.js must NOT directly render <OshoCard'
      );
      assert.ok(
        !dashboardContent.includes('<ReadingCard'),
        'dashboard/page.js must NOT directly render <ReadingCard'
      );
      assert.ok(
        !dashboardContent.includes('<SpeakingCard'),
        'dashboard/page.js must NOT directly render <SpeakingCard'
      );
      assert.ok(
        !dashboardContent.includes('<DiaryCard'),
        'dashboard/page.js must NOT directly render <DiaryCard'
      );
    });

    it('should verify habits/page.js renders HabitManagerCard', () => {
      const habitsContent = readWebFile('src/app/(protected)/habits/page.js');
      assert.ok(
        habitsContent.includes('HabitManagerCard'),
        'habits/page.js must import HabitManagerCard'
      );
      assert.ok(
        habitsContent.includes('<HabitManagerCard'),
        'habits/page.js must render <HabitManagerCard />'
      );
    });
  });

  describe('2. Canonical Category & Styling Token Conformance', () => {
    it('should verify DashboardHabitCard and HabitManagerCard consume getCategoryConfig', () => {
      const dashboardCardContent = readWebFile('src/components/habits/DashboardHabitCard.js');
      const managerCardContent = readWebFile('src/components/habits/HabitManagerCard.js');

      assert.ok(
        dashboardCardContent.includes('getCategoryConfig'),
        'DashboardHabitCard must call getCategoryConfig'
      );
      assert.ok(
        managerCardContent.includes('getCategoryConfig'),
        'HabitManagerCard must call getCategoryConfig'
      );
    });

    it('should verify zero title sniffing or category substring matches in unified cards', () => {
      const dashboardCardContent = readWebFile('src/components/habits/DashboardHabitCard.js');
      const managerCardContent = readWebFile('src/components/habits/HabitManagerCard.js');

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
    it('should verify DashboardHabitCard and HabitManagerCard implement collapsible instructions', () => {
      const dashboardCardContent = readWebFile('src/components/habits/DashboardHabitCard.js');
      const managerCardContent = readWebFile('src/components/habits/HabitManagerCard.js');

      assert.ok(
        dashboardCardContent.includes('showInstructions') && dashboardCardContent.includes('setShowInstructions'),
        'DashboardHabitCard must implement collapsible instructions accordion'
      );
      assert.ok(
        managerCardContent.includes('showInstructions') && managerCardContent.includes('setShowInstructions'),
        'HabitManagerCard must implement collapsible instructions accordion'
      );
    });
  });

  describe('5. WCAG 2.2 AAA Touch Targets & Action Controls', () => {
    it('should verify primary circular completion button satisfies min 44x44px touch target', () => {
      const dashboardCardContent = readWebFile('src/components/habits/DashboardHabitCard.js');
      assert.ok(
        dashboardCardContent.includes('min-w-[44px]') && dashboardCardContent.includes('min-h-[44px]'),
        'Primary circular completion button in DashboardHabitCard must meet min 44x44px'
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

    it('should verify HabitManagerCard Edit and Delete buttons satisfy min 44x44px touch targets', () => {
      const managerCardContent = readWebFile('src/components/habits/HabitManagerCard.js');
      assert.ok(
        managerCardContent.includes('min-w-[44px]') && managerCardContent.includes('min-h-[44px]'),
        'Edit and delete buttons in HabitManagerCard must meet min 44x44px'
      );
    });
  });

  describe('6. Note-Taking Autosave & Data Loss Prevention', () => {
    it('should verify SlotNotes implements 400ms debounce, blur flush, unmount flush, and pagehide flush', () => {
      const notesContent = readWebFile('src/components/habits/slots/SlotNotes.js');

      assert.ok(notesContent.includes('400'), 'SlotNotes must use 400ms debounce');
      assert.ok(notesContent.includes('handleBlur'), 'SlotNotes must implement blur handler');
      assert.ok(notesContent.includes('pagehide'), 'SlotNotes must flush on pagehide event');
      assert.ok(notesContent.includes('visibilitychange'), 'SlotNotes must flush on visibilitychange');
      assert.ok(notesContent.includes('isPrivateDiary'), 'SlotNotes must support private reflection diary mode');
    });
  });

  describe('7. Action Outcomes Menu Elimination & Simplified Contract', () => {
    it('should verify DashboardHabitCard establishes primary circular checkbox as sole toggle without action menu', () => {
      const dashboardCardContent = readWebFile('src/components/habits/DashboardHabitCard.js');

      assert.ok(
        !dashboardCardContent.includes('Skip Today') && !dashboardCardContent.includes('Skip / Rest Today'),
        'DashboardHabitCard must eliminate manual Skip Today action'
      );
      assert.ok(
        !dashboardCardContent.includes('Mark as Missed'),
        'DashboardHabitCard must eliminate manual Mark as Missed action'
      );
      assert.ok(
        dashboardCardContent.includes('handlePrimaryToggle'),
        'DashboardHabitCard must use primary circular toggle as single mechanism'
      );
    });
  });
});
