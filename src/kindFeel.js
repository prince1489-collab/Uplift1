// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// kindFeel.js — "How did that feel?", asked by Seen, about one real act (3.29).
//
// The "Feel it" card used to open after kind acts — after every one, then weekly — and was
// skipped in recording after recording; the founder called it tedious, and 3.28 removed it. The
// question was right; the moment was wrong. Straight after an act, someone is getting on with
// their day. A day or two later, in the conversation with Seen, it's a real question about a real
// thing: "On Tuesday your words reached someone in Algeria. How did sending them feel?"
//
// So, at most once a week, when Seen is due to ask its next question anyway (seenChat.js — no
// extra notifications), it asks about the newest act from the kindness log (kindLog.js) that
// hasn't been asked about, with five one-tap answers and room to say more. The answer is an answer
// to Seen like any other, so it becomes part of what Seen understands; it's also kept on the log
// entry (`feeling`), so the Grow tab can say how that act felt.

import { inPlace } from "./kindLog.js";

export const FEEL_OPTIONS = ["Warm", "Proud", "Lighter", "Nervous", "Not much"];
export const KIND_FEEL_GAP_MS = 7 * 86400000;
const WINDOW_MS = 7 * 86400000;
const ASKABLE = new Set(["sent", "reply", "note", "act"]); // not a heart — too small to ask about
export const KIND_FEEL_PREFIX = "kindfeel:";

// "Today", "Yesterday", "On Tuesday" — the act's day, in the reader's calendar.
export function whenLabel(at, now = Date.now()) {
  const d = new Date(Number(at)), n = new Date(now);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `On ${d.toLocaleDateString("en-GB", { weekday: "long" })}`;
}

const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const stripEnd = (s) => String(s || "").trim().replace(/[.!?]+$/, "");

export function kindFeelText(e, now = Date.now()) {
  const when = whenLabel(e.at, now);
  const who = e.toName || null;
  switch (e.route) {
    case "sent": return e.delivered || e.country
      ? `${when}, your words reached someone in ${inPlace(e.country) || "the world"}. How did sending them feel?`
      : `${when}, you sent kind words to someone in the world. How did that feel?`;
    case "reply": return `${when}, you told ${who || "someone"} how their words landed. How did that feel?`;
    case "note": return `${when}, you sent ${who || "someone"} a kind note. How did that feel?`;
    case "act": return e.text
      ? `${when}, you did something kind in real life — ${lowerFirst(stripEnd(e.text))}. How did that feel?`
      : `${when}, you made ${who || "someone"} feel seen in real life. How did that feel?`;
    default: return null;
  }
}

// The question to ask now, or null. `entries` is the kindness log (newest first, with ids);
// `chat` is the Seen conversation.
export function kindFeelQuestion({ entries = [], chat = [], now = Date.now() } = {}) {
  const asked = (chat || []).filter((m) => m?.role === "seen" && m.kind === "question" && String(m.qid || "").startsWith(KIND_FEEL_PREFIX));
  if (asked.some((m) => now - Number(m.createdAt) < KIND_FEEL_GAP_MS)) return null;
  const askedIds = new Set(asked.map((m) => String(m.qid).slice(KIND_FEEL_PREFIX.length)));
  const e = (entries || [])
    .filter((x) => x?.id && ASKABLE.has(x.route) && !x.feeling && !askedIds.has(x.id)
      && now - Number(x.at) >= 0 && now - Number(x.at) < WINDOW_MS)
    .sort((a, b) => Number(b.at) - Number(a.at))[0];
  if (!e) return null;
  const q = kindFeelText(e, now);
  return q ? { id: `${KIND_FEEL_PREFIX}${e.id}`, q: q.slice(0, 400), options: FEEL_OPTIONS, entryId: e.id } : null;
}

// Which log entry an answered question was about, if it was one of these.
export const kindFeelEntryId = (qid) => (String(qid || "").startsWith(KIND_FEEL_PREFIX) ? String(qid).slice(KIND_FEEL_PREFIX.length) : null);
