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
let pour = null;    // active watering pour, or null — at most ONE ever sounds

const SOUND_KEY = "seen_sound_on";

export function isSoundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; } // default ON
}

export function setSoundOn(on) {
  try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  if (!on) { stopMapAmbient(); stopWatering(); }
  else { try { getCtx(); preloadWatering(); } catch { /* ignore */ } } // warm up on enable (user gesture)
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
function note(freq, { start = 0, dur = 0.3, type = "sine", peak = 0.22, attack = 0.012, dest = null } = {}) {
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
  g.connect(dest || master);
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
function warmNote(freq, { start = 0, dur = 3.8, peak = 0.09, attack = 0.08 } = {}) {
  const c = getCtx();
  if (!c || !master) return;
  const t0 = c.currentTime + start;
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

// ─────────────────────────────────────────────────────────────────
// KINDNESS TREE — the pour, and the growth climb
// ─────────────────────────────────────────────────────────────────

// Water pouring. There is no noise source in this palette, so "breathy water" comes from
// five mutually inharmonic sines beating against each other, each tremolo'd at its own
// rate, through one swept lowpass. Gain fractions mirror the CSS keyframe, so the swell
// rises as the can tips and fades as it rights itself.
//
// `pour` is a module singleton: My Journey's hero tree and the Kindness Tree overlay can
// both be mounted at once (tapping the hero opens the panel), and both listen for
// "seen-points". Without this guard that's two pours at double amplitude, phase-beating.
const WATER_PEAK = 0.055; // sits under the map ambience (0.075–0.09)

// A real pour recording, if one has been shipped. Drop a file here and it is used
// automatically; if it is absent or fails to decode, the synthesized pour below plays
// instead, so the app never depends on the asset being present.
//
//   public/sounds/watering.mp3   →   served at /sounds/watering.mp3
//
// Suggested source prompt: "Clean, high-fidelity close-up recording of a gentle garden
// watering can pouring a soft, steady stream of water onto lush soil and green leaves,
// peaceful outdoor ambiance, no background noise."
// Keep it dry and loopable — it is looped to fill the pour and shaped by the envelope
// below, so any fade or room tail baked into the file will fight that shaping.
const WATER_SRC = "/sounds/watering.mp3";
let waterBuffer = null;
let waterState = "idle"; // idle | loading | ready | absent

export function preloadWatering() {
  if (waterState !== "idle") return;
  const c = getCtx();
  if (!c) return;
  waterState = "loading";
  fetch(WATER_SRC)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no file"))))
    .then((buf) => c.decodeAudioData(buf))
    .then((decoded) => { waterBuffer = decoded; waterState = "ready"; })
    .catch(() => { waterState = "absent"; }); // nothing shipped — the synth covers it
}

export const playWatering = guard((durationMs = 7000) => {
  const c = getCtx();
  if (!c || !master || pour) return; // already pouring — never stack
  preloadWatering(); // first pour uses the synth; the recording is ready from then on
  const T = durationMs / 1000;
  const t0 = c.currentTime;
  const at = (f) => t0 + T * f;

  const bus = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(600, t0);
  lp.frequency.linearRampToValueAtTime(2300, at(0.30)); // opens as it pours
  lp.frequency.linearRampToValueAtTime(2100, at(0.66));
  lp.frequency.linearRampToValueAtTime(500, at(0.80));
  lp.connect(bus);
  bus.connect(master);

  bus.gain.setValueAtTime(0.0001, t0);
  bus.gain.setValueAtTime(0.0001, at(0.13));                    // silent while the can flies in
  bus.gain.linearRampToValueAtTime(WATER_PEAK * 0.55, at(0.19)); // rises as it tips
  bus.gain.linearRampToValueAtTime(WATER_PEAK, at(0.30));
  bus.gain.linearRampToValueAtTime(WATER_PEAK * 0.88, at(0.62));
  bus.gain.linearRampToValueAtTime(WATER_PEAK * 0.72, at(0.70)); // fades as it rights
  bus.gain.exponentialRampToValueAtTime(0.0001, at(0.82));

  const oscs = [];

  if (waterBuffer) {
    // Real recording: loop it to fill the pour and let the envelope above do the shaping,
    // so it swells as the can tips and fades as it rights itself exactly like the synth.
    const src = c.createBufferSource();
    src.buffer = waterBuffer;
    src.loop = true;
    src.connect(lp);
    src.start(t0);
    src.stop(at(0.85) + 0.2);
    oscs.push(src);
    pour = { bus, oscs };
    setTimeout(() => { if (pour && pour.bus === bus) pour = null; }, durationMs + 300);
    return;
  }

  // No recording available — synthesize one. Five mutually inharmonic sines beating
  // against each other through the swept lowpass stand in for water noise.
  [[1180, 0.22, 3.1], [1490, 0.20, 4.7], [1810, 0.19, 5.9], [2230, 0.16, 7.3], [2670, 0.13, 8.9]]
    .forEach(([f, amp, lfoHz]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f * 0.94, t0);
      o.frequency.linearRampToValueAtTime(f * 1.06, at(0.45)); // slow drift = movement
      o.frequency.linearRampToValueAtTime(f * 0.96, at(0.80));
      g.gain.value = amp;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.type = "sine"; lfo.frequency.value = lfoHz; lg.gain.value = amp * 0.6;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(lp);
      o.start(t0); lfo.start(t0);
      o.stop(at(0.85) + 0.2); lfo.stop(at(0.85) + 0.2);
      oscs.push(o, lfo);
    });
  // low body — water meeting soil; bypasses the lowpass so it keeps its weight
  [[66, "sine", 0.10], [132, "triangle", 0.07]].forEach(([f, type, amp]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = amp;
    o.connect(g); g.connect(bus);
    o.start(t0); o.stop(at(0.85) + 0.2);
    oscs.push(o);
  });

  pour = { bus, oscs };
  setTimeout(() => { if (pour && pour.bus === bus) pour = null; }, durationMs + 300);
});

// Stop a pour early (mute mid-pour). Same shape as stopMapAmbient.
export function stopWatering() {
  try {
    if (!pour || !ctx) { pour = null; return; }
    const { bus, oscs } = pour;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscs.forEach((o) => { try { o.stop(now + 0.15); } catch { /* already stopped */ } });
    pour = null;
  } catch { pour = null; }
}

// C-major pentatonic, one entry per tree stage — so stage 12 always sounds like stage 12,
// whether you climbed 0→12 or 11→12.
const GROWTH_SCALE = [
  261.63, 293.66, 329.63, 392.00, 440.00,      // C4 D4 E4 G4 A4
  523.25, 587.33, 659.25, 783.99, 880.00,      // C5 D5 E5 G5 A5
  1046.50, 1174.66, 1318.51, 1567.98, 1760.00, // C6 D6 E6 G6 A6
  2093.00, 2349.32,                            // C7 D7
];

// When does the grow-from-seed replay actually cross each stage? The replay eases with
// easeOutCubic after a 12% hold, so the crossings are solvable rather than something to
// watch for: stage k is passed when eased === k / stageIdx. Pre-scheduling beats polling
// rAF because easeOutCubic puts several crossings inside a single frame near the start,
// and rAF stalls entirely if the tab is backgrounded mid-replay.
export function growthNoteTimes(stageIdx, durationMs, minGapMs = 190, cap = 9) {
  if (!stageIdx || stageIdx < 1) return [];
  const raw = [];
  for (let k = 1; k <= stageIdx; k++) {
    const u = 1 - Math.cbrt(1 - k / stageIdx); // invert easeOutCubic
    raw.push({ k, t: (0.12 + 0.88 * u) * durationMs });
  }
  const last = raw[raw.length - 1];
  const kept = [];
  for (const n of raw.slice(0, -1)) {
    if (!kept.length || n.t - kept[kept.length - 1].t >= minGapMs) kept.push(n);
  }
  while (kept.length > cap - 1) kept.splice(1, 1); // thin the dense head, keep the opener
  kept.push(last);                                 // the arrival note is never dropped
  return kept;
}

// One warm note per stage the tree passes during the replay, rising in pitch.
export const playGrowthSwell = guard((stageIdx, durationMs = 4200) => {
  growthNoteTimes(stageIdx, durationMs).forEach(({ k, t }) => {
    warmNote(GROWTH_SCALE[Math.min(k, GROWTH_SCALE.length - 1)], {
      start: t / 1000,
      dur: Math.max(1.4, 2.9 - k * 0.09),        // higher notes ring shorter
      peak: Math.max(0.038, 0.078 - k * 0.0024), // and quieter, so the top doesn't pierce
      attack: 0.09,
    });
  });
});
