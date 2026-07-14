// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// sounds.js — warm, synthesized UI sounds via the Web Audio API (NO audio files).
// Every sound is soft (sine/triangle oscillators with gentle envelopes) and drawn from one
// mellow pentatonic-ish palette so the whole app feels like a single calm instrument.
//
// Design rules:
//  - Gated by a user toggle (localStorage "seen_sound_on"); default ON.
//  - Never throws — audio must never be able to crash the app (all wrapped in try/catch).
//  - AudioContext is created lazily and resumed on first use (mobile browsers block audio
//    until a user gesture; our sounds fire from taps, so that's satisfied naturally).

let ctx = null;
let master = null;
let ambient = null; // active world-map drone, or null

const SOUND_KEY = "seen_sound_on";

export function isSoundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; } // default ON
}

export function setSoundOn(on) {
  try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  if (!on) stopMapAmbient();
  else { try { getCtx(); } catch { /* ignore */ } } // warm up on enable (user gesture)
}

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// One soft note with an attack/decay envelope.
function note(freq, { start = 0, dur = 0.3, type = "sine", peak = 0.22, attack = 0.012 } = {}) {
  const c = getCtx();
  if (!c || !master) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Only play when sound is on; never throw.
function guard(fn) {
  return (...args) => { try { if (isSoundOn()) fn(...args); } catch { /* ignore */ } };
}

// ── the palette ──────────────────────────────────────────────────────────────
export const playSend = guard(() => {                       // uplifting rising sparkle
  note(523.25, { dur: 0.5, peak: 0.2 });                    // C5
  note(659.25, { start: 0.06, dur: 0.5, peak: 0.18 });      // E5
  note(783.99, { start: 0.12, dur: 0.55, peak: 0.2 });      // G5
  note(1046.5, { start: 0.18, dur: 0.5, peak: 0.14, type: "triangle" }); // C6 shimmer
});

export const playHeart = guard(() => {                      // warm little pop
  note(587.33, { dur: 0.22, peak: 0.2, type: "triangle" });
  note(880, { start: 0.04, dur: 0.28, peak: 0.14 });
});

export const playReceive = guard(() => {                    // gentle "a message arrived"
  note(659.25, { dur: 0.3, peak: 0.12 });
  note(987.77, { start: 0.05, dur: 0.35, peak: 0.09 });
});

export const playEncourage = guard(() => {                  // warm "you were seen"
  note(523.25, { dur: 0.42, peak: 0.16 });
  note(783.99, { start: 0.08, dur: 0.46, peak: 0.14 });
});

export const playLevelUp = guard(() => {                    // joyful little arpeggio
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    note(f, { start: i * 0.09, dur: 0.5, peak: 0.18, type: "triangle" }));
});

export const playStreak = guard(() => {
  [659.25, 830.61, 987.77].forEach((f, i) =>
    note(f, { start: i * 0.08, dur: 0.45, peak: 0.16 }));
});

export const playSpark = guard(() => note(1174.66, { dur: 0.25, peak: 0.08, type: "triangle" }));

export const playFirstSend = guard(() => {                  // memorable first-kindness flourish
  [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    note(f, { start: i * 0.1, dur: 0.6, peak: 0.18, type: "triangle" }));
});

export const playMystery = guard(() => {                    // reveal sparkle
  note(880, { dur: 0.3, peak: 0.12, type: "triangle" });
  note(1318.51, { start: 0.08, dur: 0.4, peak: 0.1, type: "triangle" });
  note(1760, { start: 0.16, dur: 0.4, peak: 0.08 });
});

export const playCheckIn = guard(() => {                    // grounding resolve (wellbeing/journal)
  note(392, { dur: 0.6, peak: 0.16 });
  note(587.33, { start: 0.1, dur: 0.7, peak: 0.12 });
});

export const playArcLaunch = guard(() => note(880, { dur: 0.3, peak: 0.09, type: "triangle" }));

export const playArcLand = guard(() => {                    // soft "bloom" as kindness lands
  note(659.25, { dur: 0.4, peak: 0.11 });
  note(987.77, { start: 0.05, dur: 0.45, peak: 0.08 });
});

// ── ambient world-map soundscape: warm, slow, CIRCULAR piano lullaby ──────────
// Mood brief: a gentle steady pulse (a slow heartbeat / hammock sway); velvet-smooth,
// rounded, warm, grounded and safe; circular repetition that invites rest.
//
// A soft, rounded note: pure sine + a sub-octave for body + a faint octave for glow, with
// a SLOW click-free attack and a LONG decay so consecutive notes overlap into a legato wash
// (no sharp edges — "velvet/silk").
function warmNote(freq, { dur = 3.8, peak = 0.09, attack = 0.08 } = {}) {
  const c = getCtx();
  if (!c || !master) return;
  const t0 = c.currentTime;
  [[1, 1], [0.5, 0.45], [2, 0.1]].forEach(([mult, amp]) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    const p = peak * amp;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(p, t0 + attack);         // slow, soft swell (no attack click)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);  // long, smooth decay → notes blend
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

// A grounded, circular progression in C major (warm add9 / 7th voicings). Each chord:
// a low bass anchor + four upper tones arpeggiated gently. The loop repeats forever —
// that circular return is the point.
const PIANO_PROGRESSION = [
  { bass: 130.81, notes: [261.63, 329.63, 392.0, 587.33] }, // Cadd9 (C3 · C4 E4 G4 D5)
  { bass: 174.61, notes: [261.63, 329.63, 440.0, 523.25] }, // Fmaj7 (F3 · C4 E4 A4 C5)
  { bass: 220.0,  notes: [261.63, 329.63, 392.0, 523.25] }, // Am7   (A3 · C4 E4 G4 C5)
  { bass: 196.0,  notes: [246.94, 293.66, 392.0, 493.88] }, // G     (G3 · B3 D4 G4 B4)
];

const PIANO_PULSE_MS = 1000; // ~1s — a slow, steady heartbeat / hammock pulse

export function startMapAmbient() {
  try {
    if (!isSoundOn()) return;
    const c = getCtx();
    if (!c || !master || ambient) return;
    // A very quiet, warm low drone underneath for grounding / stability.
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.026, c.currentTime + 4);
    g.connect(master);
    const oscs = [65.41, 130.81].map((f) => {               // C2 · C3 warm foundation
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(g);
      o.start();
      return o;
    });
    const state = { g, oscs, timer: null, stopped: false };
    let chordIdx = 0;
    let step = 0;
    const tick = () => {
      if (state.stopped || !isSoundOn()) return;
      const chord = PIANO_PROGRESSION[chordIdx];
      if (step === 0) warmNote(chord.bass, { dur: 4.6, peak: 0.075 }); // grounded bass on the "one"
      warmNote(chord.notes[step % chord.notes.length]);               // gentle ascending arpeggio
      step += 1;
      if (step >= 4) { step = 0; chordIdx = (chordIdx + 1) % PIANO_PROGRESSION.length; } // circular
      state.timer = setTimeout(tick, PIANO_PULSE_MS);
    };
    state.timer = setTimeout(tick, 500);
    ambient = state;
  } catch { /* ignore */ }
}

export function stopMapAmbient() {
  try {
    if (!ambient) return;
    ambient.stopped = true;
    if (ambient.timer) clearTimeout(ambient.timer);
    if (ambient.extra) clearTimeout(ambient.extra);
    if (ambient.g && ctx) {
      const t = ctx.currentTime;
      ambient.g.gain.cancelScheduledValues(t);
      ambient.g.gain.setValueAtTime(ambient.g.gain.value, t);
      ambient.g.gain.linearRampToValueAtTime(0.0001, t + 1);
      (ambient.oscs || []).forEach((o) => o.stop(t + 1.1));
    }
    ambient = null;
  } catch { /* ignore */ }
}
