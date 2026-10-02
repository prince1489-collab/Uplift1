// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// reflectPrompts.js — the ten-second question after you make someone feel seen.
//
// ── WHY NOT "HOW DID THAT FEEL?" ─────────────────────────────────────────────────────────────
// Asked every day, the same question stops being a question within a fortnight: people tap the
// first emoji without reading it, and then stop tapping. This replaces it with a small, different
// puzzle each day, and every one of them points AT THE OTHER PERSON — imagining their side,
// noticing something about them, naming who is next — because thinking about someone is the
// muscle the app is trying to build, and thinking about the app is not.
//
// Six formats, so the shape changes as well as the words:
//   imagine — picture their side of it        (tap)
//   notice  — something you saw in them        (a few words)
//   courage — what it took from you            (tap)
//   next    — who else, which seeds tomorrow   (a few words)
//   finish  — complete the sentence            (a few words)
//   surprise— what you didn't expect           (tap or words)
//
// Routes are the four ways to make someone feel seen: "sent" (a message to the world), "reply"
// (telling someone how their words landed), "note" (a kind note to someone you follow), "act"
// (someone in real life). A question only appears on the routes where it makes sense.
//
// Picked deterministically per person per day, and never the same question twice in seven days.
// scripts/check-reflect.cjs guards the shape of the bank.

const ALL = ["sent", "reply", "note", "act"];
const NAMED = ["reply", "note"];        // routes where we know who it was for
const PERSONAL = ["reply", "note", "act"]; // routes about one particular person

// `{name}` is replaced with the person's first name where the route knows it, or "them".
export const REFLECT_BANK = [
  // ── imagine ──────────────────────────────────────────────────────────────────────────────
  { id: "face", format: "imagine", routes: ALL, kind: "chips",
    q: "If you could see their face when it reached them — which one?", options: ["😊", "🥹", "😮", "😌"] },
  { id: "next-do", format: "imagine", routes: ALL, kind: "chips",
    q: "What do you think they'll do next?", options: ["Smile", "Write back", "Pass it on", "Keep it"] },
  { id: "when-read", format: "imagine", routes: ["sent", "note"], kind: "chips",
    q: "Where do you picture them reading it?", options: ["On a commute", "In bed", "On a break", "Somewhere hard"] },
  { id: "needed", format: "imagine", routes: ALL, kind: "chips",
    q: "How much do you think they needed that today?", options: ["A little", "Quite a bit", "More than they'd say"] },
  { id: "tell-friend", format: "imagine", routes: PERSONAL, kind: "chips",
    q: "Will {name} mention it to anyone?", options: ["Probably not", "Maybe", "Definitely"] },
  { id: "remember", format: "imagine", routes: PERSONAL, kind: "chips",
    q: "Will {name} remember this in a week?", options: ["No", "Maybe", "Yes", "For years"] },
  { id: "their-day", format: "imagine", routes: ALL, kind: "text",
    q: "Guess one thing about their day before this happened.", placeholder: "Long, quiet, rushed…" },

  // ── notice ───────────────────────────────────────────────────────────────────────────────
  { id: "miss", format: "notice", routes: PERSONAL, kind: "text",
    q: "What do you notice about {name} that most people miss?", placeholder: "A few words" },
  { id: "two-words", format: "notice", routes: PERSONAL, kind: "text",
    q: "Two words for the person you just made feel seen.", placeholder: "e.g. quietly brave" },
  { id: "good-at", format: "notice", routes: PERSONAL, kind: "text",
    q: "What is {name} good at that they'd never say out loud?", placeholder: "A few words" },
  { id: "why-them", format: "notice", routes: ["note", "act"], kind: "text",
    q: "Why them, today?", placeholder: "Something you'd noticed…" },
  { id: "words-chose", format: "notice", routes: ["sent", "reply", "note"], kind: "text",
    q: "Which word in what you wrote mattered most?", placeholder: "One word" },
  { id: "landed-line", format: "notice", routes: ["reply"], kind: "text",
    q: "Which of their words stayed with you?", placeholder: "A phrase" },

  // ── courage ──────────────────────────────────────────────────────────────────────────────
  { id: "nerve", format: "courage", routes: ALL, kind: "chips",
    q: "How much nerve did that take?", options: ["🌱 A little", "🌿 Some", "🌳 A lot"] },
  { id: "cost", format: "courage", routes: ALL, kind: "chips",
    q: "What did it cost you?", options: ["Time", "Courage", "Nothing at all"] },
  { id: "almost", format: "courage", routes: ALL, kind: "chips",
    q: "Did you nearly not do it?", options: ["Not at all", "For a second", "Very nearly"] },
  { id: "easier", format: "courage", routes: ALL, kind: "chips",
    q: "Is this getting easier?", options: ["Not yet", "A bit", "Much easier"] },
  { id: "stranger-scale", format: "courage", routes: ["act"], kind: "chips",
    q: "How well did you know them?", options: ["A stranger", "A little", "Very well"] },

  // ── next ─────────────────────────────────────────────────────────────────────────────────
  { id: "who-next", format: "next", routes: ALL, kind: "next",
    q: "Who else would love this? Name one person.", placeholder: "A first name" },
  { id: "overlooked", format: "next", routes: ALL, kind: "next",
    q: "Who around you gets overlooked? Name them.", placeholder: "A first name" },
  { id: "thought-of", format: "next", routes: ALL, kind: "next",
    q: "Who crossed your mind while you did this?", placeholder: "A first name" },
  { id: "owe", format: "next", routes: ALL, kind: "next",
    q: "Who have you been meaning to thank?", placeholder: "A first name" },
  { id: "quiet-one", format: "next", routes: ALL, kind: "next",
    q: "Who's gone a bit quiet lately?", placeholder: "A first name" },

  // ── finish ───────────────────────────────────────────────────────────────────────────────
  { id: "seen-when", format: "finish", routes: ALL, kind: "text",
    q: "Finish it: People feel seen when…", placeholder: "…someone remembers the small thing" },
  { id: "kindest", format: "finish", routes: ALL, kind: "text",
    q: "Finish it: The kindest thing anyone did for me was…", placeholder: "A few words" },
  { id: "i-noticed", format: "finish", routes: PERSONAL, kind: "text",
    q: "Finish it: I noticed {name} because…", placeholder: "A few words" },
  { id: "world-better", format: "finish", routes: ALL, kind: "text",
    q: "Finish it: The world would be kinder if…", placeholder: "A few words" },
  { id: "i-am", format: "finish", routes: ALL, kind: "text",
    q: "Finish it: Today I was the kind of person who…", placeholder: "A few words" },
  { id: "small", format: "finish", routes: ALL, kind: "text",
    q: "Finish it: The smallest thing that ever made my day was…", placeholder: "A few words" },

  // ── surprise ─────────────────────────────────────────────────────────────────────────────
  { id: "surprised", format: "surprise", routes: ALL, kind: "chips",
    q: "Did anything about it surprise you?", options: ["How easy it was", "How it felt", "Their reaction", "Nothing"] },
  { id: "mood-after", format: "surprise", routes: ALL, kind: "chips",
    q: "Your mood, straight after?", options: ["☀️ Lighter", "😌 Calmer", "⚡ Buzzing", "🙂 The same"] },
  { id: "again", format: "surprise", routes: ALL, kind: "chips",
    q: "Would you do exactly this again tomorrow?", options: ["Yes", "Something different", "Bigger"] },
  { id: "unexpected", format: "surprise", routes: ["act"], kind: "text",
    q: "What happened that you didn't expect?", placeholder: "A few words" },
  { id: "if-them", format: "surprise", routes: ALL, kind: "chips",
    q: "If someone did this for you, you'd feel…", options: ["Seen", "Surprised", "Grateful", "Awkward"] },
  { id: "ripple", format: "surprise", routes: ["sent"], kind: "chips",
    q: "How far do you think this one will travel?", options: ["One person", "A few", "Further than I'll know"] },
  { id: "would-reply", format: "surprise", routes: ["reply", "note"], kind: "chips",
    q: "Do you hope {name} writes back?", options: ["Not needed", "A little", "Yes!"] },
];

const HIST_KEY = "seen_reflect_hist";
const NEXT_KEY = "seen_whos_next";
const NO_REPEAT_DAYS = 7;

const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function fillName(q, name) {
  return q.replace(/\{name\}/g, name || "them");
}

// Today's question for this route. Once chosen for a day it is remembered, so reopening the
// panel asks the same thing rather than a new one each time.
// Sundays, once the week has had a few kind days in it, the question looks back over the week
// instead — the one moment in seven that asks you to compare, which is what makes a week stick.
export function weeklyLookBack(count) {
  return { id: "week", format: "surprise", routes: ALL, kind: "text",
    q: `This week you made someone feel seen on ${count} days. Which moment stuck with you?`,
    placeholder: "A few words" };
}

export function pickReflect({ uid = "anon", day, route = "sent", history = read(HIST_KEY, []), weekCount = 0, isSunday = false }) {
  if (isSunday && weekCount >= 2) return weeklyLookBack(weekCount);
  const already = history.find((h) => h.day === day);
  if (already) {
    const q = REFLECT_BANK.find((x) => x.id === already.id);
    if (q && q.routes.includes(route)) return q;
  }
  const recent = new Set(history.filter((h) => h.day !== day && daysBetween(h.day, day) < NO_REPEAT_DAYS).map((h) => h.id));
  const fits = REFLECT_BANK.filter((x) => x.routes.includes(route));
  const pool = fits.filter((x) => !recent.has(x.id));
  const list = pool.length ? pool : fits;
  return list[hash(`${uid}|${day}|${route}`) % list.length];
}

export function rememberPick(day, id) {
  const h = read(HIST_KEY, []).filter((x) => x.day !== day);
  write(HIST_KEY, [...h, { day, id }].slice(-21));
}

// ── Who's next ───────────────────────────────────────────────────────────────────────────────
// A name given today becomes tomorrow's first suggestion in the bar. Good for two days after it
// was given, then it quietly lapses — a plan that follows you around for a week is a nag.
export function setWhosNext(day, name) {
  const clean = String(name || "").trim().split(/\s+/).slice(0, 2).join(" ").slice(0, 24);
  if (clean) write(NEXT_KEY, { day, name: clean });
}

export function whosNext(today) {
  const v = read(NEXT_KEY, null);
  if (!v?.name || !v.day) return null;
  const d = daysBetween(v.day, today);
  return d >= 1 && d <= 2 ? v.name : null;
}

export function clearWhosNext() { try { localStorage.removeItem(NEXT_KEY); } catch { /* ignore */ } }

export const ROUTES = ALL;
export const NAMED_ROUTES = NAMED;
