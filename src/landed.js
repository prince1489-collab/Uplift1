// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// landed.js — when "Tell {name} how their words landed" is worth offering (3.22).
//
// The bar used to offer the newest thing anyone you follow had posted, hearted ones first. For
// most people that is a family member's daily greeting — "Ram Ram good morning 😊🙏", every day —
// so the option was the same person and the same words each morning, asking how "good morning"
// landed. There is no honest answer to that beyond "it was nice", the heart had already said it,
// and the option became wallpaper. Now it is offered only when words could actually have landed:
//
//   • never a routine greeting ("good morning", "happy Monday", "have a great day") — the heart
//     is the right answer to those, and since 3.21 it counts as the day's kind act;
//   • never something that repeats what the same person has posted before (their usual line);
//   • never the same person two days running.
//
// When nothing qualifies the option is simply not there. Missing beats forced.

// Lower case, emoji and punctuation gone, single spaces: "Ram Ram good morning 😊🙏" and
// "Ram ram good morning 😊❤️" are the same line.
export function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPENERS = "(?:ram ram|jai shri \\p{L}+|jai siya ram|radhe radhe|namaste|namaskar|salaam|hi|hello|hey|morning|good day)";
const GREETING = new RegExp(
  "^(?:" + OPENERS + " )*" +
  "(?:" +
    "good (?:morning|afternoon|evening|night|day)" +
    "|(?:happy|blessed) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|week|day)" +
    "|have a (?:good|great|nice|lovely|wonderful|blessed|happy) (?:day|evening|night|weekend|week|one)" +
    "|" + OPENERS +
  ")" +
  "(?: (?:everyone|everybody|all|friends|family|ji|maa|ma|mum|mom|dad|papa|beta|dear|my friends|to all|to you all))*$",
  "u"
);

// A short message that is only a greeting.
export function isRoutineGreeting(text) {
  const t = normalizeText(text);
  if (!t || t.split(" ").length > 8) return false;
  return GREETING.test(t);
}

// The same person has posted the same line before — their usual, not something new.
export function repeatsTheirUsual(message, messages) {
  const line = normalizeText(message?.text);
  if (!line) return false;
  return (messages || []).some((m) => m && m.id !== message.id && m.uid === message.uid
    && Number(m.timestamp) < Number(message.timestamp) && normalizeText(m.text) === line);
}

export function couldHaveLanded(message, messages) {
  return Boolean(message?.text) && !isRoutineGreeting(message.text) && !repeatsTheirUsual(message, messages);
}

// ── Never the same person two days running ───────────────────────────────────────────────────
// Who the bar offered, per local day, on this device.
const OFFER_KEY = "seen_landed_offer";
export function readLandedOffer() {
  try { return JSON.parse(localStorage.getItem(OFFER_KEY) || "null"); } catch { return null; }
}
export function rememberLandedOffer(day, uid) {
  try {
    const prev = readLandedOffer();
    if (prev?.day === day) return; // the first offer of the day is the one that counts
    localStorage.setItem(OFFER_KEY, JSON.stringify({ day, uid, prev: prev ? { day: prev.day, uid: prev.uid } : null }));
  } catch { /* storage blocked */ }
}
// The person offered on `yesterday`, if any — they are skipped today.
export function offeredOn(record, day) {
  if (!record) return null;
  if (record.day === day) return record.uid ?? null;
  if (record.prev?.day === day) return record.prev.uid ?? null;
  return null;
}
