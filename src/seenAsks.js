// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// seenAsks.js — the questions Seen asks, in the pinned "Seen" conversation (3.15).
//
// ── WHAT THESE ARE FOR ───────────────────────────────────────────────────────────────────────
// Not a profile form. Each question is an invitation to say something true about your life right
// now — what's keeping you busy, what's on your mind, what you're working towards — the kind of
// thing nobody else in your day may have asked. Seen listens (one specific reply to every answer)
// and, over weeks, reflects back what seems to matter to you, with the evidence shown.
//
// ── HOW THEY'RE ASKED ────────────────────────────────────────────────────────────────────────
//   • About twice a week: a new question once the last is ANSWER_GAP_HOURS old. Never a push.
//   • Light first. Depth 2 opens after three answers, depth 3 after eight — nobody is asked
//     something tender on their first day.
//   • Areas rotate, so it never feels like a survey about one thing.
//   • Never the same question within 60 days. One swap ("Ask me something else") per question.
//   • A follow-up written from what they said last time ("How's the 10k training going?") goes
//     ahead of the bank whenever there is one — being remembered is the most "seen" moment.
// scripts/check-seen-asks.cjs guards the bank.

export const AREAS = ["lately", "mind", "towards", "challenge", "joy", "people", "matters"];
export const ANSWER_GAP_HOURS = 84; // three and a half days → about twice a week
export const NO_REPEAT_DAYS = 60;

export const QUESTIONS = [
  // ── lately ──
  { id: "busy", area: "lately", depth: 1, q: "What's been keeping you busy lately?" },
  { id: "week-shape", area: "lately", depth: 1, q: "How has this week been, honestly?" },
  { id: "new-lately", area: "lately", depth: 1, q: "What's something new in your life lately — big or small?" },
  { id: "time-goes", area: "lately", depth: 1, q: "Where does most of your time go at the moment?" },
  { id: "changed", area: "lately", depth: 2, q: "What's changed for you in the last few months?" },
  { id: "season", area: "lately", depth: 2, q: "If this season of your life had a title, what would it be?" },
  { id: "unsaid-week", area: "lately", depth: 3, q: "What happened recently that you haven't really told anyone about?" },

  // ── on your mind ──
  { id: "mind", area: "mind", depth: 1, q: "What's been on your mind recently?" },
  { id: "thinking-about", area: "mind", depth: 1, q: "What do you find yourself thinking about when it's quiet?" },
  { id: "curious", area: "mind", depth: 1, q: "What's something you've been curious about lately?" },
  { id: "deciding", area: "mind", depth: 2, q: "Is there a decision you're turning over at the moment?" },
  { id: "carrying", area: "mind", depth: 2, q: "What's something you're carrying around in your head this week?" },
  { id: "wish-understood", area: "mind", depth: 3, q: "What do you wish more people understood about how you see things?" },
  { id: "never-said", area: "mind", depth: 3, q: "What's something you've never quite said out loud about what you want?" },

  // ── working towards ──
  { id: "towards", area: "towards", depth: 1, q: "What's something you're working towards right now?" },
  { id: "learning", area: "towards", depth: 1, q: "Are you learning anything at the moment — even something small?" },
  { id: "next-month", area: "towards", depth: 1, q: "What are you looking forward to in the next month?" },
  { id: "proud-progress", area: "towards", depth: 2, q: "What's some progress you've made lately that nobody else noticed?" },
  { id: "someday", area: "towards", depth: 2, q: "What's a 'someday' plan you keep coming back to?" },
  { id: "why-matters", area: "towards", depth: 3, q: "Why does the thing you're working towards matter so much to you?" },
  { id: "future-you", area: "towards", depth: 3, q: "What would you love to be able to say about your life a year from now?" },

  // ── challenges ──
  { id: "tricky", area: "challenge", depth: 1, q: "What's been a bit tricky for you lately?" },
  { id: "tiring", area: "challenge", depth: 1, q: "What's been taking more energy than you expected?" },
  { id: "juggling", area: "challenge", depth: 2, q: "What are you juggling right now that others might not see?" },
  { id: "got-through", area: "challenge", depth: 2, q: "What's something hard you got through that you don't give yourself credit for?" },
  { id: "would-help", area: "challenge", depth: 2, q: "What would make the next week a little easier for you?" },
  { id: "quietly", area: "challenge", depth: 3, q: "What's something you're dealing with quietly at the moment?" },
  { id: "kinder-self", area: "challenge", depth: 3, q: "Where could you be a bit kinder to yourself right now?" },

  // ── small joys ──
  { id: "smile", area: "joy", depth: 1, q: "What made you smile in the last few days?" },
  { id: "small-good", area: "joy", depth: 1, q: "What's a small thing that's been good lately?" },
  { id: "recharge", area: "joy", depth: 1, q: "What helps you recharge when you get the chance?" },
  { id: "lose-time", area: "joy", depth: 2, q: "When did you last lose track of time doing something you love?" },
  { id: "grateful-for", area: "joy", depth: 2, q: "What's something you're quietly grateful for this week?" },
  { id: "most-yourself", area: "joy", depth: 3, q: "When do you feel most like yourself?" },
  { id: "alive", area: "joy", depth: 3, q: "What makes you feel most alive?" },

  // ── people ──
  { id: "on-your-side", area: "people", depth: 1, q: "Who's someone that's been on your side lately?" },
  { id: "spoke-to", area: "people", depth: 1, q: "Who's someone you enjoyed talking to this week?" },
  { id: "miss", area: "people", depth: 2, q: "Is there someone you've been missing lately?" },
  { id: "thank", area: "people", depth: 2, q: "Who's someone you've been meaning to thank?" },
  { id: "showed-up", area: "people", depth: 2, q: "Who showed up for you when it mattered?" },
  { id: "understood-by", area: "people", depth: 3, q: "Who makes you feel most understood — and how do they do it?" },
  { id: "reconnect", area: "people", depth: 3, q: "Is there a relationship you'd love to be closer than it is?" },

  // ── what matters ──
  { id: "important-now", area: "matters", depth: 1, q: "What feels most important to you at the moment?" },
  { id: "good-day", area: "matters", depth: 1, q: "What does a good day look like for you right now?" },
  { id: "care-about", area: "matters", depth: 2, q: "What's something you care about that you don't get to talk about much?" },
  { id: "stand-for", area: "matters", depth: 2, q: "What's something you'd always make time for, however busy you are?" },
  { id: "remembered", area: "matters", depth: 3, q: "What would you like the people around you to remember about you?" },
  { id: "values", area: "matters", depth: 3, q: "What matters to you more now than it did a few years ago?" },
];

const DAY = 86400000;

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// How deep Seen may go, from how many questions someone has answered.
export function maxDepth(answered) {
  if (answered >= 8) return 3;
  if (answered >= 3) return 2;
  return 1;
}

// Is it time for a new question? `chat` is the conversation, oldest first.
export function questionDue(chat = [], now = Date.now()) {
  const last = [...chat].reverse().find((m) => m.role === "seen" && m.kind === "question");
  if (!last) return true;
  return now - Number(last.createdAt || 0) >= ANSWER_GAP_HOURS * 3600000;
}

// Today's question. `asked`: [{ qid, at }] from the chat; `followUp`: { q, at } from the server's
// understanding, used first while it's fresh (two weeks) and not yet asked.
export function pickQuestion({ uid = "anon", now = Date.now(), answered = 0, asked = [], followUp = null, swap = 0 } = {}) {
  if (followUp?.q && !swap && now - Number(followUp.at || 0) < 14 * DAY && !asked.some((a) => a.qid === "followup" && a.at >= followUp.at)) {
    return { id: "followup", area: "followup", depth: 0, q: followUp.q };
  }
  const depth = maxDepth(answered);
  const recentIds = new Set(asked.filter((a) => now - a.at < NO_REPEAT_DAYS * DAY).map((a) => a.qid));
  const lastAreas = asked.slice(-2).map((a) => QUESTIONS.find((q) => q.id === a.qid)?.area).filter(Boolean);
  let pool = QUESTIONS.filter((q) => q.depth <= depth && !recentIds.has(q.id) && !lastAreas.includes(q.area));
  if (!pool.length) pool = QUESTIONS.filter((q) => q.depth <= depth && !recentIds.has(q.id));
  if (!pool.length) pool = QUESTIONS.filter((q) => q.depth <= depth);
  // Lean towards the newest depth once it opens, so the conversation actually deepens.
  const deepest = pool.filter((q) => q.depth === depth);
  const list = deepest.length && hash(`${uid}|${Math.floor(now / DAY)}`) % 2 === 0 ? deepest : pool;
  return list[hash(`${uid}|${Math.floor(now / DAY)}|${swap}`) % list.length];
}

export const FIRST_MESSAGE =
  "Hi, I'm Seen. Every few days I'll ask you a question about your life — what's keeping you busy, what's on your mind, what you're working towards. " +
  "I'll listen, and over time I'll reflect back what seems to matter to you, always with the reasons. Only you can see this.";
