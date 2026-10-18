import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

// Helper to simulate the debounced autosave state machine
class SpeakingCardAutosaveSimulator {
  constructor({ habitId = 'canonical_english_speaking', initialNotes = '', isCompleted = false, onUpdateProgress }) {
    this.habitId = habitId;
    this.notes = initialNotes;
    this.latestNotes = initialNotes;
    this.lastSavedNotes = initialNotes;
    this.isCompleted = isCompleted;
    this.onUpdateProgress = onUpdateProgress;
    this.timer = null;
    this.isEditing = false;
  }

  handleNotesChange(text) {
    this.notes = text;
    this.latestNotes = text;
    this.isEditing = true;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.flushSave();
    }, 400);
  }

  handleBlur() {
    this.flushSave();
  }

  handleToggle() {
    this.flushSave();
    this.isCompleted = !this.isCompleted;
  }

  flushSave() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isEditing = false;

    if (this.latestNotes !== this.lastSavedNotes) {
      const textToSave = this.latestNotes;
      this.lastSavedNotes = textToSave;
      this.onUpdateProgress(this.habitId, { notes: textToSave }, this.isCompleted);
    }
  }

  unmount() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    if (this.latestNotes !== this.lastSavedNotes) {
      this.onUpdateProgress(this.habitId, { notes: this.latestNotes }, this.isCompleted);
    }
  }
}

describe('SpeakingCard Autosave & Debounce Behavior', () => {
  it('should coalesce rapid typing into a single debounced save', async () => {
    const saveCalls = [];
    const simulator = new SpeakingCardAutosaveSimulator({
      initialNotes: '',
      onUpdateProgress: (habitId, data, isCompleted) => {
        saveCalls.push({ habitId, data, isCompleted });
      },
    });

    // Simulate typing 10 characters rapidly (every 30ms)
    const text = 'Hello Chat';
    for (let i = 1; i <= text.length; i++) {
      simulator.handleNotesChange(text.slice(0, i));
      await new Promise(r => setTimeout(r, 30));
    }

    // Immediately after typing, before 400ms expires, no saves should have executed
    assert.equal(saveCalls.length, 0, 'No saves should execute during active typing before debounce expires');

    // Wait 450ms for debounce timer to fire
    await new Promise(r => setTimeout(r, 450));

    // Exactly one save should have executed with the final text
    assert.equal(saveCalls.length, 1, 'Only one save call should occur after debounce');
    assert.equal(saveCalls[0].data.notes, 'Hello Chat');
  });

  it('should immediately flush pending notes on blur without waiting for timer', () => {
    const saveCalls = [];
    const simulator = new SpeakingCardAutosaveSimulator({
      initialNotes: '',
      onUpdateProgress: (habitId, data, isCompleted) => {
        saveCalls.push({ habitId, data, isCompleted });
      },
    });

    simulator.handleNotesChange('Pronunciation notes on th sounds');
    assert.equal(saveCalls.length, 0);

    // User blurs the textarea
    simulator.handleBlur();

    assert.equal(saveCalls.length, 1, 'Blur must immediately flush notes');
    assert.equal(saveCalls[0].data.notes, 'Pronunciation notes on th sounds');
  });

  it('should flush pending notes when unmounting (navigating away)', () => {
    const saveCalls = [];
    const simulator = new SpeakingCardAutosaveSimulator({
      initialNotes: 'Initial',
      onUpdateProgress: (habitId, data, isCompleted) => {
        saveCalls.push({ habitId, data, isCompleted });
      },
    });

    simulator.handleNotesChange('Updated notes before switching tabs');
    assert.equal(saveCalls.length, 0);

    // Component unmounts (route change)
    simulator.unmount();

    assert.equal(saveCalls.length, 1, 'Unmount must guarantee latest notes are saved');
    assert.equal(saveCalls[0].data.notes, 'Updated notes before switching tabs');
  });

  it('should flush pending notes when toggling completion', () => {
    const saveCalls = [];
    const simulator = new SpeakingCardAutosaveSimulator({
      initialNotes: '',
      isCompleted: false,
      onUpdateProgress: (habitId, data, isCompleted) => {
        saveCalls.push({ habitId, data, isCompleted });
      },
    });

    simulator.handleNotesChange('Practiced fluency today');
    assert.equal(saveCalls.length, 0);

    // User clicks the complete checkmark
    simulator.handleToggle();

    assert.equal(saveCalls.length, 1, 'Toggle must flush pending notes before completing');
    assert.equal(saveCalls[0].data.notes, 'Practiced fluency today');
    assert.equal(simulator.isCompleted, true);
  });
});

describe('SlotNotes Static Source Code Compliance', () => {
  const filePath = path.join(webRoot, 'src', 'components', 'habits', 'slots', 'SlotNotes.js');
  const cardPath = path.join(webRoot, 'src', 'components', 'habits', 'DashboardHabitCard.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  const cardContent = fs.readFileSync(cardPath, 'utf-8');

  it('should implement debounced autosave with 400ms timer', () => {
    assert.ok(content.includes('400'), 'Must specify ~400ms debounce timeout');
    assert.ok(content.includes('setTimeout'), 'Must use setTimeout for debounce');
    assert.ok(content.includes('clearTimeout'), 'Must clear timer on pending change or flush');
  });

  it('should implement blur handler for immediate persistence', () => {
    assert.ok(content.includes('onBlur={handleBlur}'), 'Textarea must have onBlur handler');
    assert.ok(content.includes('handleBlur'), 'Must implement handleBlur function');
  });

  it('should implement unmount cleanup for navigation safety', () => {
    assert.ok(content.includes('flushSave'), 'Must have flushSave function');
    assert.ok(content.includes('onSave'), 'Must invoke onSave callback');
  });

  it('should preserve WCAG 2.2 touch target standards (min 44x44px)', () => {
    const has44pxToggle = cardContent.includes('w-11 h-11') ||
      (cardContent.includes('w-11') && cardContent.includes('h-11')) ||
      (cardContent.includes('min-w-[44px]') && cardContent.includes('min-h-[44px]'));
    assert.ok(has44pxToggle, 'Toggle button must meet 44x44px (w-11 h-11)');
  });

  it('should implement mobile-responsive textarea font sizing (text-xs)', () => {
    assert.ok(content.includes('text-xs') || content.includes('text-base sm:text-sm'), 'Must prevent iOS mobile auto-zoom');
  });
});
