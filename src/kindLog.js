// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// kindLog.js — a private record of every kind act (3.29).
//
// Seen kept counts (greetingsSentCount, seenRepliesSent, seenActsDone) and, since 3.9, a "Feel it"
// entry when someone answered the card after an act. It never kept the ACTS: who you wrote to,
// what you said, where it landed, the real-life thing you did. So Seen, the AI conversation, only
// ever learned about your kindness through the feelings card — and once that card went weekly
// (3.24) and then went (3.28), it was learning almost nothing; and the Grow tab could only show
// numbers, because a number was all there was.
//
// users/{uid}/kindLog/{id}: one small entry per act, private to the account (firestore.rules),
// read by the Grow tab ("This week") and by api/understand.js (what Seen notices about you), and
// deleted with the account (api/_deleteAccount.js). Writes are best-effort: a log that fails must
// never make a kind act look like it failed.
//
// Entry: { route, at, day, toName?, toUid?, text?, country?, delivered?, feeling? }
//   route  "sent" (to a stranger) · "reply" (told someone how their words landed, or wrote back)
//          "note" (a kind note) · "act" (in real life) · "heart" (a heart on someone's words)
//   id     derived where there is one ("sent_{messageId}", "reply_{replyId}", "heart_{messageId}")
//          so a retry can't log the same act twice, and a delivery can find its entry later.

import { collection, doc, setDoc } from "firebase/firestore";

export const ROUTES = new Set(["sent", "reply", "note", "act", "heart"]);

const clip = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t ? (t.length > n ? `${t.slice(0, n - 1)}…` : t) : null;
};
const localDay = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// What gets written — pure, so it can be tested.
export function kindEntry({ route, toName = null, toUid = null, text = null, country = null, at = Date.now() } = {}) {
  if (!ROUTES.has(route)) return null;
  const e = { route, at: Number(at) || Date.now(), day: localDay(Number(at) || Date.now()) };
  const name = clip(toName, 40); if (name) e.toName = name;
  if (toUid) e.toUid = String(toUid);
  const words = clip(text, 240); if (words) e.text = words;
  if (country) e.country = String(country).slice(0, 60);
  return e;
}

export function logKindAct(db, uid, { id = null, ...fields } = {}) {
  const entry = kindEntry(fields);
  if (!db || !uid || !entry) return Promise.resolve();
  const col = collection(db, "users", uid, "kindLog");
  const ref = id ? doc(col, String(id).slice(0, 120)) : doc(col);
  return setDoc(ref, entry, { merge: true }).catch(() => {});
}

// A message to a stranger reached someone: where, on the same entry.
export function noteDelivery(db, uid, messageId, country) {
  if (!db || !uid || !messageId) return Promise.resolve();
  const patch = { delivered: true };
  if (country) patch.country = String(country).slice(0, 60);
  return setDoc(doc(db, "users", uid, "kindLog", `sent_${messageId}`), patch, { merge: true }).catch(() => {});
}

// ── Saying what an entry was, in a sentence ───────────────────────────────────────────────────
// For the Grow tab ("This week") and as the plain label Seen shows under "Why I think this".
const THE = new Set(["United Kingdom", "United States", "Netherlands", "Philippines", "United Arab Emirates", "Czech Republic", "Dominican Republic", "Bahamas", "Maldives", "Gambia"]);
export const inPlace = (c) => (c ? `${THE.has(c) ? "the " : ""}${c}` : null);

export function kindLine(e) {
  if (!e || !ROUTES.has(e.route)) return null;
  const who = e.toName || null;
  switch (e.route) {
    case "sent": return e.delivered || e.country
      ? `Your words reached someone in ${inPlace(e.country) || "the world"}`
      : "You sent kind words to someone in the world";
    case "reply": return who ? `You told ${who} how their words landed` : "You told someone how their words landed";
    case "note": return who ? `You sent ${who} a kind note` : "You sent a kind note";
    case "act": return e.text
      ? `In real life: ${e.text.charAt(0).toLowerCase()}${e.text.slice(1).replace(/[.!]+$/, "")}`
      : who ? `You made ${who} feel seen in real life` : "You did something kind in real life";
    case "heart": return who ? `You hearted ${who}'s words` : "You hearted someone's words";
    default: return null;
  }
}
