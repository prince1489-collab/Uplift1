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
// The questions are about other people and small good things — never about how you're doing in
// a way that could feel like a check-up, never anything sensitive, never guilt. Each ends in "?"
// and stays under 90 characters (scripts/test-today-question.mjs).

export const QUESTIONS = [
  { id: "eased", q: "Who made your week a little easier?" },
  { id: "smile", q: "What small thing made you smile today?" },
  { id: "grateful", q: "Who's someone you're quietly grateful for?" },
  { id: "stranger", q: "What's a kind thing a stranger once did for you?" },
  { id: "forward", q: "What's one thing you're looking forward to?" },
  { id: "taught", q: "Who taught you something you still use?" },
  { id: "better", q: "What made today a bit better?" },
  { id: "thank", q: "Who would you thank today, if you could?" },
  { id: "noticed", q: "What did you notice today that most people would miss?" },
  { id: "kindword", q: "What's the kindest thing anyone has said to you?" },
  { id: "place", q: "Where's a place that always makes you feel at home?" },
  { id: "laugh", q: "Who made you laugh recently?" },
  { id: "small", q: "What's a small kindness you saw this week?" },
  { id: "mentor", q: "Who believed in you before you did?" },
  { id: "song", q: "What song lifts you up when you need it?" },
  { id: "proud", q: "What's something you did recently that you're glad you did?" },
  { id: "neighbour", q: "Who's a neighbour or local face you're glad is around?" },
  { id: "advice", q: "What's the best advice anyone ever gave you?" },
  { id: "simple", q: "What simple pleasure do you never get tired of?" },
  { id: "friend", q: "Who's a friend you'd like to hear from soon?" },
  { id: "morning", q: "What's a good way to start a day, for you?" },
  { id: "helped", q: "When did someone help you without being asked?" },
  { id: "teacher", q: "Which teacher do you still remember, and why?" },
  { id: "meal", q: "What meal reminds you of someone you love?" },
  { id: "outside", q: "What did you enjoy outside recently?" },
  { id: "patient", q: "Who's been patient with you lately?" },
  { id: "tradition", q: "What's a small tradition that matters to you?" },
  { id: "kindself", q: "What's a kind thing you could do for someone tomorrow?" },
  { id: "family", q: "Who in your family makes things feel lighter?" },
  { id: "learned", q: "What's something new you learned this week?" },
  { id: "unsung", q: "Who's an unsung helper in your life?" },
  { id: "word", q: "What word would you use for today, and why?" },
  { id: "worked", q: "Who at work, school or home made a difference this week?" },
  { id: "memory", q: "What's a happy memory that came back to you recently?" },
  { id: "cheer", q: "What would cheer up a friend having a hard week?" },
  { id: "animal", q: "What animal, pet or creature made your day better?" },
  { id: "book", q: "What book, film or show made you feel less alone?" },
  { id: "calm", q: "Where do you go, or what do you do, to feel calm?" },
  { id: "phonecall", q: "Who's a call or message you were glad to get?" },
  { id: "pass", q: "What's a kindness you received that you'd like to pass on?" },
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
