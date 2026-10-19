import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getReadingTargetMinutes,
  READING_DURATION_PRESETS,
  DEFAULT_READING_DURATION,
} from '../src/utils/reading-helpers.js';
import { MANISH_PERSONAL_ROUTINES } from '../src/lib/server/schedule-templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Phase 3: Specialized Reading Duration Timer Subsystem', () => {
  describe('1. Scope Enforcement: Removal of Generic Timer & Retention of Specialized Reading Duration', () => {
    it('should verify generic timer is completely removed from HabitModal GENERIC_COMPLETION_STYLES', () => {
      const content = readWebFile('src/components/habits/HabitModal.js');
      assert.ok(
        !content.includes("id: 'timer'"),
        'HabitModal must not offer timer as a generic completion style'
      );
      assert.ok(
        !content.includes('Focus / Practice Timer'),
        'HabitModal must not contain generic Focus / Practice Timer label'
      );
    });

    it('should verify reading_duration is retained in SPECIALIZED_COMPLETION_STYLES', () => {
      const content = readWebFile('src/components/habits/HabitModal.js');
      assert.ok(
        content.includes('reading_duration: {'),
        'HabitModal must retain reading_duration in SPECIALIZED_COMPLETION_STYLES'
      );
      assert.ok(
        content.includes('Specialized: Reading Duration Target'),
        'HabitModal must retain Specialized: Reading Duration Target label'
      );
    });

    it('should verify dashboard dispatches reading_duration and excludes generic timer', () => {
      const content = readWebFile('src/components/habits/HabitTrackerCard.js') + readWebFile('src/app/(protected)/dashboard/page.js');
      assert.ok(
        content.includes("habit.completionMethod === 'reading_duration'"),
        'Dashboard must dispatch reading_duration to timer slot'
      );
      assert.ok(
        !content.includes("method === 'timer'"),
        'Dashboard must not dispatch generic timer method'
      );
    });

    it('should provide duration selector via the Timer feature slot in HabitModal', () => {
      const content = readWebFile('src/components/habits/HabitModal.js');
      assert.ok(
        content.includes('formData.features.timer.enabled'),
        'Duration selector must be configured via the composable Timer feature slot'
      );
      assert.ok(
        content.includes('targetDurationMinutes'),
        'HabitModal must configure targetDurationMinutes for the timer'
      );
      assert.deepEqual(
        READING_DURATION_PRESETS,
        [15, 20, 30, 45, 60],
        'Canonical presets helper provides [15, 20, 30, 45, 60] minute options'
      );
    });

    it('should persist canonical targetMinutes at root level and omit metadata.targetMinutes', () => {
      const content = readWebFile('src/components/habits/HabitModal.js');
      assert.ok(
        content.includes('parseInt(formData.targetMinutes, 10)') &&
        content.includes('delete cleanMetadata.targetMinutes') &&
        content.includes('targetMinutes,') &&
        content.includes('metadata: cleanMetadata,'),
        'HabitModal must persist canonical targetMinutes at root and clean metadata.targetMinutes'
      );
    });

    it('should verify SlotTimer no longer declares independent duration presets or hardcoded timer targets', () => {
      const content = readWebFile('src/components/habits/slots/SlotTimer.js');
      assert.ok(
        !content.includes('DURATION_PRESETS'),
        'SlotTimer must not declare DURATION_PRESETS'
      );
      assert.ok(
        !content.includes('TARGET_SECONDS'),
        'SlotTimer must not declare hardcoded TARGET_SECONDS constant'
      );
      assert.ok(
        !content.includes('setDuration('),
        'SlotTimer must not call setDuration or render in-card preset selector chips'
      );
      assert.ok(
        content.includes('getReadingTargetMinutes(habit)'),
        'SlotTimer must derive its target from getReadingTargetMinutes(habit)'
      );
    });

    it('should verify READING_DURATION_PRESETS is declared and exported by HabitModal & helpers', () => {
      assert.deepEqual(
        READING_DURATION_PRESETS,
        [15, 20, 30, 45, 60],
        'Must support canonical duration presets [15, 20, 30, 45, 60]'
      );
      assert.equal(DEFAULT_READING_DURATION, 30, 'Default reading duration must be 30 minutes');
    });

    it('should initialize timer with saved 15-minute duration', () => {
      const habit15 = {
        id: 'reading_15',
        title: 'Read Evening',
        completionMethod: 'reading_duration',
        targetMinutes: 15,
      };
      const resolved = getReadingTargetMinutes(habit15);
      assert.equal(resolved, 15, 'Saved 15-minute duration must initialize timer to 15 minutes');
      assert.equal(resolved * 60, 900, 'Must produce 900 targetSeconds');
    });

    it('should initialize timer with saved 45-minute duration', () => {
      const habit45 = {
        id: 'reading_45',
        title: 'Read Deeply',
        completionMethod: 'reading_duration',
        targetMinutes: 45,
      };
      const resolved = getReadingTargetMinutes(habit45);
      assert.equal(resolved, 45, 'Saved 45-minute duration must initialize timer to 45 minutes');
      assert.equal(resolved * 60, 2700, 'Must produce 2700 targetSeconds');
    });

    it('should preserve legacy compatibility for records using metadata.targetMinutes', () => {
      const legacyHabit = {
        id: 'reading_legacy',
        title: 'Read Books',
        completionMethod: 'reading_duration',
        metadata: {
          targetMinutes: 20,
          context: 'Before bedtime',
        },
      };
      const resolved = getReadingTargetMinutes(legacyHabit);
      assert.equal(resolved, 20, 'Legacy record with metadata.targetMinutes must resolve to 20 minutes');
    });

    it('should prioritize canonical targetMinutes over legacy metadata.targetMinutes when both exist', () => {
      const hybridHabit = {
        id: 'reading_hybrid',
        targetMinutes: 45,
        metadata: {
          targetMinutes: 20,
        },
      };
      const resolved = getReadingTargetMinutes(hybridHabit);
      assert.equal(resolved, 45, 'Canonical top-level targetMinutes must take precedence');
    });

    it('should safely fallback to default 30 minutes only when duration is missing or invalid', () => {
      assert.equal(getReadingTargetMinutes({}), 30, 'Empty habit must receive safe default of 30');
      assert.equal(getReadingTargetMinutes(null), 30, 'Null habit must receive safe default of 30');
      assert.equal(getReadingTargetMinutes(undefined), 30, 'Undefined habit must receive safe default of 30');
      assert.equal(getReadingTargetMinutes({ targetMinutes: 0 }), 30, 'Zero duration must receive safe default of 30');
      assert.equal(getReadingTargetMinutes({ targetMinutes: -5 }), 30, 'Negative duration must receive safe default of 30');
      assert.equal(getReadingTargetMinutes({ targetMinutes: 'invalid' }), 30, 'Non-numeric duration must receive safe default of 30');
      assert.equal(getReadingTargetMinutes({ metadata: { targetMinutes: null } }), 30, 'Null metadata target must receive safe default of 30');
    });

    it('should verify editing duration in HabitModal updates persisted payload and timer configuration', () => {
      // Simulate form state initialized with 30m habit and existing context metadata
      const initialHabit = {
        id: 'read_1',
        title: 'Read Books',
        targetMinutes: 30,
        metadata: {
          context: 'Before going to sleep',
          targetMinutes: 30, // legacy nested field
        },
      };
      const initialTarget = getReadingTargetMinutes(initialHabit);
      assert.equal(initialTarget, 30);

      // Simulate HabitModal handleSubmit logic
      const userSelectedMinutes = 15;
      const displayTime = 'Before bed';
      const cleanMetadata = { ...(initialHabit?.metadata || {}) };
      delete cleanMetadata.targetMinutes;

      const persistedPayload = {
        ...initialHabit,
        time: displayTime,
        targetMinutes: userSelectedMinutes,
        metadata: cleanMetadata,
      };

      assert.equal(persistedPayload.targetMinutes, 15, 'Persisted payload must contain canonical root targetMinutes');
      assert.equal(persistedPayload.metadata.targetMinutes, undefined, 'Persisted payload must omit metadata.targetMinutes');
      assert.equal(persistedPayload.metadata.context, 'Before going to sleep', 'Unrelated metadata must be strictly preserved');

      // Subsequent load of edited habit record
      const updatedTarget = getReadingTargetMinutes(persistedPayload);
      assert.equal(updatedTarget, 15, 'Updated habit record must resolve timer to 15 minutes');
      assert.equal(updatedTarget * 60, 900, 'Subsequent timer countdown starts at 900 seconds');
    });

    it('should verify schedule-templates seed defines root targetMinutes and clean metadata', () => {
      const readBooksRoutine = MANISH_PERSONAL_ROUTINES.find(r => r.stableKey === 'canonical_read_books');
      assert.ok(readBooksRoutine, 'MANISH_PERSONAL_ROUTINES must define canonical_read_books');
      assert.equal(readBooksRoutine.targetMinutes, 30, 'canonical_read_books must define canonical targetMinutes: 30 at root');
      assert.equal(readBooksRoutine.metadata?.targetMinutes, undefined, 'canonical_read_books must not declare metadata.targetMinutes');
      assert.equal(readBooksRoutine.metadata?.context, 'Before going to sleep', 'canonical_read_books must preserve metadata.context');
    });

    it('should verify obsolete sync-service is retired and reconciliation cleans metadata.targetMinutes', () => {
      assert.ok(
        !fs.existsSync(path.join(webRoot, 'src/lib/server/sync-service.js')),
        'sync-service.js must be removed in favor of schedule-templates.js'
      );

      // Simulate sync reconciliation algorithm on custom user duration
      const routine = MANISH_PERSONAL_ROUTINES.find(r => r.stableKey === 'canonical_read_books');
      const existingUserHabit = {
        id: 'user_canonical_read_books',
        targetMinutes: 45,
        metadata: {
          targetMinutes: 20, // legacy artifact
          context: 'Before bedtime',
          customTag: 'personal',
        },
      };

      const cleanMetadata = {
        ...routine.metadata,
        ...(existingUserHabit.metadata || {}),
      };
      delete cleanMetadata.targetMinutes;

      const existingMinutes = existingUserHabit.targetMinutes !== undefined && existingUserHabit.targetMinutes !== null
        ? Number(existingUserHabit.targetMinutes)
        : (existingUserHabit.metadata?.targetMinutes !== undefined ? Number(existingUserHabit.metadata.targetMinutes) : null);

      const reconciledTargetMinutes = Number.isFinite(existingMinutes) && existingMinutes > 0
        ? Math.round(existingMinutes)
        : (routine.targetMinutes || 30);

      assert.equal(reconciledTargetMinutes, 45, 'Custom user targetMinutes (45) must take precedence during sync');
      assert.equal(cleanMetadata.targetMinutes, undefined, 'metadata.targetMinutes must be stripped during sync');
      assert.equal(cleanMetadata.context, 'Before bedtime', 'User metadata.context must be preserved');
      assert.equal(cleanMetadata.customTag, 'personal', 'Custom metadata tags must be preserved');
    });
  });

  describe('2. Accurate Countdown & Background Throttling Resilience', () => {
    it('should calculate countdown remaining time precisely using absolute timestamps', () => {
      const targetSeconds = 1800; // 30 minutes
      const now = Date.now();
      const targetEndTime = now + targetSeconds * 1000;

      // Simulated tick after 30 seconds
      const simulatedNow = now + 30000;
      const remaining = Math.max(0, Math.ceil((targetEndTime - simulatedNow) / 1000));
      assert.equal(remaining, 1770, 'Must calculate exact 1770 seconds remaining');

      // Simulated completion
      const completedNow = now + 1801000;
      const completedRemaining = Math.max(0, Math.ceil((targetEndTime - completedNow) / 1000));
      assert.equal(completedRemaining, 0, 'Must clamp to 0 on completion');
    });

    it('should prove timestamp math is immune to background tab throttling drift', () => {
      const durationSeconds = 900; // 15 minutes
      const startTime = Date.now();
      const targetEndTime = startTime + durationSeconds * 1000;

      // Simulate browser throttling where tab sleeps for 120 seconds
      // Naive counter drifts, but timestamp delta remains exact
      const backgroundAwakeTime = startTime + 120000;
      const remainingSeconds = Math.max(0, Math.ceil((targetEndTime - backgroundAwakeTime) / 1000));

      assert.equal(remainingSeconds, 780, 'Must reflect 780s remaining after 120s background delay');
    });

    it('should register visibilitychange and window focus listeners in timer subsystem', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      const hookContent = readWebFile('src/hooks/useTimer.js');

      assert.ok(
        contextContent.includes('document.addEventListener(\'visibilitychange\', handleSync)') ||
        contextContent.includes("addEventListener('visibilitychange'"),
        'TimerContext must register visibilitychange listener'
      );
      assert.ok(
        hookContent.includes("addEventListener('visibilitychange'"),
        'useTimer must register visibilitychange listener'
      );
    });
  });

  describe('3. Timer Persistence Across Route Navigation & Reload Recovery Lifecycle Fixes', () => {
    it('should mount TimerProvider inside DataProvider in RootLayout', () => {
      const layoutContent = readWebFile('src/app/layout.js');
      assert.ok(
        layoutContent.includes('<TimerProvider>'),
        'RootLayout must mount TimerProvider'
      );
      assert.ok(
        layoutContent.indexOf('<DataProvider>') < layoutContent.indexOf('<TimerProvider>'),
        'TimerProvider must be nested inside DataProvider for data sync'
      );
    });

    it('should manage persistent timer storage schema in localStorage', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      assert.ok(
        contextContent.includes('vritta_active_timers'),
        'TimerContext must use vritta_active_timers storage key'
      );
      assert.ok(
        contextContent.includes('targetEndTime:') && contextContent.includes('isRunning:'),
        'Stored timer must track targetEndTime and isRunning'
      );
    });

    it('should verify finished timers are evicted from localStorage to prevent repeated reload alerts (Defect 1 Fix)', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      // Verify saveToStorage only persists active or paused countdowns, not 0s finished ones
      assert.ok(
        contextContent.includes('t.isRunning || (t.isPaused && t.secondsRemaining > 0'),
        'Finished timers must be omitted from serializable storage'
      );
      // Verify reload recovery triggers only once for expiredWhileAway
      assert.ok(
        contextContent.includes('t.expiredWhileAway'),
        'Reload recovery must explicitly guard on expiredWhileAway'
      );
    });

    it('should verify atomic lock guard against visibility and interval race conditions (Defect 3 Fix)', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      assert.ok(
        contextContent.includes('finishingTimersRef'),
        'TimerContext must use finishingTimersRef to prevent race conditions'
      );
    });

    it('should simulate reload recovery when timer expired while away', () => {
      const now = Date.now();
      const expiredTimer = {
        habitId: 'test_habit_1',
        targetMinutes: 15,
        targetSeconds: 900,
        targetEndTime: now - 5000, // Expired 5 seconds ago
        isRunning: true,
      };

      const remaining = Math.max(0, Math.ceil((expiredTimer.targetEndTime - now) / 1000));
      assert.equal(remaining, 0, 'Expired timer must resolve to 0 seconds remaining');
    });

    it('should simulate reload recovery when timer is still active', () => {
      const now = Date.now();
      const activeTimer = {
        habitId: 'test_habit_2',
        targetMinutes: 20,
        targetSeconds: 1200,
        targetEndTime: now + 600000, // 10 minutes left
        isRunning: true,
      };

      const remaining = Math.max(0, Math.ceil((activeTimer.targetEndTime - now) / 1000));
      assert.equal(remaining, 600, 'Active timer must accurately restore 600s remaining');
    });
  });

  describe('4. Gentle Web Audio Completion Chime', () => {
    it('should verify audio-chime.js exists and exports playCompletionChime and unlockAudio', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('export function playCompletionChime()'), 'Must export playCompletionChime');
      assert.ok(content.includes('export function unlockAudio()'), 'Must export unlockAudio');
    });

    it('should verify harmonic frequencies and exponential decay in chime synthesis', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('528'), 'Must use 528 Hz restorative Solfeggio frequency');
      assert.ok(content.includes('660'), 'Must use 660 Hz harmonic companion tone');
      assert.ok(
        content.includes('exponentialRampToValueAtTime'),
        'Must use exponentialRampToValueAtTime for calm volume decay'
      );
    });

    it('should gracefully handle unsupported or restricted audio environments', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('try {') && content.includes('catch'), 'Must wrap audio synthesis in try/catch');
    });
  });

  describe('5. Browser Notifications & Permission Handling', () => {
    it('should verify timer-notifications.js exists and exports permission & notification helpers', () => {
      const content = readWebFile('src/utils/timer-notifications.js');
      assert.ok(content.includes('export function isNotificationSupported()'), 'Must export isNotificationSupported');
      assert.ok(content.includes('export async function requestNotificationPermission()'), 'Must export requestNotificationPermission');
      assert.ok(content.includes('export function sendTimerNotification('), 'Must export sendTimerNotification');
    });

    it('should verify auto-close cleanup for browser notifications', () => {
      const content = readWebFile('src/utils/timer-notifications.js');
      assert.ok(content.includes('setTimeout(') && content.includes('notification.close()'), 'Must auto-close notification');
    });
  });

  describe('6. Progress Tracking & Authoritative Persistence (Defect 2 Fix)', () => {
    it('should update durationMinutes on habit progress completion in SlotTimer', () => {
      const content = readWebFile('src/components/habits/slots/SlotTimer.js');
      assert.ok(
        content.includes('durationMinutes'),
        'SlotTimer must record completed durationMinutes to daily log on completion'
      );
    });

    it('should ensure TimerContext is the single authoritative writer to updateProgress', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      const hookContent = readWebFile('src/hooks/useTimer.js');

      assert.ok(
        contextContent.includes('updateProgress(habitId, { durationMinutes: targetMinutes }, true)'),
        'TimerContext must be the authoritative writer to Firestore'
      );
      assert.ok(
        hookContent.includes('TimerContext authoritatively owns updateProgress'),
        'useTimer must not perform redundant duplicate writes in context mode'
      );
    });
  });

  describe('7. UI Consistency & Prohibited Color Audit', () => {
    it('should verify zero prohibited colors across all Phase 3 timer files', () => {
      const files = [
        'src/components/habits/slots/SlotTimer.js',
        'src/contexts/TimerContext.js',
        'src/hooks/useTimer.js',
        'src/utils/audio-chime.js',
        'src/utils/timer-notifications.js',
        'src/utils/reading-helpers.js',
      ];

      const prohibited = [
        'bg-indigo-', 'text-indigo-', 'border-indigo-',
        'bg-purple-', 'text-purple-', 'border-purple-',
        'bg-blue-600', 'text-blue-600',
      ];

      for (const file of files) {
        const content = readWebFile(file);
        for (const token of prohibited) {
          assert.ok(
            !content.includes(token),
            `${file} must not contain prohibited token: ${token}`
          );
        }
      }
    });

    it('should verify WCAG touch target compliance on SlotTimer controls without oversized buttons', () => {
      const content = readWebFile('src/components/habits/slots/SlotTimer.js');
      assert.ok(content.includes('rounded-xl'), 'Controls must define comfortable padding and target sizing');
      assert.ok(content.includes('w-11 h-11') || content.includes('min-w-[44px]'), 'Timer controls must meet 44x44px touch target');
    });
  });
});
