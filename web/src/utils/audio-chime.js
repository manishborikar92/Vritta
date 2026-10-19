/**
 * Audio Chime Utility — Zero-dependency Web Audio API sound synthesizer.
 *
 * Provides calibrated synthesized auditory cues for specialized routines:
 * - playStartCue: Rising two-note interval (G4 -> C5) for focus initiation (0.35s)
 * - playPauseCue: Soft descending inflection (E4 -> C4) for gentle pause acknowledgement (0.12s)
 * - playResumeCue: Gentle ascending inflection (C4 -> E4) for re-entry into focus (0.12s)
 * - playResetCue: Restrained acoustic double-tap (580Hz -> 440Hz) for timer reset (0.08s)
 * - playCompletionChime: Resonant harmonic chord (C4, G4, 528Hz, 660Hz) with 2.0s decay
 * - playStepToggleCue: Crisp micro-chirplet (784Hz -> 1046.5Hz) on check (35ms); soft muted tick (523.25Hz -> 392Hz) on uncheck (40ms)
 * - playHabitCompleteCue: Celebratory consonant chord (E5, B5 -> C6) with 0.65s decay
 * - playTabSwitchCue: Featherlight damped sine tap (523.25Hz) for in-page view changes (25ms)
 * - playActionSuccessCue: Warm ascending major third (C5 -> E5) for routine creation/save (0.20s)
 * - playActionDeleteCue: Low soft descending release (G3 -> E3) for routine removal (0.18s)
 *
 * Loudness: every cue is described as data (see CUES) and is measured once, then
 * scaled by a single constant gain so its loudest instant sits exactly at
 * OUTPUT_CEILING. Scaling is purely linear, so pitch, timing, envelope and tone
 * are unchanged; only the level is raised. No compressor or limiter is used.
 *
 * Handles audio context suspension, user interaction unlock, and SSR environments safely.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Peak level (0-1) that every cue is scaled to. Raise for louder cues;
 * stay below 1.0 to avoid digital clipping.
 */
const OUTPUT_CEILING = 0.9;

/** Floor for exponential ramps, which cannot reach exactly zero. */
const SILENCE = 0.0001;

/** Sample rate used when measuring a cue's peak level (Hz). */
const MEASURE_SAMPLE_RATE = 48000;

const TWO_PI = 2 * Math.PI;

// ---------------------------------------------------------------------------
// Cue definitions
//
// A cue is { master?, tones[] }. All times are in seconds from cue start.
//
// master: optional shared envelope applied to the whole cue
//   level   - starting gain (default 1)
//   fadeEnd - exponential fade to silence by this time (omit for constant gain)
//
// tone: one sine oscillator with its own envelope
//   freq      - start frequency (Hz)
//   freqEnd   - optional exponential glide target, reached at fadeEnd
//   start     - when the oscillator begins
//   attackEnd - end of linear attack from silence (omit to begin at full peak)
//   peak      - envelope peak amplitude
//   fadeEnd   - exponential decay reaches `floor` at this time
//   floor     - decay target (default SILENCE)
//   stop      - when the oscillator stops (default fadeEnd)
// ---------------------------------------------------------------------------

const CUES = {
  // G4 -> C5, two notes with a 100ms offset for a smooth legato rise
  start: {
    tones: [
      { freq: 392.0, start: 0, attackEnd: 0.015, peak: 0.096, fadeEnd: 0.18 },
      { freq: 523.25, start: 0.1, attackEnd: 0.115, peak: 0.12, fadeEnd: 0.35 },
    ],
  },

  // E4 -> C4 glide
  pause: {
    tones: [
      { freq: 329.63, freqEnd: 261.63, start: 0, attackEnd: 0.01, peak: 0.08, fadeEnd: 0.12 },
    ],
  },

  // C4 -> E4 glide
  resume: {
    tones: [
      { freq: 261.63, freqEnd: 329.63, start: 0, attackEnd: 0.01, peak: 0.08, fadeEnd: 0.12 },
    ],
  },

  // 580Hz -> 440Hz tap
  reset: {
    tones: [
      { freq: 580.0, freqEnd: 440.0, start: 0, attackEnd: 0.005, peak: 0.06, fadeEnd: 0.08 },
    ],
  },

  // C4 root, G4 fifth, 528Hz and 660Hz harmonics with a 2.0s decay
  completion: {
    master: { level: 0.2, fadeEnd: 2.0 },
    tones: [
      { freq: 261.63, start: 0, peak: 0.35, fadeEnd: 1.9, floor: 0.001, stop: 2.0 },
      { freq: 392.0, start: 0.02, peak: 0.3, fadeEnd: 1.8, floor: 0.001, stop: 2.0 },
      { freq: 528.0, start: 0, peak: 0.7, fadeEnd: 1.7, floor: 0.001, stop: 2.0 },
      { freq: 660.0, start: 0.04, peak: 0.35, fadeEnd: 1.8, floor: 0.001, stop: 2.0 },
    ],
  },

  // Step checked: crisp upward chirplet (G5 -> C6, 35ms)
  stepChecked: {
    tones: [
      { freq: 784.0, freqEnd: 1046.5, start: 0, attackEnd: 0.003, peak: 0.09, fadeEnd: 0.035 },
    ],
  },

  // Step unchecked: softer downward tick (C5 -> G4, 40ms)
  stepUnchecked: {
    tones: [
      { freq: 523.25, freqEnd: 392.0, start: 0, attackEnd: 0.004, peak: 0.06, fadeEnd: 0.04 },
    ],
  },

  // E5 + B5 + C6 consonant chord over 0.65s
  habitComplete: {
    master: { level: 0.14, fadeEnd: 0.65 },
    tones: [
      { freq: 659.25, start: 0, attackEnd: 0.012, peak: 0.6, fadeEnd: 0.6, floor: 0.001, stop: 0.65 },
      { freq: 987.77, start: 0.01, attackEnd: 0.022, peak: 0.4, fadeEnd: 0.6, floor: 0.001, stop: 0.65 },
      { freq: 1046.5, start: 0.04, attackEnd: 0.055, peak: 0.5, fadeEnd: 0.65, floor: 0.001, stop: 0.65 },
    ],
  },

  // C5 featherlight tap (25ms)
  tabSwitch: {
    tones: [{ freq: 523.25, start: 0, attackEnd: 0.002, peak: 0.5, fadeEnd: 0.025 }],
  },

  // C5 -> E5 major third glide (0.20s)
  actionSuccess: {
    tones: [
      { freq: 523.25, freqEnd: 659.25, start: 0, attackEnd: 0.01, peak: 0.1, fadeEnd: 0.2 },
    ],
  },

  // G3 -> E3 soft descending release (0.18s)
  actionDelete: {
    tones: [
      { freq: 196.0, freqEnd: 164.81, start: 0, attackEnd: 0.012, peak: 0.07, fadeEnd: 0.18 },
    ],
  },
};

const DEFAULT_MASTER = { level: 1 };

// ---------------------------------------------------------------------------
// Audio context management
// ---------------------------------------------------------------------------

let audioCtx = null;

/**
 * Checks whether the Web Audio API is supported in the current environment.
 * @returns {boolean}
 */
export function isAudioSupported() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
}

/**
 * Lazily obtains or constructs the shared AudioContext instance safely in the browser.
 * @returns {AudioContext | null}
 */
export function getAudioContext() {
  if (typeof window === 'undefined') return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  return audioCtx;
}

/**
 * Resumes audio context on user interaction to satisfy browser autoplay policies.
 */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Returns the shared AudioContext, resuming it first if the browser suspended it.
 * @returns {AudioContext | null}
 */
function getReadyContext() {
  const ctx = getAudioContext();
  if (!ctx) return null;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Loudness normalization
//
// Mirrors the envelopes scheduled in scheduleTone/playCue, sample by sample,
// to find a cue's true peak. The result is cached per cue.
// ---------------------------------------------------------------------------

const normalizationCache = new Map();

/** @returns {number} Time at which a tone's oscillator stops. */
function toneStop(tone) {
  return tone.stop ?? tone.fadeEnd;
}

/** @returns {number} Tone frequency (Hz) at time t. */
function toneFrequencyAt(tone, t) {
  if (tone.freqEnd === undefined) return tone.freq;

  const progress = Math.min((t - tone.start) / (tone.fadeEnd - tone.start), 1);
  return tone.freq * (tone.freqEnd / tone.freq) ** progress;
}

/** @returns {number} Tone envelope amplitude at time t. */
function toneGainAt(tone, t) {
  const { start, attackEnd, peak, fadeEnd, floor = SILENCE } = tone;

  if (attackEnd !== undefined && t < attackEnd) {
    return SILENCE + ((peak - SILENCE) * (t - start)) / (attackEnd - start);
  }
  if (t >= fadeEnd) return floor;

  const decayStart = attackEnd ?? start;
  return peak * (floor / peak) ** ((t - decayStart) / (fadeEnd - decayStart));
}

/** @returns {number} Master envelope gain at time t. */
function masterGainAt({ level, fadeEnd }, t) {
  if (fadeEnd === undefined) return level;
  return level * (SILENCE / level) ** Math.min(t / fadeEnd, 1);
}

/**
 * Measures the highest absolute sample value a cue produces.
 * @param {{ master?: object, tones: object[] }} cue
 * @returns {number}
 */
function measureCuePeak(cue) {
  const master = cue.master ?? DEFAULT_MASTER;
  const duration = Math.max(...cue.tones.map(toneStop));
  const totalSamples = Math.ceil(duration * MEASURE_SAMPLE_RATE);
  const phases = new Array(cue.tones.length).fill(0);
  let peak = 0;

  for (let i = 0; i <= totalSamples; i++) {
    const t = i / MEASURE_SAMPLE_RATE;
    let sample = 0;

    for (let n = 0; n < cue.tones.length; n++) {
      const tone = cue.tones[n];
      if (t < tone.start || t > toneStop(tone)) continue;

      sample += toneGainAt(tone, t) * Math.sin(phases[n]);
      phases[n] += (TWO_PI * toneFrequencyAt(tone, t)) / MEASURE_SAMPLE_RATE;
    }

    peak = Math.max(peak, Math.abs(sample) * masterGainAt(master, t));
  }

  return peak;
}

/**
 * Linear gain that lifts a cue's peak to OUTPUT_CEILING.
 * @returns {number}
 */
function getNormalizationGain(cue) {
  if (!normalizationCache.has(cue)) {
    const peak = measureCuePeak(cue);
    normalizationCache.set(cue, peak > 0 ? OUTPUT_CEILING / peak : 1);
  }
  return normalizationCache.get(cue);
}

// ---------------------------------------------------------------------------
// Playback engine
// ---------------------------------------------------------------------------

/**
 * Schedules one oscillator with its envelope.
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {object} tone  Tone definition (see CUES).
 * @param {number} t0    Cue start time on the context clock.
 */
function scheduleTone(ctx, destination, tone, t0) {
  const { freq, freqEnd, start, attackEnd, peak, fadeEnd, floor = SILENCE } = tone;
  const begin = t0 + start;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';

  osc.frequency.setValueAtTime(freq, begin);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + fadeEnd);
  }

  if (attackEnd !== undefined) {
    gain.gain.setValueAtTime(SILENCE, begin);
    gain.gain.linearRampToValueAtTime(peak, t0 + attackEnd);
  } else {
    gain.gain.setValueAtTime(peak, begin);
  }
  gain.gain.exponentialRampToValueAtTime(floor, t0 + fadeEnd);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(begin);
  osc.stop(t0 + toneStop(tone));
}

/**
 * Plays a cue: tones -> master envelope -> normalization gain -> speakers.
 * @param {{ master?: object, tones: object[] }} cue
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
function playCue(cue) {
  try {
    const ctx = getReadyContext();
    if (!ctx) return false;

    const t0 = ctx.currentTime;
    const { level, fadeEnd } = cue.master ?? DEFAULT_MASTER;

    const normalizer = ctx.createGain();
    normalizer.gain.setValueAtTime(getNormalizationGain(cue), t0);
    normalizer.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.setValueAtTime(level, t0);
    if (fadeEnd !== undefined) {
      master.gain.exponentialRampToValueAtTime(SILENCE, t0 + fadeEnd);
    }
    master.connect(normalizer);

    for (const tone of cue.tones) {
      scheduleTone(ctx, master, tone, t0);
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public cues
// ---------------------------------------------------------------------------

/**
 * Synthesizes a subtle, ascending two-tone start cue (G4 -> C5).
 * Audible confirmation that a new focus session has begun.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playStartCue() {
  return playCue(CUES.start);
}

/**
 * Synthesizes a soft, brief descending inflection (E4 -> C4) for pausing an active timer.
 * Provides calm, non-punitive confirmation that focus has been paused.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playPauseCue() {
  return playCue(CUES.pause);
}

/**
 * Synthesizes a gentle, brief ascending inflection (C4 -> E4) for resuming a paused timer.
 * Distinct from fresh start; signals encouraging re-entry into the focus flow.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playResumeCue() {
  return playCue(CUES.resume);
}

/**
 * Synthesizes a restrained, clean acoustic tap (580 Hz -> 440 Hz) when a timer is genuinely reset.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playResetCue() {
  return playCue(CUES.reset);
}

/**
 * Synthesizes and plays a calm, restorative completion chime.
 * Polyphonic chord (C4, G4, 528 Hz, 660 Hz) with rich exponential decay over 2.0s.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playCompletionChime() {
  return playCue(CUES.completion);
}

/**
 * Synthesizes a subtle, tactile tick when checking or unchecking a checklist step.
 * - isChecked = true: Crisp upward chirplet (G5 784 Hz -> C6 1046.5 Hz, 35ms)
 * - isChecked = false: Softer, neutral downward tick (C5 523.25 Hz -> G4 392 Hz, 40ms)
 *
 * @param {boolean} [isChecked=true] Whether the step is transitioning to checked or unchecked.
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playStepToggleCue(isChecked = true) {
  return playCue(isChecked ? CUES.stepChecked : CUES.stepUnchecked);
}

/**
 * Synthesizes a short celebratory harmonic cue for completing an entire habit or routine.
 * Consonant chord: E5 (659.25 Hz) + B5 (987.77 Hz) -> C6 (1046.5 Hz) over 0.65s.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playHabitCompleteCue() {
  return playCue(CUES.habitComplete);
}

/**
 * Synthesizes a subtle, featherlight tap (C5 523.25 Hz, 25ms) when an in-page view tab is switched.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playTabSwitchCue() {
  return playCue(CUES.tabSwitch);
}

/**
 * Synthesizes a warm ascending major third (C5 -> E5, 0.20s) for routine creation or saving.
 * Plays only after the save operation has successfully completed.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playActionSuccessCue() {
  return playCue(CUES.actionSuccess);
}

/**
 * Synthesizes a low, soft descending release (G3 -> E3, 0.18s) when a routine is deleted.
 * Plays only after the delete operation has successfully completed.
 *
 * @returns {boolean} True if audio synthesis was successfully triggered, false otherwise.
 */
export function playActionDeleteCue() {
  return playCue(CUES.actionDelete);
}