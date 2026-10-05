// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// feelings.js — "How did that feel?", answered in one tap after the day's kind act.
//
// Writing a reflection every day is homework, and homework is what a habit quietly stops doing.
// A tap is not. So the daily loop closes on this — three seconds, and the day counts — and the
// journal is offered underneath for the days somebody has more to say.
//
// Stored at users/{uid}/feelings/{YYYY-MM-DD}: owner-only (firestore.rules), one per local day,
// so changing your answer replaces it. NOT in /journal, whose count, word total and calendar all
// treat every document there as a written reflection.

import { doc, setDoc } from "firebase/firestore";
import { awardPoints } from "./points";

export const FEELINGS = [
  { id: "good", emoji: "🙂", label: "Good" },
  { id: "calmer", emoji: "😌", label: "Calmer" },
  { id: "connected", emoji: "❤️", label: "Connected" },
  { id: "notmuch", emoji: "😐", label: "Not much" },
];

export const feelingFor = (id) => FEELINGS.find((f) => f.id === id) || null;

// "Not much" is a real answer and pays the same as the others. An app that rewards only the
// feelings it hoped for is teaching people to report those, which would make every one of these
// answers worthless — including to the person giving them.
export function recordFeeling(db, uid, { day, feeling, act, alreadyAwarded }) {
  if (!alreadyAwarded) { try { awardPoints("feeling"); } catch { /* ignore */ } }
  if (!db || !uid || !feelingFor(feeling)) return Promise.resolve();
  return setDoc(doc(db, "users", uid, "feelings", day), {
    feeling, act: String(act || "").slice(0, 200), date: day, createdAt: Date.now(),
  }).catch(() => {});
}

// The act as something you'd say about it afterwards: "Have you tried… holding a door?" →
// "holding a door". Used to write the Reflect prompt that "Want to say more?" opens on.
export function actPhrase(text) {
  return String(text || "")
    .replace(/^Have you tried(…|\.\.\.)\s*/i, "")
    .replace(/\?\s*$/, "")
    .trim();
}

// ── The daily reflection (3.4) ───────────────────────────────────────────────────────────────
// The one-tap feeling grew into a different short question each day (reflectPrompts.js). Same
// private document per day, same award, richer content: which question, and the answer in the
// person's own words — which is what makes the archive worth reading back.
//
// 3.9: the question is now the optional second card after the FIRST act's "Feel it", and it is
// stored on that act's entry (`{day}_{n}`) rather than a document of its own. No points of its
// own — the feeling already paid, and a bonus question should feel like a bonus.
export function recordReflection(db, uid, { day, n = 1, route, act, questionId, question, answer }) {
  if (!db || !uid || !questionId) return Promise.resolve();
  return setDoc(doc(db, "users", uid, "feelings", entryId(day, n)), {
    route: route || null, act: String(act || "").slice(0, 200), questionId,
    question: String(question || "").slice(0, 140), answer: String(answer || "").slice(0, 140),
    date: day, createdAt: Date.now(),
  }, { merge: true }).catch(() => {});
}

// ── "Feel it" (3.9) ──────────────────────────────────────────────────────────────────────────
// One private entry per kind act: the words you picked, the "because", and the sentence they
// make. `n` is the act's number that day (seenCount), so a second act never overwrites the first.
// The rule (users/{uid}/feelings/{id}) is owner-only and indifferent to the id's shape.
export const entryId = (day, n) => `${day}_${Math.max(1, Number(n) || 1)}`;

export function recordFeelingEntry(db, uid, { day, n, route, act, toName, feelings, because, sentence }) {
  // Every act can be felt, but the drops stop after three a day — enough to reward saying it,
  // not enough to make "Done it" worth tapping for the points.
  try { awardPoints("feeling", { maxPerDay: 3 }); } catch { /* ignore */ }
  if (!db || !uid || !feelings?.length) return Promise.resolve();
  return setDoc(doc(db, "users", uid, "feelings", entryId(day, n)), {
    route: route || null, act: String(act || "").slice(0, 200), toName: toName ? String(toName).slice(0, 40) : null,
    feelings: feelings.slice(0, 2).map((w) => String(w).slice(0, 24)),
    because: String(because || "").slice(0, 140), sentence: String(sentence || "").slice(0, 200),
    date: day, createdAt: Date.now(),
  }, { merge: true }).catch(() => {});
}
