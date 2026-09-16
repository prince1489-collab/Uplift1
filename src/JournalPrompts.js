// JournalPrompts.js — specific, rotating prompts for the Reflect tab.
//
// Research shows specific prompts ("Who made you smile today?") beat a static "what are you
// grateful for?". A deterministic daily pick (day-number + per-user seed, mirroring the Life
// Hacks rotation) keeps the prompt fresh each day without repeating until the list cycles.
//
// ── THREE BANKS, BECAUSE A QUESTION HAS AN HOUR ──────────────────────────────────────────────
// Every prompt in this file used to look BACKWARDS. Counted: 79% carried a past-tense verb and
// 28% said "today" outright, and only eight of the eighty-eight could be answered before the day
// had happened.
//
// That was fine in a tab you open at night. It is not what the app does — the one notification
// Seen sends lands at nine in the morning, and a recording of a real session at 07:30 opens
// Reflect to "What small thing did you do that you hope made a difference?" At half past seven
// the honest answer is "nothing yet, I have just woken up", and the cost of that is not a worse
// entry, it is no entry: the tab asks for something the person does not have and they close it.
//
// So the old bank became EVENING, unchanged and still good at its job; a MORNING bank was written
// to face the other way, asking what you INTEND or what is true RIGHT NOW; and the prompts that
// turned out to belong to neither hour — the ones about memory — were pulled into an ANYTIME bank
// and mixed into both, rather than written out twice and left to drift apart.
//
// Morning draws from 54 prompts, evening from 84, and no prompt appears in two banks. Both are
// asserted by scripts/check-journal-prompts.cjs, because a prompt quietly landing in the wrong
// bank is invisible until somebody is asked at breakfast what they did with their day.
//
// The hour is not the only thing that decides: someone can pin a morning question and answer it
// at night ("hold this thought" in Journal.jsx), which is the case this split exists to serve.

// ── Evening: looking back on a day that happened ─────────────────────────────────────────────
export const JOURNAL_PROMPTS = {
  grateful: [
    "What went better than you expected today?",
    "Who made today easier?",
    "What would you tell someone having the day you just had?",
    "What did you get through that you were dreading?",
    "What's one thing you'd do again tomorrow?",
    "Who crossed your mind today, and why?",
    "What was the best five minutes of your day?",
    "What did someone say to you today that stuck?",
    "What did you decide today that you're glad about?",
    "What's one thing today that was easier than it used to be?",
    "Where did you notice you'd changed?",
    "What were you doing the last time you lost track of time?",
    "Who made you smile today?",
    "What small beauty did you notice today?",
    "What's something your body let you do today?",
    "What made you feel safe or comfortable recently?",
    "What sound, smell, or taste did you enjoy today?",
    "Who helped you out lately, even in a tiny way?",
    "What's something you usually take for granted?",
    "What made you laugh recently?",
    "What part of today are you glad happened?",
    "What comfort did you have today that others might not?",
    "What surprised you this week?",
    "What's a small luxury you enjoyed today?",
    "What did nature give you today?",
    "What's a tool or thing that made your day easier?",
    "What did you eat today that you enjoyed?",
    "What's something you're proud of, however small?",
    "What gave you a moment of peace today?",
    "What's something good that you almost didn't notice?",
    "What made today a little easier than yesterday?",
  ],
  kindness: [
    "Who did you give your full attention to today?",
    "What did you let go of that you could have made a point of?",
    "Who would say you made their day easier?",
    "What did you say yes to that you'd usually avoid?",
    "Where were you more patient than you felt?",
    "Who did you think of and actually tell?",
    "What did you do today that nobody will know about?",
    "Who needed you to just listen, and did you?",
    "What did you notice someone else doing kindly?",
    "Where did you choose the generous reading of someone?",
    "Who did you thank for something ordinary?",
    "What would you do differently if today started again?",
    "How did you show someone you cared today?",
    "Who did you really listen to recently?",
    "What's a small act of kindness you noticed someone else do?",
    "How did you make someone's day a little lighter?",
    "What did you share with someone lately?",
    "Who did you thank, and how?",
    "How did you help someone without being asked?",
    "How did you make someone feel seen today?",
    "Who did you check in on recently?",
    "What did you do for a stranger, however small?",
    "How were you kind to yourself today?",
    "Who did you forgive, or want to?",
    "What's something generous you did this week?",
    "How did you make someone laugh or smile?",
    "Who did you encourage when they doubted themselves?",
    "What did you give your time or attention to?",
    "How did you include someone who might have felt left out?",
    "What's a gentle thing you said to someone today?",
    "Who did you help feel less alone?",
    "How did you show patience with someone?",
    "What did you do to make a space kinder for others?",
    "Who did you celebrate this week?",
    "How did you respond kindly when it was hard to?",
    "What small thing did you do that you hope made a difference?",
    "Who did you reach out to first?",
    "How did you say thank you in a way that mattered?",
    "Who did you comfort when they were struggling?",
    "How did you turn a small moment into a kind one?",
    "What did you do today that the world needs more of?",
  ],
};

// ── Morning: answerable before anything has happened yet ─────────────────────────────────────
// Three kinds of question, none of which need a finished day: what you INTEND, what is true RIGHT
// NOW, and what you already REMEMBER. Written in the same voice as the evening bank — short,
// specific, never instructing anyone how to live.
export const MORNING_PROMPTS = [
  // Intention
  "Who could use a kind word from you today?",
  "What would make today feel like a good one?",
  "What act of kindness do you want to do today?",
  "Who are you hoping to see today?",
  "What's one thing you'd like to have finished by tonight?",
  "Who have you been meaning to message?",
  "What would you like to be more patient about today?",
  "What's the first kind thing you could do this morning?",
  "Who might be having a harder day than they let on?",
  "What do you want to give your full attention to today?",
  "What's one thing you could let go of before it starts?",
  "Who would you like to thank today, if you get the chance?",
  "What would make today easier for someone you live or work with?",
  "What's a small thing you could do now that tonight-you would thank you for?",
  "What are you looking forward to?",
  "What's one thing you'd like to be kinder to yourself about today?",
  "Who could you check in on this week?",
  "What would you like today to be about?",
  // True right now
  "Who are you glad is in your life right now?",
  "What's working well in your life right now?",
  "What are you carrying into today that you could put down?",
  "How are you, actually?",
  "What's something you're better at than you were a year ago?",
  "What's one thing you don't have to worry about today?",
  "What does your body need from you today?",
  "What's something you have that you once hoped for?",
  "Where in your life are you being looked after?",
  "What's true today that wasn't true a year ago?",
  "What's a small win from this week?",
  "What feels steady at the moment?",
];

// ── Anytime: memory, which has no hour ───────────────────────────────────────────────────────
// These belong to both banks, so rather than writing them out twice they live once and are mixed
// into whichever list is being drawn from. A memory prompt is as answerable at seven in the
// morning as at ten at night, and that is the only property that decides which bank a prompt
// belongs to.
export const ANYTIME_PROMPTS = [
  "Who would you thank if they were here right now?",
  "What's a memory that still warms you?",
  "What's something kind your past self did for you?",
  "Who taught you something worth knowing?",
  "Who in your life is easy to be around?",
  "What's a place that feels good to be in?",
  "What's a song, show, or book you're thankful for?",
  "What's a kindness someone did for you that you'd like to pass on?",
  "Who showed up for you when it mattered?",
  "What's the kindest thing anyone has ever said to you?",
  "What did someone once do for you that you've never told them about?",
  "Who knew you before you were who you are now?",
];

// Local calendar day number (increments at LOCAL midnight) — same rotation clock as Life
// Hacks, so the prompt refreshes exactly once a day, at the user's own midnight (not UTC).
function dayNumber() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

function seedFromUid(uid) {
  let h = 0;
  const s = String(uid || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// v2: one journal, one prompt a day — merge the two evening banks into a single list.
const EVENING = [...JOURNAL_PROMPTS.grateful, ...JOURNAL_PROMPTS.kindness, ...ANYTIME_PROMPTS];
const MORNING = [...MORNING_PROMPTS, ...ANYTIME_PROMPTS];

// After this hour the day is far enough along to look back on. Four in the afternoon rather than
// six: the point is to catch somebody before their evening, not to wait until it is over.
export const EVENING_FROM = 16;

export function isEveningNow(now = new Date()) {
  return now.getHours() >= EVENING_FROM;
}

// Deterministic daily prompt for a user.
//
// `evening` picks the bank; passing it explicitly rather than reading the clock in here is what
// lets a PINNED morning question survive into the night — see "hold this thought" in Journal.jsx.
// `offset` lets the user cycle to another (three a day; see the note at the swap link).
//
// `type` is legacy, from when Reflect had separate gratitude and kindness journals. A caller
// naming one still gets that bank, which keeps any old entry's prompt resolvable.
export function pickDailyPrompt(uid, type = "reflection", offset = 0, evening = true) {
  const list = JOURNAL_PROMPTS[type] || (evening ? EVENING : MORNING);
  const raw = (dayNumber() + seedFromUid(uid) + (offset | 0)) % list.length;
  return list[((raw % list.length) + list.length) % list.length];
}
