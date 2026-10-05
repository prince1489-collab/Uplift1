// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// feelingWords.js — the words for "Feel it", the card after every kind act (3.9).
//
// ── WHY WORDS, NOT A TEXT BOX ────────────────────────────────────────────────────────────────
// Naming a feeling in a single word (affect labelling) is what quietens it and fixes the moment
// in memory — and tapping a word is three seconds where writing a sentence is a chore. So the
// card starts with words, then BUILDS the sentence: "I feel proud because…", with endings to tap.
// Recognising the right ending is far easier than recalling one from a blank page.
//
// Specific words beat "good" and "bad" (emotional granularity), and every set includes honest,
// uneasy ones — awkward, nervous, unsure. Kindness often feels awkward, and being allowed to say
// so is what keeps people doing it. Any word earns the same; an app that rewards only the
// feelings it hoped for teaches people to report those.
//
// Routes match reflectPrompts.js: "act" (someone in real life), "sent" (a stranger in the world),
// "reply" (telling someone how their words landed), "note" (a kind note to someone you follow).
// scripts/check-feelings.cjs guards the shape of everything here.

export const FEEL_WORDS = {
  act:   ["warm", "proud", "lighter", "connected", "joyful", "awkward", "nervous", "unsure"],
  sent:  ["hopeful", "warm", "curious", "lighter", "proud", "calm", "connected", "unsure"],
  reply: ["grateful", "moved", "understood", "encouraged", "warm", "connected", "lighter", "shy"],
  note:  ["warm", "close", "proud", "tender", "hopeful", "happy", "nervous", "vulnerable"],
};

// The words that mean "this was hard" — they get endings that make it fine to say so.
export const UNEASY = new Set(["awkward", "nervous", "unsure", "shy", "vulnerable"]);

// Concrete endings — one small moment each, because replaying a detail is what savouring is.
export const BECAUSE = {
  act: {
    good:   ["they smiled back", "it was easier than I thought", "I really noticed them"],
    uneasy: ["I nearly didn't do it", "I'm not used to this", "I don't know how it landed"],
  },
  sent: {
    good:   ["someone, somewhere will read it today", "it felt good to give without knowing who", "the world feels a bit smaller"],
    uneasy: ["I can't see how it lands", "I hope it reaches the right person", "it's new to me"],
  },
  reply: {
    good:   ["their words found me at the right time", "it's what I needed to hear", "someone out there gets it"],
    uneasy: ["I don't usually say this", "it felt personal to write", "I hope it doesn't sound odd"],
  },
  note: {
    good:   ["I don't say this enough", "they deserve to hear it", "it brings us closer"],
    uneasy: ["it's not something I usually say", "I wonder what they'll think", "it felt brave to send"],
  },
};

export const MAX_WORDS = 2;

export const wordsFor = (route) => FEEL_WORDS[route] || FEEL_WORDS.sent;

// Mostly-uneasy picks get the uneasy endings; a mix (proud + nervous) gets both halves.
export function endingsFor(route, words = []) {
  const set = BECAUSE[route] || BECAUSE.sent;
  if (!words.length) return set.good;
  const uneasy = words.filter((w) => UNEASY.has(w)).length;
  if (uneasy === 0) return set.good;
  if (uneasy === words.length) return set.uneasy;
  return [set.good[0], set.uneasy[0], set.good[1]];
}

const joinWords = (words) => words.length <= 1 ? (words[0] || "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

// "I feel proud and a bit nervous" reads more like a person than "proud, nervous".
export function feelPhrase(words = []) {
  return `I feel ${joinWords(words.map((w) => String(w).trim().toLowerCase()).filter(Boolean))}`;
}

export function buildSentence(words, because) {
  const b = String(because || "").trim().replace(/[.\s]+$/, "");
  return b ? `${feelPhrase(words)} because ${b}.` : `${feelPhrase(words)}.`;
}

// Played back on the done card and in Grow: "You felt proud — because you noticed them."
export function playBack(entry) {
  if (!entry?.feelings?.length) return "";
  const b = String(entry.because || "").trim().replace(/[.\s]+$/, "");
  const youB = b.replace(/\bI'm\b/g, "you're").replace(/\bI\b/g, "you").replace(/\bme\b/g, "you").replace(/\bmy\b/gi, "your");
  return `You felt ${joinWords(entry.feelings)}${youB ? ` — because ${youB}` : ""}.`;
}

// ── For the reply and note sheets (Feed2.jsx) ────────────────────────────────────────────────
// Words TO the other person: how their words (or they) made you feel. Tapping one writes the
// opening for you, and the cursor waits at the end for the rest.
export const REPLY_FEEL = ["hopeful", "calmer", "understood", "motivated", "less alone", "seen"];
export const NOTE_FEEL = ["supported", "lighter", "understood", "inspired", "at home", "cared for"];

export const replyOpening = (word) => `Your words made me feel ${word} — `;
export const noteOpening = (word) => `You make me feel ${word} — `;

// A few of THEIR words, quoted back: the most specific opening there is, and proof they were
// really read. The last clause of the message, trimmed to about six words.
export function quoteChip(text) {
  const clean = String(text || "").replace(/^[“"]|[”"]$/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const clauses = clean.split(/(?<=[.!?…,;:—])\s+|\s+(?:and|but)\s+(?=\S)/i).map((s) => s.replace(/[.!?…,;:—\s]+$/, "").trim()).filter((s) => s.split(" ").length >= 2);
  const pick = (clauses[clauses.length - 1] || clean)
    .replace(/^(?:and|but|so)\s+/i, "")
    .replace(/(?:[\s:;()]|\p{Extended_Pictographic}|️|‍)+$/u, "")
    .trim();
  const words = pick.split(" ");
  const short = words.length > 6 ? `…${words.slice(-6).join(" ")}` : pick;
  // Emoji-only or one-word messages don't make a quote worth offering.
  if (!/[a-z]{3}/i.test(short)) return null;
  return `“${short}” stayed with me because `;
}

// ── Looking back (Grow, the Sunday question) ─────────────────────────────────────────────────
// This week's words with counts, most-felt first, and the latest few sentences played back.
// `entries` are users/{uid}/feelings documents in any order; old ones without words are ignored.
export function feelingSummary(entries = [], now = Date.now(), days = 7) {
  const from = now - days * 86400000;
  const recent = entries.filter((e) => e?.feelings?.length && Number(e.createdAt) >= from)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  const counts = new Map();
  for (const e of recent) for (const w of e.feelings) counts.set(w, (counts.get(w) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
  return { top, lines: recent.slice(0, 3).map(playBack).filter(Boolean), total: recent.length };
}
