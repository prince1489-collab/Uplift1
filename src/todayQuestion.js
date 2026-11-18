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
//
// A day keeps its question (3.36.2). 3.36.1 swapped the list in on the day it shipped, so the
// question on the screen changed mid-day and the answers already given sat under a question they
// weren't written for. So now:
//   • each list starts on a date (BANKS), and a list that has been shown is never edited or
//     reordered — a change is a new list from a day that hasn't started anywhere yet;
//   • the ids are unique across every list, so an answer's qid always finds its own words;
//   • once you've answered, the card shows the question your answer was for, and lists only the
//     answers to that same question.

// The first list (3.33 – 18 Nov 2026). Kept as it was: those days had these questions.
export const FIRST_QUESTIONS = [
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

// The simple list, from 19 Nov 2026.
export const QUESTIONS = [
  { id: "smiletoday", q: "What made you smile today?" },
  { id: "ate", q: "What's the best thing you ate today?" },
  { id: "weather", q: "What's the weather like where you are?" },
  { id: "window", q: "What can you see out of your window right now?" },
  { id: "stuck", q: "What song is stuck in your head?" },
  { id: "talked", q: "Who did you enjoy talking to today?" },
  { id: "cheers", q: "What's a little thing that always cheers you up?" },
  { id: "goodthing", q: "What's one good thing about today?" },
  { id: "thisweek", q: "What are you looking forward to this week?" },
  { id: "comfort", q: "What's your go-to comfort food?" },
  { id: "laughed", q: "What made you laugh this week?" },
  { id: "drink", q: "What's your favourite morning drink?" },
  { id: "thankful", q: "What small thing are you thankful for today?" },
  { id: "nicest", q: "What's the nicest thing you saw today?" },
  { id: "tomorrow", q: "What would make tomorrow a good day?" },
  { id: "relaxplace", q: "Where's your favourite place to relax?" },
  { id: "snack", q: "What's your favourite snack?" },
  { id: "favanimal", q: "What's your favourite animal?" },
  { id: "morningstart", q: "How did your morning start?" },
  { id: "went", q: "Where did you go today?" },
  { id: "sawkind", q: "What kind thing did you see today?" },
  { id: "seesoon", q: "Who's a friend you'd love to see soon?" },
  { id: "treat", q: "What treat would you love right now?" },
  { id: "colour", q: "What colour sums up your day?" },
  { id: "sound", q: "What's your favourite sound?" },
  { id: "season", q: "What's your favourite season?" },
  { id: "smell", q: "What smell makes you happy?" },
  { id: "film", q: "What film could you watch again and again?" },
  { id: "freetime", q: "What do you love doing in your free time?" },
  { id: "home", q: "What do you love about where you live?" },
  { id: "noticedout", q: "What did you notice outside today?" },
  { id: "familysmile", q: "Who in your family makes you smile?" },
  { id: "helpedweek", q: "Who helped you this week?" },
  { id: "dinner", q: "What's for dinner tonight?" },
  { id: "breakfast", q: "What did you have for breakfast?" },
  { id: "relax", q: "How do you like to unwind?" },
  { id: "feelgood", q: "What song always makes you feel good?" },
  { id: "win", q: "What's a small win from today?" },
  { id: "simplething", q: "What simple thing made your day better?" },
  { id: "hello", q: "Who would you like to say hello to today?" },
];

// Which list each day draws from: the last one that has started. Add a new list only with a date
// that hasn't begun anywhere in the world yet (two days ahead is safe), never edit a shown one.
export const BANKS = [
  { from: "2026-01-01", questions: FIRST_QUESTIONS },
  { from: "2026-11-19", questions: QUESTIONS },
];

const DAY = 86400000;
const EPOCH = Date.UTC(2026, 0, 1);
const keyMs = (key) => Date.parse(`${key}T12:00:00Z`);
const BY_ID = new Map(BANKS.flatMap((b) => b.questions.map((x) => [x.id, x])));

// Today's question for a local date key (YYYY-MM-DD). The same date gives everyone the same one,
// and a date's question never changes.
export function questionFor(dayKey) {
  const key = String(dayKey || "");
  const ms = keyMs(key);
  if (!Number.isFinite(ms)) return QUESTIONS[0];
  const list = [...BANKS].reverse().find((b) => key >= b.from)?.questions || BANKS[0].questions;
  const n = Math.floor((ms - EPOCH) / DAY);
  return list[((n % list.length) + list.length) % list.length];
}

// The question an answer was written for, from its qid — whichever list it came from.
export const questionById = (qid) => BY_ID.get(String(qid || "")) || null;

// The question to show on the card: once you've answered, the one your answer was for.
export const shownQuestion = (dayKey, mine = null) => questionById(mine?.qid) || questionFor(dayKey);

// Only the answers to this question (a day's answers can span two questions if the list changed).
const forQuestion = (list, qid) => (qid ? (list || []).filter((a) => !a?.qid || a.qid === qid) : list || []);

// One answer per person per day, at a fixed id (firestore.rules checks it).
export const answerIdFor = (dayKey, uid) => `${dayKey}_${uid}`;
export const MAX_ANSWER = 200;
export const SHOWN = 10;

// What someone sees after answering: other people's answers, newest first, never anyone they've
// blocked, never their own, at most SHOWN — the list ends.
export function othersAnswers(list = [], { myUid = null, blocked = null, max = SHOWN, qid = null } = {}) {
  const isBlocked = (u) => (blocked instanceof Set ? blocked.has(u) : Array.isArray(blocked) ? blocked.includes(u) : false);
  return forQuestion(list, qid)
    .filter((a) => a?.uid && a.uid !== myUid && !isBlocked(a.uid) && typeof a.text === "string" && a.text.trim())
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, max);
}

// "So far: 12 answers from 6 countries" — a line about everyone, never a comparison.
export function answersSoFar(list = [], { qid = null } = {}) {
  const rows = forQuestion(list, qid).filter((a) => a?.uid && String(a.text || "").trim());
  return { count: rows.length, countries: new Set(rows.map((a) => a.country).filter(Boolean)).size };
}

// The document an answer is saved as.
export function answerDoc({ dayKey, uid, text, firstName = null, country = null, anonymous = false, now = Date.now() }) {
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER);
  if (!clean || !uid || !dayKey) return null;
  const name = anonymous ? null : (String(firstName || "").trim().split(/\s+/)[0] || null);
  return { uid, day: dayKey, qid: questionFor(dayKey).id, text: clean, name: name ? name.slice(0, 40) : null, country: country ? String(country).slice(0, 60) : null, createdAt: now };
}
