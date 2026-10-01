// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// hytState.js — today's Practice record, shared by the Practice tab and the Today card.
//
// ONE record, two screens. The Today card on Connect shows the kindness slot of the same daily
// pick Practice shows, and ticking it in either place must show as ticked in the other — two
// copies of "did you do it?" that can disagree is the fastest way to make both feel untrustworthy.
// So both read and write the same `seen_hyt_state_{day}` key, and both complete an act through
// completeSlot() below, which is the only place the side effects of "I did it" live.
//
// Per-device, like everything else Practice keeps.

import { playCheckIn } from "./sounds";
import { awardPoints } from "./points";
import { markDone } from "./invitations";

export const SLOTS = ["kindness", "self"];

// Before this hour, self-care prompts that can only be acted on at night are held back — see
// SELF_EVENING_ONLY in hytPrompts.js. Five in the afternoon, so "tonight" is close enough to be
// a plan rather than a thing eight hours away.
export const EVENING_FROM = 17;

export const stateKey = (day) => `seen_hyt_state_${day}`;
const EVENT = "seen-hyt-state";

export const loadJSON = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};

// ── The evening flag is decided ONCE, on the first open of the day, and then stored ───────────
// It would be simpler to read the clock on every render, and wrong: someone who looks at eight in
// the morning and comes back at eight in the evening would find a different task waiting, with
// their morning one gone. A prompt that changes under you is worse than one slightly early.
export function loadDayState(day) {
  return loadJSON(stateKey(day), null)
    ?? { done: {}, swaps: {}, planned: {}, evening: new Date().getHours() >= EVENING_FROM };
}

// Announced as well as stored, so a second mounted reader (should there ever be one) follows.
export function saveDayState(day, next) {
  try { localStorage.setItem(stateKey(day), JSON.stringify(next)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { day, state: next } })); } catch { /* ignore */ }
}

export function onDayState(fn) {
  const h = (e) => fn(e.detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

// Everything that happens when somebody says they did it, in one place. Returns the next state;
// the caller stores it. `onKindAct` counts the day as shown up (activeDays, certificates); a kept
// plan clears tonight's cue so no reminder arrives about something already done.
export function completeSlot(state, slot, { onKindAct, onPlanChange } = {}) {
  if (state.done?.[slot]) return state;
  try { playCheckIn(); } catch { /* ignore */ }
  awardPoints("practice");
  try { onKindAct?.(); } catch { /* ignore */ }
  try { markDone("practice"); } catch { /* ignore */ }
  if (state.planned?.[slot]) { try { onPlanChange?.(null); } catch { /* ignore */ } }
  const done = { ...state.done, [slot]: true };
  if (SLOTS.every((s) => done[s]) && !state.bonus) {
    awardPoints("practiceAll");
    return { ...state, done, bonus: true };
  }
  return { ...state, done };
}

// Turn a stored dob string ("January 5, 1990") into an age; null if unknown.
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
export function ageFromDob(dob) {
  if (!dob) return null;
  const [m = "", d = "", y = ""] = String(dob).replace(",", "").split(" ");
  const mi = MONTHS.indexOf(m);
  const year = Number(y);
  if (mi < 0 || !year) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const bd = new Date(now.getFullYear(), mi, Number(d) || 1);
  if (now < bd) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
