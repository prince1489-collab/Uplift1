// JournalPrompts.js — specific, rotating prompts for the gratitude & kindness journal.
// Research shows specific prompts ("Who made you smile today?") beat a static "what are you
// grateful for?". A deterministic daily pick (day-number + per-user seed, mirroring the Life
// Hacks rotation) keeps the prompt fresh each day without repeating until the list cycles.

export const JOURNAL_PROMPTS = {
  grateful: [
    "Who made you smile today?",
    "What small beauty did you notice today?",
    "What's something your body let you do today?",
    "Who are you glad is in your life right now?",
    "What made you feel safe or comfortable recently?",
    "What's a small win from this week?",
    "What sound, smell, or taste did you enjoy today?",
    "Who helped you out lately, even in a tiny way?",
    "What's something you usually take for granted?",
    "What made you laugh recently?",
    "What part of today are you glad happened?",
    "What's a place that feels good to be in?",
    "What's something you're looking forward to?",
    "Who taught you something worth knowing?",
    "What comfort did you have today that others might not?",
    "What's a song, show, or book you're thankful for?",
    "What went better than you expected this week?",
    "What's something kind your past self did for you?",
    "Who would you thank if they were here right now?",
    "What's a small luxury you enjoyed today?",
    "What's working well in your life right now?",
    "What did nature give you today?",
    "What's a tool or thing that made your day easier?",
    "What's a memory that still warms you?",
    "Who in your life is easy to be around?",
    "What did you eat today that you enjoyed?",
    "What's something you're proud of, however small?",
    "What gave you a moment of peace today?",
    "What's a freedom or choice you're grateful to have?",
    "What's something good that you almost didn't notice?",
    "Who showed up for you when it mattered?",
    "What made today a little easier than yesterday?",
  ],
  kindness: [
    "How did you show someone you cared today?",
    "Who did you really listen to recently?",
    "What's a small act of kindness you noticed someone else do?",
    "Who could use a kind word from you this week?",
    "How did you make someone's day a little lighter?",
    "What did you share with someone lately?",
    "Who did you thank, and how?",
    "How did you help someone without being asked?",
    "What's a kindness someone did for you that you'd like to pass on?",
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
    "What act of kindness do you want to do tomorrow?",
    "Who did you comfort when they were struggling?",
    "How did you turn a small moment into a kind one?",
    "What did you do today that the world needs more of?",
  ],
};

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

// v2: one journal, one prompt a day — merge the two banks into a single "reflection" list.
const ALL_PROMPTS = [...JOURNAL_PROMPTS.grateful, ...JOURNAL_PROMPTS.kindness];

// Deterministic daily prompt for a user. `type` is legacy (per-category); "reflection"
// (or anything unknown) draws from the merged bank. `offset` lets the user cycle to another.
export function pickDailyPrompt(uid, type = "reflection", offset = 0) {
  const list = JOURNAL_PROMPTS[type] || ALL_PROMPTS;
  const raw = (dayNumber() + seedFromUid(uid) + (offset | 0)) % list.length;
  return list[((raw % list.length) + list.length) % list.length];
}
