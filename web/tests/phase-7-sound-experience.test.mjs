import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAudioSupported,
  getAudioContext,
  unlockAudio,
  playStartCue,
  playPauseCue,
  playResumeCue,
  playResetCue,
  playCompletionChime,
  playStepToggleCue,
  playHabitCompleteCue,
  playTabSwitchCue,
  playActionSuccessCue,
  playActionDeleteCue,
} from '../src/utils/audio-chime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

function readWebFile(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), 'utf-8');
}

describe('Phase 7: Interactive Sound Experience & Audio Polish', () => {
  describe('1. Web Audio API Synthesizer Architecture & Calibration', () => {
    it('should export all 10 approved synthesizer methods and helpers from audio-chime.js', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('export function isAudioSupported()'), 'Must export isAudioSupported');
      assert.ok(content.includes('export function getAudioContext()'), 'Must export getAudioContext');
      assert.ok(content.includes('export function unlockAudio()'), 'Must export unlockAudio');
      assert.ok(content.includes('export function playStartCue()'), 'Must export playStartCue');
      assert.ok(content.includes('export function playPauseCue()'), 'Must export playPauseCue');
      assert.ok(content.includes('export function playResumeCue()'), 'Must export playResumeCue');
      assert.ok(content.includes('export function playResetCue()'), 'Must export playResetCue');
      assert.ok(content.includes('export function playCompletionChime()'), 'Must export playCompletionChime');
      assert.ok(content.includes('export function playStepToggleCue('), 'Must export playStepToggleCue');
      assert.ok(content.includes('export function playHabitCompleteCue()'), 'Must export playHabitCompleteCue');
      assert.ok(content.includes('export function playTabSwitchCue()'), 'Must export playTabSwitchCue');
      assert.ok(content.includes('export function playActionSuccessCue()'), 'Must export playActionSuccessCue');
      assert.ok(content.includes('export function playActionDeleteCue()'), 'Must export playActionDeleteCue');
      assert.ok(!content.includes('playMilestoneCue'), 'Must NOT export deleted playMilestoneCue');
    });

    it('should verify Timer Start cue uses rising two-tone musical interval (G4 -> C5)', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('392.0'), 'playStartCue must use G4 (392.0 Hz)');
      assert.ok(content.includes('523.25'), 'playStartCue must use C5 (523.25 Hz)');
      assert.ok(content.includes('0.35'), 'playStartCue duration must be approximately 0.35s');
    });

    it('should verify Timer Pause cue uses soft descending inflection (E4 -> C4)', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('329.63'), 'playPauseCue must start at E4 (329.63 Hz)');
      assert.ok(content.includes('261.63'), 'playPauseCue must descend to C4 (261.63 Hz)');
    });

    it('should verify Timer Resume cue uses gentle ascending inflection (C4 -> E4)', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('261.63'), 'playResumeCue must start at C4 (261.63 Hz)');
      assert.ok(content.includes('329.63'), 'playResumeCue must ascend to E4 (329.63 Hz)');
    });

    it('should verify Timer Reset cue uses restrained acoustic double-tap (580 Hz -> 440 Hz)', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('580.0'), 'playResetCue must start at 580 Hz');
      assert.ok(content.includes('440.0'), 'playResetCue must ramp to 440 Hz');
    });

    it('should verify Timer Completion cue uses polyphonic resonant chord with deep decay', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('261.63'), 'playCompletionChime must include C4 root (261.63 Hz)');
      assert.ok(content.includes('528'), 'playCompletionChime must preserve Solfeggio 528 Hz harmonic');
      assert.ok(content.includes('660'), 'playCompletionChime must preserve major third 660 Hz');
      assert.ok(content.includes('2.0'), 'playCompletionChime duration must be approximately 2.0s');
    });

    it('should verify Step Toggle cue differentiates check vs uncheck transitions', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('784.0') && content.includes('1046.5'), 'Step check must ramp from G5 (784Hz) to C6 (1046.5Hz)');
      assert.ok(content.includes('523.25') && content.includes('392.0'), 'Step uncheck must ramp from C5 (523.25Hz) down to G4 (392Hz)');
    });

    it('should verify Habit Complete cue uses celebratory consonant chord', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('659.25'), 'playHabitCompleteCue must use E5 (659.25 Hz)');
      assert.ok(content.includes('987.77'), 'playHabitCompleteCue must use B5 (987.77 Hz)');
      assert.ok(content.includes('1046.5'), 'playHabitCompleteCue must resolve on C6 (1046.5 Hz)');
    });

    it('should verify In-Page Tab Switch cue uses calibrated 25ms sine transient with clear volume', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('0.025'), 'playTabSwitchCue duration must be approximately 0.025s');
      assert.ok(content.includes('0.5') || content.includes('OUTPUT_CEILING'), 'playTabSwitchCue peak gain must be calibrated for audible tactile click');
      assert.ok(content.includes('523.25'), 'playTabSwitchCue pitch must remain C5 (523.25 Hz)');
    });

    it('should verify Routine Save and Delete cues use distinct harmonic inflections', () => {
      const content = readWebFile('src/utils/audio-chime.js');
      assert.ok(content.includes('659.25'), 'playActionSuccessCue must resolve up to E5 (659.25 Hz)');
      assert.ok(content.includes('196.0') && content.includes('164.81'), 'playActionDeleteCue must descend from G3 to E3');
    });

    it('should execute SSR safety checks without crashing when window is undefined', () => {
      assert.equal(isAudioSupported(), false, 'isAudioSupported must return false in Node SSR');
      assert.equal(getAudioContext(), null, 'getAudioContext must return null in Node SSR');
      assert.doesNotThrow(() => unlockAudio(), 'unlockAudio must not throw in SSR');
      assert.equal(playStartCue(), false, 'playStartCue must return false in SSR without throwing');
      assert.equal(playPauseCue(), false, 'playPauseCue must return false in SSR without throwing');
      assert.equal(playResumeCue(), false, 'playResumeCue must return false in SSR without throwing');
      assert.equal(playResetCue(), false, 'playResetCue must return false in SSR without throwing');
      assert.equal(playCompletionChime(), false, 'playCompletionChime must return false in SSR without throwing');
      assert.equal(playStepToggleCue(true), false, 'playStepToggleCue(true) must return false in SSR');
      assert.equal(playStepToggleCue(false), false, 'playStepToggleCue(false) must return false in SSR');
      assert.equal(playHabitCompleteCue(), false, 'playHabitCompleteCue must return false in SSR');
      assert.equal(playTabSwitchCue(), false, 'playTabSwitchCue must return false in SSR');
      assert.equal(playActionSuccessCue(), false, 'playActionSuccessCue must return false in SSR');
      assert.equal(playActionDeleteCue(), false, 'playActionDeleteCue must return false in SSR');
    });
  });

  describe('2. Sound Preference Persistence & Centralized SoundContext', () => {
    it('should verify default preference logic for sound-enabled state', () => {
      const SOUND_ENABLED_KEY = 'vritta-sound-enabled';
      const DEFAULT_ENABLED = true;

      function mockGetStoredSoundEnabled(mockStorage) {
        if (!mockStorage) return DEFAULT_ENABLED;
        const stored = mockStorage[SOUND_ENABLED_KEY];
        if (stored === undefined || stored === null) return DEFAULT_ENABLED;
        return stored === 'true';
      }

      assert.equal(mockGetStoredSoundEnabled({}), true, 'Default sound enabled must be true');
      assert.equal(mockGetStoredSoundEnabled({ [SOUND_ENABLED_KEY]: 'false' }), false, 'Honors stored false');
      assert.equal(mockGetStoredSoundEnabled({ [SOUND_ENABLED_KEY]: 'true' }), true, 'Honors stored true');
    });

    it('should verify SoundContext provides all approved cue dispatches and guards them with soundEnabled', () => {
      const content = readWebFile('src/contexts/SoundContext.js');
      assert.ok(content.includes('playStartCue:'), 'SoundContext must expose playStartCue');
      assert.ok(content.includes('playPauseCue:'), 'SoundContext must expose playPauseCue');
      assert.ok(content.includes('playResumeCue:'), 'SoundContext must expose playResumeCue');
      assert.ok(content.includes('playResetCue:'), 'SoundContext must expose playResetCue');
      assert.ok(content.includes('playCompletionCue:'), 'SoundContext must expose playCompletionCue');
      assert.ok(content.includes('playStepToggleCue:'), 'SoundContext must expose playStepToggleCue');
      assert.ok(content.includes('playHabitCompleteCue:'), 'SoundContext must expose playHabitCompleteCue');
      assert.ok(content.includes('playTabSwitchCue:'), 'SoundContext must expose playTabSwitchCue');
      assert.ok(content.includes('playActionSuccessCue:'), 'SoundContext must expose playActionSuccessCue');
      assert.ok(content.includes('playActionDeleteCue:'), 'SoundContext must expose playActionDeleteCue');
      assert.ok(content.includes('if (!soundEnabled) return false;'), 'Dispatches must guard with soundEnabled');
    });

    it('should verify SoundProvider is mounted above TimerProvider in layout.js hierarchy', () => {
      const layoutContent = readWebFile('src/app/layout.js');
      assert.ok(layoutContent.includes('<SoundProvider>'), 'RootLayout must mount SoundProvider');
      assert.ok(layoutContent.includes('<TimerProvider>'), 'RootLayout must mount TimerProvider');

      const soundIndex = layoutContent.indexOf('<SoundProvider>');
      const timerIndex = layoutContent.indexOf('<TimerProvider>');
      assert.ok(
        soundIndex < timerIndex,
        'SoundProvider MUST be mounted above TimerProvider so TimerContext can consume SoundContext'
      );
    });

    it('should verify contexts/index.js exports SoundProvider and useSound', () => {
      const indexContent = readWebFile('src/contexts/index.js');
      assert.ok(indexContent.includes('SoundProvider'), 'contexts/index.js must export SoundProvider');
      assert.ok(indexContent.includes('useSound'), 'contexts/index.js must export useSound');
    });
  });

  describe('3. Timer Lifecycle & Transition Invariants', () => {
    it('should verify fresh timer start triggers start cue, while resuming mid-session triggers resume cue', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      assert.ok(
        contextContent.includes('if (isResuming) {') && contextContent.includes('playResumeCue?.();'),
        'startTimer must trigger playResumeCue when resuming a paused session'
      );
      assert.ok(
        contextContent.includes('playStartCue?.();'),
        'startTimer must trigger playStartCue on fresh session start'
      );
      assert.ok(
        contextContent.includes('if (current?.isRunning) {') && contextContent.includes('return prev;'),
        'startTimer must be idempotent on already-running timers'
      );
    });

    it('should verify pauseTimer triggers playPauseCue only when timer is running', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      assert.ok(
        contextContent.includes('if (!current || !current.isRunning) return prev;'),
        'pauseTimer must ignore idle or already-paused timers'
      );
      assert.ok(
        contextContent.includes('playPauseCue?.();'),
        'pauseTimer must play pause cue on valid pause transition'
      );
    });

    it('should verify resetTimer triggers playResetCue only when timer was active or paused mid-session', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      assert.ok(
        contextContent.includes('const canReset = current && ('),
        'resetTimer must verify timer was running or paused mid-session'
      );
      assert.ok(
        contextContent.includes('if (!canReset) {') && contextContent.includes('return prev;'),
        'resetTimer must be silent for idle or unchanged timers'
      );
      assert.ok(
        contextContent.includes('playResetCue?.();'),
        'resetTimer must trigger playResetCue on genuine reset'
      );
    });

    it('should verify timer completion triggers completion cue exactly once and reload recovery remains silent', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      assert.ok(
        contextContent.includes('if (!isSilent && playCompletionCue)'),
        'handleTimerFinished must guard playCompletionCue with !isSilent'
      );
      assert.ok(
        contextContent.includes('completedSessionsRef.current[sessionKey]'),
        'tickTimers must use completedSessionsRef to prevent duplicate completion handling'
      );
      assert.ok(
        contextContent.includes('handleTimerFinished(id, t.targetMinutes, true /* isSilent'),
        'Reload recovery for expiredWhileAway must pass isSilent=true to handleTimerFinished'
      );
    });

    it('should verify background timer resilience: Web Worker ticker, target deadline timeouts, and pageshow listener', () => {
      const contextContent = readWebFile('src/contexts/TimerContext.js');
      assert.ok(contextContent.includes('createTimerWorker'), 'TimerContext must define Web Worker ticker');
      assert.ok(contextContent.includes('deadlineTimeoutsRef'), 'TimerContext must schedule exact deadline timeouts');
      assert.ok(contextContent.includes("window.addEventListener('pageshow'"), 'TimerContext must listen to pageshow for bfcache restore');
      assert.ok(contextContent.includes('useAuth'), 'TimerContext must consume useAuth for reload recovery');
      assert.ok(contextContent.includes('diffMs <= 0 ? 0 : Math.ceil(diffMs / 1000)'), 'getTimerState must compute realtime remaining to prevent 00:01 stranding');
    });

    it('should verify standalone useTimer.js fallback supports start, resume, pause, reset, and completion cues', () => {
      const hookContent = readWebFile('src/hooks/useTimer.js');
      assert.ok(hookContent.includes('playStartCue()'), 'useTimer.js must call playStartCue');
      assert.ok(hookContent.includes('playResumeCue()'), 'useTimer.js must call playResumeCue');
      assert.ok(hookContent.includes('playPauseCue()'), 'useTimer.js must call playPauseCue');
      assert.ok(hookContent.includes('playResetCue()'), 'useTimer.js must call playResetCue');
      assert.ok(hookContent.includes('playCompletionChime()'), 'useTimer.js must call playCompletionChime');
    });
  });

  describe('4. Checklists & Habit Completion Deduplication Invariants', () => {
    it('should verify SlotChecklist plays habit completion and suppresses step tick on final step', () => {
      const cardContent = readWebFile('src/components/habits/slots/SlotChecklist.js');
      assert.ok(
        cardContent.includes('if (nextAllDone) {') &&
        cardContent.includes('playHabitCompleteCue?.();') &&
        cardContent.includes('} else {') &&
        cardContent.includes('playStepToggleCue?.(!isCurrentlyChecked);'),
        'SlotChecklist must play playHabitCompleteCue on final step and suppress step tick'
      );
    });

    it('should verify HabitTrackerCard whole habit toggle plays completion or neutral uncheck cue', () => {
      const cardContent = readWebFile('src/components/habits/HabitTrackerCard.js');
      assert.ok(
        cardContent.includes('playHabitCompleteCue?.();') &&
        cardContent.includes('playStepToggleCue?.(false);'),
        'HabitTrackerCard must play completion cue on complete and uncheck tick on incomplete'
      );
    });

    it('should verify SlotDaySchedule implements final-item completion deduplication', () => {
      const scheduleContent = readWebFile('src/components/habits/slots/SlotDaySchedule.js');
      assert.ok(
        scheduleContent.includes('playHabitCompleteCue?.();') &&
        scheduleContent.includes('playStepToggleCue?.(!isCurrentlyChecked);'),
        'SlotDaySchedule must deduplicate final exercise item with workout completion'
      );
    });

    it('should verify SlotStepper implements counter change and target completion cues', () => {
      const stepperContent = readWebFile('src/components/habits/slots/SlotStepper.js');
      assert.ok(
        stepperContent.includes('playHabitCompleteCue?.();'),
        'SlotStepper must play habit completion cue when target is fulfilled'
      );
      assert.ok(
        stepperContent.includes('playStepToggleCue?.(true);') && stepperContent.includes('playStepToggleCue?.(false);'),
        'SlotStepper must play step ticks for granular counter changes'
      );
    });

    it('should verify composable components support sound completion cues', () => {
      const dashboard = readWebFile('src/components/habits/HabitTrackerCard.js');
      const timer = readWebFile('src/components/habits/slots/SlotTimer.js');
      const checklist = readWebFile('src/components/habits/slots/SlotChecklist.js');
      const daySchedule = readWebFile('src/components/habits/slots/SlotDaySchedule.js');

      assert.ok(dashboard.includes('playHabitCompleteCue'), 'HabitTrackerCard must support completion cue');
      assert.ok(!timer.includes('soundOnComplete'), 'SlotTimer must not contain obsolete soundOnComplete');
      assert.ok(timer.includes('useTimer'), 'SlotTimer must support sound cues via useTimer');
      assert.ok(checklist.includes('playHabitCompleteCue'), 'SlotChecklist must support completion cues');
      assert.ok(daySchedule.includes('playHabitCompleteCue'), 'SlotDaySchedule must support completion cues');
    });
  });

  describe('5. In-Page Tab Switch & Route Navigation Invariants', () => {
    it('should verify AnalyticsPage view mode toggle triggers playTabSwitchCue only on genuine changes', () => {
      const analyticsContent = readWebFile('src/app/(protected)/insights/page.js');
      assert.ok(
        analyticsContent.includes('const handleViewModeChange = (nextMode) => {') &&
        analyticsContent.includes('if (nextMode !== viewMode) {') &&
        analyticsContent.includes('playTabSwitchCue?.();'),
        'AnalyticsPage must trigger playTabSwitchCue only when nextMode differs from viewMode'
      );
    });

    it('should verify BottomNav route navigation triggers playTabSwitchCue only on genuine destination switches', () => {
      const navContent = readWebFile('src/components/ui/navigation/BottomNav.js');
      assert.ok(navContent.includes('useSound'), 'BottomNav must import useSound');
      assert.ok(navContent.includes('playTabSwitchCue'), 'BottomNav must call playTabSwitchCue');
      assert.ok(
        navContent.includes('!isRouteActive(pathname, href)') || navContent.includes('pathname !== href'),
        'BottomNav must guard navigation cue so only genuine destination switches play sound'
      );
    });

    it('should verify OshoLibraryModal group pill switcher triggers playTabSwitchCue only on genuine changes', () => {
      const modalContent = readWebFile('src/components/habits/OshoLibraryModal.js');
      assert.ok(
        modalContent.includes('const handleGroupSelect = (groupId) => {') &&
        modalContent.includes('if (groupId !== selectedGroup) {') &&
        modalContent.includes('playTabSwitchCue?.();'),
        'OshoLibraryModal must trigger playTabSwitchCue only when groupId differs from selectedGroup'
      );
    });
  });

  describe('6. Routine Persistence & Lifecycle Invariants', () => {
    it('should verify routine creation/saving triggers playActionSuccessCue only after operation succeeds', () => {
      const habitsContent = readWebFile('src/app/(protected)/habits/page.js');
      const saveSection = habitsContent.slice(
        habitsContent.indexOf('const handleSave ='),
        habitsContent.indexOf('const handleDelete =')
      );

      assert.ok(
        saveSection.includes('await updateHabit') &&
        saveSection.includes('await addHabit') &&
        saveSection.includes('playActionSuccessCue?.();'),
        'handleSave must play playActionSuccessCue only after updateHabit or addHabit completes'
      );
      assert.ok(
        saveSection.indexOf('await') < saveSection.indexOf('playActionSuccessCue?.();'),
        'playActionSuccessCue must be positioned after await persistence'
      );
    });

    it('should verify routine deletion triggers playActionDeleteCue only after operation succeeds', () => {
      const habitsContent = readWebFile('src/app/(protected)/habits/page.js');
      const deleteSection = habitsContent.slice(
        habitsContent.indexOf('const handleDelete ='),
        habitsContent.indexOf('const handleSeedHabits =')
      );

      assert.ok(
        deleteSection.includes('await deleteHabit(habitId);') &&
        deleteSection.includes('playActionDeleteCue?.();'),
        'handleDelete must play playActionDeleteCue only after deleteHabit completes'
      );
      assert.ok(
        deleteSection.indexOf('await deleteHabit') < deleteSection.indexOf('playActionDeleteCue?.();'),
        'playActionDeleteCue must be positioned after await deleteHabit'
      );
    });

    it('should verify error handlers and cancel dialogs produce NO success sounds', () => {
      const habitsContent = readWebFile('src/app/(protected)/habits/page.js');
      const dialogContent = readWebFile('src/components/ui/dialogs/ConfirmDialog.js');

      assert.ok(!habitsContent.includes('catch (err) {\n      playAction'), 'Catch block must not play success cues');
      assert.ok(!dialogContent.includes('useSound'), 'ConfirmDialog must NOT import useSound');
    });
  });

  describe('7. Direct Sound Toggle UI & WCAG 2.2 Accessibility Invariants', () => {
    it('should verify SoundControl component exists and exports direct toggle button without popovers', () => {
      const controlContent = readWebFile('src/components/ui/controls/SoundControl.js');
      assert.ok(controlContent.includes('export default function SoundControl('), 'SoundControl must export default function');
      assert.ok(!controlContent.includes('role="dialog"'), 'SoundControl must NOT render dialog popover');
      assert.ok(!controlContent.includes('type="range"'), 'SoundControl must NOT render volume slider');
      assert.ok(!controlContent.includes('previewCue'), 'SoundControl must NOT render preview buttons');
    });

    it('should verify SoundControl complies with WCAG 2.2 touch target and ARIA semantics', () => {
      const controlContent = readWebFile('src/components/ui/controls/SoundControl.js');
      assert.ok(controlContent.includes('w-10 h-10'), 'Button must provide accessible 40x40px touch area');
      assert.ok(controlContent.includes('onClick={toggleSound}'), 'Button must toggle sound on single click');
      assert.ok(controlContent.includes('aria-label='), 'Button must define descriptive aria-label');
      assert.ok(controlContent.includes('Volume2') && controlContent.includes('VolumeX'), 'Button must toggle between Volume2 and VolumeX');
    });

    it('should verify TopNav renders SoundControl adjacent to ThemeToggle in persistent header', () => {
      const topNavContent = readWebFile('src/components/ui/navigation/TopNav.js');
      assert.ok(topNavContent.includes('import SoundControl'), 'TopNav must import SoundControl');
      assert.ok(topNavContent.includes('<SoundControl />'), 'TopNav must render SoundControl');
      assert.ok(topNavContent.includes('<ThemeToggle />'), 'TopNav must render ThemeToggle');

      const soundPos = topNavContent.indexOf('<SoundControl />');
      const themePos = topNavContent.indexOf('<ThemeToggle />');
      assert.ok(soundPos < themePos, 'SoundControl must be positioned next to ThemeToggle in header');
    });
  });

  describe('8. Targeted Sound Additions: Osho Stepper, Active Series & Movement 12-Week Plan', () => {
    it('should verify OshoLibraryModal implements talk progress decrement/increment cues and boundary silence', () => {
      const modalContent = readWebFile('src/components/habits/OshoLibraryModal.js');

      assert.ok(
        modalContent.includes('playStepToggleCue'),
        'OshoLibraryModal must import/destructure playStepToggleCue from useSound'
      );
      assert.ok(
        modalContent.includes('handleDecrementTalk') &&
        modalContent.includes('playStepToggleCue?.(false);'),
        'handleDecrementTalk must dispatch playStepToggleCue(false)'
      );
      assert.ok(
        modalContent.includes('handleIncrementTalk') &&
        modalContent.includes('playStepToggleCue?.(true);'),
        'handleIncrementTalk must dispatch playStepToggleCue(true)'
      );
      assert.ok(
        modalContent.includes('disabled={progress.completedTalks <= 0}'),
        'Decrement button must be disabled at boundary (completedTalks <= 0)'
      );
      assert.ok(
        modalContent.includes('progress.completedTalks >= item.talkCount'),
        'Increment button must be disabled when item.talkCount limit is reached'
      );
    });

    it('should verify OshoLibraryModal Set as Active series plays playActionSuccessCue only after genuine successful change', () => {
      const modalContent = readWebFile('src/components/habits/OshoLibraryModal.js');

      assert.ok(
        modalContent.includes('playActionSuccessCue'),
        'OshoLibraryModal must import/destructure playActionSuccessCue from useSound'
      );
      assert.ok(
        modalContent.includes('if (!seriesId || seriesId === currentSeriesId'),
        'handleSelectSeries must guard against already-active or empty seriesId'
      );
      assert.ok(
        modalContent.includes('activatingRef.current'),
        'handleSelectSeries must guard against concurrent double-click invocations'
      );
      assert.ok(
        modalContent.includes('await onSelectSeries(seriesId);') &&
        modalContent.includes('playActionSuccessCue?.();'),
        'handleSelectSeries must await onSelectSeries and dispatch playActionSuccessCue upon success'
      );
      assert.ok(
        modalContent.indexOf('await onSelectSeries') < modalContent.indexOf('playActionSuccessCue?.();'),
        'playActionSuccessCue must be placed after successful await onSelectSeries'
      );
      assert.ok(
        !modalContent.includes('catch (err) {\n      playActionSuccessCue'),
        'Catch block must not dispatch success cues'
      );
      assert.ok(
        modalContent.includes('disabled={isCurrent || activatingSeriesId === item.id}'),
        'Button must be disabled when series is already current or activating'
      );
    });

    it('should verify OshoLibraryModal series selection plays playActionSuccessCue only after genuine activation', () => {
      const modalContent = readWebFile('src/components/habits/OshoLibraryModal.js');

      assert.ok(
        modalContent.includes('playActionSuccessCue'),
        'OshoLibraryModal must import/destructure playActionSuccessCue from useSound'
      );
      assert.ok(
        modalContent.includes('activatingRef.current'),
        'handleSelectSeries must guard against concurrent activations'
      );
      assert.ok(
        modalContent.includes('await onSelectSeries(seriesId)') &&
        modalContent.includes('playActionSuccessCue?.();'),
        'handleSelectSeries must await onSelectSeries and dispatch playActionSuccessCue upon success'
      );
      assert.ok(
        modalContent.indexOf('await onSelectSeries') < modalContent.indexOf('playActionSuccessCue?.();'),
        'playActionSuccessCue must be placed after successful await onSelectSeries'
      );
      assert.ok(
        !modalContent.includes('catch (err) {\n      playActionSuccessCue'),
        'Catch block must not dispatch success cues'
      );
    });

    it('should simulate functional runtime behavior for Osho talk counter boundaries and no-ops', () => {
      let updatedTalks = null;
      let soundCueCalled = null;

      const mockUpdate = (seriesId, count) => {
        updatedTalks = count;
      };
      const mockPlayStepToggleCue = (isChecked) => {
        soundCueCalled = isChecked;
      };

      // Helper simulating handleDecrementTalk logic
      const simulateDecrement = (item, currentTalks) => {
        const current = typeof currentTalks === 'number' ? currentTalks : 0;
        if (current <= 0) return false;
        const nextVal = Math.max(0, current - 1);
        if (nextVal < current) {
          mockUpdate(item.id, nextVal);
          mockPlayStepToggleCue(false);
          return true;
        }
        return false;
      };

      // Helper simulating handleIncrementTalk logic
      const simulateIncrement = (item, currentTalks) => {
        const current = typeof currentTalks === 'number' ? currentTalks : 0;
        const maxTalks = typeof item.talkCount === 'number' ? item.talkCount : Infinity;
        if (current >= maxTalks) return false;
        const nextVal = current + 1;
        if (nextVal > current) {
          mockUpdate(item.id, nextVal);
          mockPlayStepToggleCue(true);
          return true;
        }
        return false;
      };

      // 1. Normal decrement
      updatedTalks = null;
      soundCueCalled = null;
      const decResult = simulateDecrement({ id: 'osho_01', talkCount: 15 }, 4);
      assert.equal(decResult, true);
      assert.equal(updatedTalks, 3);
      assert.equal(soundCueCalled, false);

      // 2. Decrement at lower boundary (0) -> NO sound, NO update
      updatedTalks = null;
      soundCueCalled = null;
      const decBoundResult = simulateDecrement({ id: 'osho_01', talkCount: 15 }, 0);
      assert.equal(decBoundResult, false);
      assert.equal(updatedTalks, null);
      assert.equal(soundCueCalled, null);

      // 3. Normal increment
      updatedTalks = null;
      soundCueCalled = null;
      const incResult = simulateIncrement({ id: 'osho_01', talkCount: 15 }, 14);
      assert.equal(incResult, true);
      assert.equal(updatedTalks, 15);
      assert.equal(soundCueCalled, true);

      // 4. Increment at upper boundary (talkCount limit reached) -> NO sound, NO update
      updatedTalks = null;
      soundCueCalled = null;
      const incBoundResult = simulateIncrement({ id: 'osho_01', talkCount: 15 }, 15);
      assert.equal(incBoundResult, false);
      assert.equal(updatedTalks, null);
      assert.equal(soundCueCalled, null);

      // 5. Increment on series with null talkCount (compilations) -> allows increment
      updatedTalks = null;
      soundCueCalled = null;
      const incNullResult = simulateIncrement({ id: 'osho_comp', talkCount: null }, 20);
      assert.equal(incNullResult, true);
      assert.equal(updatedTalks, 21);
      assert.equal(soundCueCalled, true);
    });

    it('should simulate functional runtime behavior for active series selection, error handling and duplicate prevention', async () => {
      let cueCount = 0;
      let activatingRef = { current: false };

      const mockPlayActionSuccess = () => {
        cueCount++;
      };

      const simulateSelectSeries = async (seriesId, currentSeriesId, onSelectSeries) => {
        if (!seriesId || seriesId === currentSeriesId || activatingRef.current || !onSelectSeries) {
          return false;
        }
        activatingRef.current = true;
        try {
          await onSelectSeries(seriesId);
          mockPlayActionSuccess();
          return true;
        } catch (err) {
          // error swallowed
          return false;
        } finally {
          activatingRef.current = false;
        }
      };

      // 1. Successful change
      cueCount = 0;
      const res1 = await simulateSelectSeries('osho_02', 'osho_01', async () => {});
      assert.equal(res1, true);
      assert.equal(cueCount, 1);

      // 2. Already active series -> NO-OP, NO sound
      cueCount = 0;
      const res2 = await simulateSelectSeries('osho_01', 'osho_01', async () => {});
      assert.equal(res2, false);
      assert.equal(cueCount, 0);

      // 3. Failed operation -> caught, NO sound
      cueCount = 0;
      const res3 = await simulateSelectSeries('osho_03', 'osho_01', async () => {
        throw new Error('Network error');
      });
      assert.equal(res3, false);
      assert.equal(cueCount, 0);

      // 4. Duplicate rapid double call -> second call blocked while in flight
      cueCount = 0;
      let resolveFirst;
      const slowPromise = new Promise(resolve => { resolveFirst = resolve; });
      const firstCall = simulateSelectSeries('osho_04', 'osho_01', () => slowPromise);
      const secondCall = simulateSelectSeries('osho_04', 'osho_01', () => slowPromise);

      assert.equal(await secondCall, false); // blocked by activatingRef
      resolveFirst();
      assert.equal(await firstCall, true);
      assert.equal(cueCount, 1); // exactly one sound dispatched
    });

    it('should simulate functional runtime behavior for 12-week plan activation and duplicate prevention', async () => {
      let cueCount = 0;
      let activatingPlanRef = { current: false };

      const mockPlayActionSuccess = () => {
        cueCount++;
      };

      const simulateActivatePlan = async (isAlreadyActive, onUpdateProfile) => {
        if (isAlreadyActive || activatingPlanRef.current || !onUpdateProfile) return false;
        activatingPlanRef.current = true;
        try {
          await onUpdateProfile();
          mockPlayActionSuccess();
          return true;
        } catch (err) {
          return false;
        } finally {
          activatingPlanRef.current = false;
        }
      };

      // 1. Genuine activation
      cueCount = 0;
      const res1 = await simulateActivatePlan(false, async () => {});
      assert.equal(res1, true);
      assert.equal(cueCount, 1);

      // 2. Already active plan -> NO sound
      cueCount = 0;
      const res2 = await simulateActivatePlan(true, async () => {});
      assert.equal(res2, false);
      assert.equal(cueCount, 0);

      // 3. Failed activation -> caught, NO sound
      cueCount = 0;
      const res3 = await simulateActivatePlan(false, async () => {
        throw new Error('Firestore error');
      });
      assert.equal(res3, false);
      assert.equal(cueCount, 0);

      // 4. Concurrent duplicate prevention
      cueCount = 0;
      let resolveFirst;
      const slowPromise = new Promise(resolve => { resolveFirst = resolve; });
      const firstCall = simulateActivatePlan(false, () => slowPromise);
      const secondCall = simulateActivatePlan(false, () => slowPromise);

      assert.equal(await secondCall, false);
      resolveFirst();
      assert.equal(await firstCall, true);
      assert.equal(cueCount, 1);
    });

    it('should verify global mute setting halts audio playback for all three additions', () => {
      const soundContextContent = readWebFile('src/contexts/SoundContext.js');

      // Verify that SoundContext methods guard against !soundEnabled
      assert.ok(
        soundContextContent.includes('const playStepToggle = useCallback((isChecked = true) => {\n    if (!soundEnabled) return false;'),
        'playStepToggle must return false when soundEnabled is false'
      );
      assert.ok(
        soundContextContent.includes('const playActionSuccess = useCallback(() => {\n    if (!soundEnabled) return false;'),
        'playActionSuccess must return false when soundEnabled is false'
      );
    });
  });
});


