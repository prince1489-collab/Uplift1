// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// todayQuestion.js — one question a day, the same for everyone (3.33).
//
// A reason to come back tomorrow that isn't a feed. You answer in a sentence — typed or said —
// and then see how people around the world answered, signed with a first name and a flag; a
// heart reaches them, and "Tell them" sends a private word. It ends: "New question tomorrow."
// Every answer is the content, so it works with seventy people as well as seventy thousand, and
// what it asks for is the good in someone's day, so what it shows is too.
//
// The questions are easy to answer and light (3.36.1). The founder: they "need to be very simple
// and generic, very easy to answer and engaging". The first bank was safe but often hard — it
// dug into the past ("the best advice anyone ever gave you"), went deep ("who believed in you
// before you did"), or asked two things ("…and why?"). So each question now:
//   • is about today or right now, or something everyday and concrete (a food, a song, a place);
//   • can be answered in a few words, without having to think hard;
//   • asks one thing, in under 60 characters, and ends in "?";
//   • never digs into the past, asks for a plan, or touches anything sensitive or guilt-shaped.
// scripts/test-today-question.mjs checks each of these.

export const QUESTIONS = [
  { id: "smile", q: "What made you smile today?" },
  { id: "ate", q: "What's the best thing you ate today?" },
  { id: "weather", q: "What's the weather like where you are?" },
  { id: "window", q: "What can you see out of your window right now?" },
  { id: "stuck", q: "What song is stuck in your head?" },
  { id: "talked", q: "Who did you enjoy talking to today?" },
  { id: "cheers", q: "What's a little thing that always cheers you up?" },
  { id: "goodthing", q: "What's one good thing about today?" },
  { id: "forward", q: "What are you looking forward to this week?" },
  { id: "comfort", q: "What's your go-to comfort food?" },
  { id: "laugh", q: "What made you laugh this week?" },
  { id: "drink", q: "What's your favourite morning drink?" },
  { id: "thankful", q: "What small thing are you thankful for today?" },
  { id: "nicest", q: "What's the nicest thing you saw today?" },
  { id: "tomorrow", q: "What would make tomorrow a good day?" },
  { id: "relaxplace", q: "Where's your favourite place to relax?" },
  { id: "snack", q: "What's your favourite snack?" },
  { id: "animal", q: "What's your favourite animal?" },
  { id: "morning", q: "How did your morning start?" },
  { id: "went", q: "Where did you go today?" },
  { id: "sawkind", q: "What kind thing did you see today?" },
  { id: "friend", q: "Who's a friend you'd love to see soon?" },
  { id: "treat", q: "What treat would you love right now?" },
  { id: "colour", q: "What colour sums up your day?" },
  { id: "sound", q: "What's your favourite sound?" },
  { id: "season", q: "What's your favourite season?" },
  { id: "smell", q: "What smell makes you happy?" },
  { id: "film", q: "What film could you watch again and again?" },
  { id: "freetime", q: "What do you love doing in your free time?" },
  { id: "home", q: "What do you love about where you live?" },
  { id: "outside", q: "What did you notice outside today?" },
  { id: "family", q: "Who in your family makes you smile?" },
  { id: "helped", q: "Who helped you this week?" },
  { id: "dinner", q: "What's for dinner tonight?" },
  { id: "breakfast", q: "What did you have for breakfast?" },
  { id: "relax", q: "How do you like to unwind?" },
  { id: "feelgood", q: "What song always makes you feel good?" },
  { id: "win", q: "What's a small win from today?" },
  { id: "simple", q: "What simple thing made your day better?" },
  { id: "hello", q: "Who would you like to say hello to today?" },
];

const DAY = 86400000;
const EPOCH = Date.UTC(2026, 0, 1);
const keyMs = (key) => Date.parse(`${key}T12:00:00Z`);

// Today's question for a local date key (YYYY-MM-DD). The same date gives everyone the same one.
export function questionFor(dayKey) {
  const ms = keyMs(String(dayKey || ""));
  if (!Number.isFinite(ms)) return QUESTIONS[0];
  const n = Math.floor((ms - EPOCH) / DAY);
  return QUESTIONS[((n % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length];
}

// One answer per person per day, at a fixed id (firestore.rules checks it).
export const answerIdFor = (dayKey, uid) => `${dayKey}_${uid}`;
export const MAX_ANSWER = 200;
export const SHOWN = 10;

// What someone sees after answering: other people's answers, newest first, never anyone they've
// blocked, never their own, at most SHOWN — the list ends.
export function othersAnswers(list = [], { myUid = null, blocked = null, max = SHOWN } = {}) {
  const isBlocked = (u) => (blocked instanceof Set ? blocked.has(u) : Array.isArray(blocked) ? blocked.includes(u) : false);
  return (list || [])
    .filter((a) => a?.uid && a.uid !== myUid && !isBlocked(a.uid) && typeof a.text === "string" && a.text.trim())
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, max);
}

// "So far: 12 answers from 6 countries" — a line about everyone, never a comparison.
export function answersSoFar(list = []) {
  const rows = (list || []).filter((a) => a?.uid && String(a.text || "").trim());
  return { count: rows.length, countries: new Set(rows.map((a) => a.country).filter(Boolean)).size };
}

// The document an answer is saved as.
export function answerDoc({ dayKey, uid, text, firstName = null, country = null, anonymous = false, now = Date.now() }) {
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER);
  if (!clean || !uid || !dayKey) return null;
  const name = anonymous ? null : (String(firstName || "").trim().split(/\s+/)[0] || null);
  return { uid, day: dayKey, qid: questionFor(dayKey).id, text: clean, name: name ? name.slice(0, 40) : null, country: country ? String(country).slice(0, 60) : null, createdAt: now };
}
