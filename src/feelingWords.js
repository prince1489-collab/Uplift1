// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// feelingWords.js — the words for "Feel it", the card after every kind act (3.9, 3.10).
//
// ── WHY WORDS, NOT A TEXT BOX ────────────────────────────────────────────────────────────────
// Naming a feeling in a single word (affect labelling) is what quietens it and fixes the moment
// in memory — and tapping a word is three seconds where writing a sentence is a chore. So the
// card starts with words, then BUILDS the sentence: "I feel proud because…", with endings to tap.
// Recognising the right ending is far easier than recalling one from a blank page.
//
// Specific words beat "good" and "bad" (emotional granularity), and every pool includes honest,
// uneasy ones — awkward, nervous, unsure. Kindness often feels awkward, and being allowed to say
// so is what keeps people doing it. Any word earns the same; an app that rewards only the
// feelings it hoped for teaches people to report those.
//
// ── WHY IT CHANGES EVERY TIME (3.10) ─────────────────────────────────────────────────────────
// In 3.9 two messages in a row produced the identical card — same heading, same eight words in
// the same order, same endings — and a prompt that never changes stops being read within days.
// So now:
//   • each kind of act has its own voice (headings, words, endings, the line about what it did),
//     because sending into the unknown and thanking a person are different moments;
//   • words and endings are SAMPLED from larger pools, never the same set twice running;
//   • the card's SHAPE changes with how many acts of that kind you've done today — the full card
//     first, a quick row of four second, a one-tap "pulse" after that — with a reply-only shape
//     (pick a phrase of THEIR words) and a real-life-only shape (where you felt it) on alternate
//     days.
// pickFeelCard() decides all of it, deterministically per act, so reopening the sheet shows the
// same card. scripts/check-feelings.cjs guards the pools and simulates weeks of use.
//
// Routes match reflectPrompts.js: "act" (someone in real life), "sent" (a stranger in the world),
// "reply" (telling someone how their words landed), "note" (a kind note to someone you follow).

export const ROUTES = ["act", "sent", "reply", "note"];

export const FEEL_WORDS = {
  act:   ["warm", "proud", "lighter", "connected", "joyful", "brave", "calm", "alive", "grateful", "useful", "awkward", "nervous", "unsure", "shy"],
  sent:  ["hopeful", "warm", "generous", "curious", "light", "proud", "calm", "connected", "excited", "playful", "grateful", "unsure", "exposed", "nervous"],
  reply: ["grateful", "moved", "understood", "encouraged", "warm", "connected", "comforted", "inspired", "seen", "close", "lighter", "shy", "exposed", "unsure"],
  note:  ["warm", "close", "proud", "tender", "hopeful", "happy", "brave", "loving", "relieved", "grateful", "nervous", "vulnerable", "shy", "unsure"],
};

// The words that mean "this was hard" — they get endings that make it fine to say so.
export const UNEASY = new Set(["awkward", "nervous", "unsure", "shy", "vulnerable", "exposed"]);

// Concrete endings — one small moment each, because replaying a detail is what savouring is.
export const BECAUSE = {
  act: {
    good:   ["they smiled back", "it was easier than I thought", "I really noticed them", "it made their day a bit lighter", "it felt natural", "I did it without overthinking"],
    uneasy: ["I nearly didn't do it", "I'm not used to this", "I don't know how it landed", "it felt a bit forced"],
  },
  sent: {
    good:   ["someone, somewhere will read it today", "it felt good to give without knowing who", "the world feels a bit smaller", "it might be exactly what someone needs", "kindness doesn't need an address", "twenty seconds can matter"],
    uneasy: ["I can't see how it lands", "I hope it reaches the right person", "it's new to me", "writing to no one feels strange"],
  },
  reply: {
    good:   ["their words found me at the right time", "it's what I needed to hear", "someone out there gets it", "they deserve to know", "saying thank you feels good", "a stranger became someone"],
    uneasy: ["I don't usually say this", "it felt personal to write", "I hope it doesn't sound odd", "I wonder if they'll reply"],
  },
  note: {
    good:   ["I don't say this enough", "they deserve to hear it", "it brings us closer", "they've been on my mind", "it's true and now they know", "small words can mean a lot"],
    uneasy: ["it's not something I usually say", "I wonder what they'll think", "it felt brave to send", "I hope it doesn't feel awkward"],
  },
};

// Headings for the full and quick cards. `{name}` is the person, where the act has one; a
// heading that STARTS with the name is only used when there is a name.
export const STEMS = {
  act:   ["Doing that in real life felt…", "In the moment, you felt…", "Afterwards, you feel…", "Face to face, it felt…"],
  sent:  ["Sending that out into the world felt…", "Somewhere, someone's about to read it. You feel…", "Giving without knowing who felt…", "Words to a stranger. Right now you feel…"],
  reply: ["Telling {name} how their words landed felt…", "{name}'s words made you feel…", "Now {name} knows. You feel…"],
  note:  ["Saying that to {name} felt…", "Letting {name} know felt…", "A note just for {name}. You feel…"],
};

// What it did for the other person — varied too, and only ever something true.
export const CONSEQUENCES = {
  act:   ["That happened off the screen. That counts.", "Real life, real person. That counts.", "No screen needed — that was all you.", "That's {count} today, and one was face to face."],
  sent:  ["Your words are on their way — you'll see here when someone feels them.", "Somewhere, someone's about to read that.", "That's {count} today — your kindness is crossing borders.", "Out into the world it goes."],
  reply: ["Your words reached {name}.", "{name} will know their words mattered.", "You closed the loop — {name} will see it.", "That's the reply most people never send."],
  note:  ["{name} will get your note — only them.", "A private note, just for {name}.", "Not many people say it. You did.", "{name}'s day just got a little warmer."],
};

export const PULSE_STEMS = ["How did that one land for you?", "Another one — how was it?", "Quick check: how did that feel?"];
// One tap. Each face stands for a word, so Grow can count them with everything else.
export const PULSE = [
  { emoji: "😐", word: "neutral" },
  { emoji: "🙂", word: "good" },
  { emoji: "😊", word: "warm" },
  { emoji: "🥹", word: "moved" },
  { emoji: "✨", word: "glowing" },
];
export const BODY_SPOTS = ["chest", "face", "shoulders", "stomach", "nowhere really"];

export const MAX_WORDS = 2;
export const SHOW_WORDS = 8;
export const QUICK_WORDS = 4;

// ── Seeded randomness ────────────────────────────────────────────────────────────────────────
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = hash(String(seed)) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const sameSet = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

const fill = (line, { name, count } = {}) => line
  .replace(/^\{name\}/, name || "They")
  .replace(/\{name\}/g, name || "them")
  .replace(/\{count\}/g, String(count ?? ""));

// Pick one line that isn't `avoid`, from those usable with what we know.
function pickLine(lines, rand, { name, count, avoid } = {}) {
  const usable = lines.filter((l) => (!/^\{name\}/.test(l) || name) && (!/\{count\}/.test(l) || count > 1));
  const fresh = usable.filter((l) => fill(l, { name, count }) !== avoid);
  const pool = fresh.length ? fresh : usable;
  return fill(pool[Math.floor(rand() * pool.length)], { name, count });
}

// `n` words from the pool — always room to say it was hard, never a card that's mostly that:
// two uneasy words in eight, one in four. Shuffled, and never the same set as `avoid`.
function sampleWords(route, n, rand, avoid) {
  const pool = FEEL_WORDS[route] || FEEL_WORDS.sent;
  const uneasy = pool.filter((w) => UNEASY.has(w));
  const good = pool.filter((w) => !UNEASY.has(w));
  const u = n >= SHOW_WORDS ? 2 : 1;
  let pick = [];
  for (let tries = 0; tries < 6; tries++) {
    pick = shuffled([...shuffled(good, rand).slice(0, n - u), ...shuffled(uneasy, rand).slice(0, u)], rand);
    if (!sameSet(pick, avoid)) break;
  }
  return pick;
}

export const wordsFor = (route) => (FEEL_WORDS[route] || FEEL_WORDS.sent).slice(0, SHOW_WORDS);

// Mostly-uneasy picks get the uneasy endings; a mix (proud + nervous) gets both. Three, sampled
// with the card's seed so they stay put while you tap, and not the trio `avoid` you saw last.
export function endingsFor(route, words = [], seed = "", avoid = []) {
  const set = BECAUSE[route] || BECAUSE.sent;
  const uneasy = words.filter((w) => UNEASY.has(w)).length;
  const rand = rng(`${seed}|${[...words].sort().join(",")}`);
  const take = (list, k) => shuffled(list, rand).slice(0, k);
  let out;
  for (let tries = 0; tries < 6; tries++) {
    out = uneasy === 0 ? take(set.good, 3)
      : uneasy === words.length ? take(set.uneasy, 3)
      : [...take(set.good, 2), ...take(set.uneasy, 1)];
    if (!sameSet(out, avoid)) break;
  }
  return out;
}

// ── Phrases of THEIR words, for the reply-only card and the quote chip ─────────────────────
const stripEnd = (s) => s.replace(/^(?:and|but|so)\s+/i, "")
  .replace(/(?:[\s:;()]|\p{Extended_Pictographic}|️|‍)+$/u, "")
  .replace(/[.!?…,;:—\s]+$/, "").trim();

export function phrasesFrom(text, max = 3) {
  const clean = String(text || "").replace(/^[“"]|[”"]$/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.!?…,;:—])\s+|\s+(?:and|but|while)\s+(?=\S)/i).map(stripEnd)
    .filter((s) => s.split(" ").length >= 2 && /[a-z]{3}/i.test(s));
  const out = [];
  for (const p of parts) {
    const w = p.split(" ");
    const short = w.length > 6 ? `…${w.slice(-6).join(" ")}` : p;
    if (!out.includes(short)) out.push(short);
  }
  return out.slice(-max);
}

// ── The card ─────────────────────────────────────────────────────────────────────────────────
// history: the last few cards shown (rememberCard), oldest first. Its own act's entry is ignored,
// so the pick doesn't change once it has been remembered.
export function pickFeelCard({ uid = "anon", day, n = 1, route = "sent", routeCount = 1, count = n, name = null, theirText = "", history = [] }) {
  const key = `${day}_${n}`;
  const rand = rng(`${uid}|${key}|${route}`);
  const prev = [...history].reverse().find((h) => h.route === route && h.key !== key) || null;
  const alt = hash(`${uid}|${day}`) % 2 === 0; // the special shapes take turns with the full card
  const phrases = route === "reply" ? phrasesFrom(theirText) : [];

  let shape;
  if (routeCount >= 3) shape = "pulse";
  else if (routeCount === 2) shape = "quick";
  else if (route === "reply" && phrases.length >= 2 && alt) shape = "quote";
  else if (route === "act" && alt) shape = "body";
  else shape = "words";
  // Never the same full shape for the same kind of act twice running.
  if (prev && prev.shape === shape && (shape === "quote" || shape === "body")) shape = "words";
  else if (prev && prev.shape === "words" && shape === "words") {
    if (route === "reply" && phrases.length >= 2) shape = "quote";
    else if (route === "act") shape = "body";
  }

  const stem = shape === "pulse" ? pickLine(PULSE_STEMS, rand, { avoid: prev?.stem })
    : shape === "quote" ? `Which of ${name ? `${name}'s` : "their"} words stayed with you?`
    : shape === "body" ? "Where did you feel it?"
    : pickLine(STEMS[route] || STEMS.sent, rand, { name, avoid: prev?.stem });
  const words = shape === "pulse" ? [] : sampleWords(route, shape === "words" ? SHOW_WORDS : QUICK_WORDS, rand, prev?.words);
  const consequence = pickLine(CONSEQUENCES[route] || CONSEQUENCES.sent, rand, { name, count, avoid: prev?.consequence });
  return { key, route, shape, stem, words, consequence, phrases: shape === "quote" ? phrases : [], endingsAvoid: prev?.endings || [] };
}

const HIST_KEY = "seen_feel_hist";
export function readCardHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; }
}
export function rememberCard(card, endings = []) {
  try {
    const h = readCardHistory().filter((x) => x.key !== card.key);
    h.push({ key: card.key, route: card.route, shape: card.shape, stem: card.stem, words: card.words, consequence: card.consequence, endings });
    localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-12)));
  } catch { /* ignore */ }
}

// ── Sentences ────────────────────────────────────────────────────────────────────────────────
const joinWords = (words) => words.length <= 1 ? (words[0] || "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

// "I feel proud and a bit nervous" reads more like a person than "proud, nervous".
export function feelPhrase(words = []) {
  return `I feel ${joinWords(words.map((w) => String(w).trim().toLowerCase()).filter(Boolean))}`;
}

export function buildSentence(words, because) {
  const b = String(because || "").trim().replace(/[.\s]+$/, "");
  return b ? `${feelPhrase(words)} because ${b}.` : `${feelPhrase(words)}.`;
}

// The sentence for each shape, in the first person — what's stored and what the journal gets.
export function sentenceFor(shape, { words = [], because = "", body = "", quote = "", pulse = null } = {}) {
  if (shape === "pulse" && pulse) return `That one landed: ${pulse.emoji} ${pulse.word}.`;
  if (shape === "body") {
    const where = body && body !== "nowhere really" ? `I felt it in my ${body}` : "I didn't feel it anywhere in particular";
    return words.length ? `${where} — ${joinWords(words)}.` : `${where}.`;
  }
  if (shape === "quote" && quote) return `“${quote}” stayed with me${words.length ? ` — it made me feel ${joinWords(words)}` : ""}.`;
  return buildSentence(words, because);
}

const toYou = (s) => s.replace(/\bI'm\b/g, "you're").replace(/\bI\b/g, "you").replace(/\bme\b/g, "you").replace(/\bmy\b/gi, "your");

// Played back on the done card and in Grow: "You felt proud — because you noticed them."
export function playBack(entry) {
  if (!entry?.feelings?.length) return "";
  if (entry.shape === "pulse" && entry.pulse) return `That one landed: ${entry.pulse} ${entry.feelings[0]}.`;
  if ((entry.shape === "body" || entry.shape === "quote") && entry.sentence) {
    return toYou(entry.sentence).replace(/^(.)/, (c) => c.toUpperCase());
  }
  const b = String(entry.because || "").trim().replace(/[.\s]+$/, "");
  const youB = toYou(b);
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
  const p = phrasesFrom(text, 1)[0]
    ?? stripEnd(String(text || "").replace(/^[“"]|[”"]$/g, "").trim());
  if (!p || !/[a-z]{3}/i.test(p)) return null;
  return `“${p}” stayed with me because `;
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
