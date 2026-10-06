// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// seenChat.js — the app's side of "Seen", the AI conversation pinned in Messages (3.15).
//
// The conversation lives at users/{uid}/seenChat (private to the owner). The app writes the
// person's messages and the questions Seen asks from its bank (src/seenAsks.js); everything
// Seen says in reply — answers, "Seen noticed" reflections, nudges, support — is written by
// /api/understand, which the rules make the only author of those. After every message the app
// asks the server for a reply, then whether a reflection is due; the server decides both.

import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query, limit, addDoc, updateDoc, getDocs, deleteDoc, setDoc, writeBatch,
} from "firebase/firestore";
import { authedPost } from "./apiBase.js";
import { pickQuestion, questionDue, FIRST_MESSAGE, ANSWER_GAP_HOURS } from "./seenAsks.js";

export const SEEN_ID = "seen"; // the pinned conversation's id in MessagesTab

export function useSeenChat(db, uid, enabled) {
  const [chat, setChat] = useState(null); // null until loaded
  useEffect(() => {
    if (!db || !uid || !enabled) return undefined;
    const q = query(collection(db, "users", uid, "seenChat"), orderBy("createdAt", "asc"), limit(300));
    return onSnapshot(q, (snap) => setChat(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setChat([]));
  }, [db, uid, enabled]);
  return enabled ? chat : null;
}

export function useUnderstanding(db, uid, enabled) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!db || !uid || !enabled) return undefined;
    return onSnapshot(doc(db, "users", uid, "understanding", "state"), (s) => setState(s.exists() ? s.data() : {}), () => setState({}));
  }, [db, uid, enabled]);
  return enabled ? state : null;
}

export const seenUnread = (chat) => (chat || []).filter((m) => m.role === "seen" && m.read === false).length;

const askedFrom = (chat) => (chat || []).filter((m) => m.role === "seen" && m.kind === "question").map((m) => ({ qid: m.qid, at: Number(m.createdAt) }));
const answeredFrom = (chat) => (chat || []).filter((m) => m.role === "me" && m.kind === "answer").length;

// About twice a week, a new question — the app asks it from the bank (or the follow-up the
// server left), so nothing has to run on a schedule anywhere.
//
// ── ONE QUESTION, EVEN WHEN TWO PARTS OF THE APP ASK AT ONCE (3.16) ──
// 3.15 gave each question a random id, and turning Seen on asked the first question while the
// Messages tab was ALSO checking "is one due?" against a chat that hadn't caught up yet — so the
// first question appeared twice. Now each question belongs to a time slot (one per
// ANSWER_GAP_HOURS) and its id is that slot: two callers in the same slot write the same
// document, and the rules refuse a second version of it. A duplicate can't exist.
export const slotOf = (now) => Math.floor(now / (ANSWER_GAP_HOURS * 3600000));
export const questionIdFor = (now) => `q-${slotOf(now)}`;

// What to ask now, if anything — pure, so the race can be tested (scripts/test-seen-chat.mjs).
export function planQuestion({ uid, chat, state, now = Date.now(), lastSlot = null }) {
  if (!chat) return null;
  const id = questionIdFor(now);
  if (lastSlot === slotOf(now) || chat.some((m) => m.id === id) || !questionDue(chat, now)) return null;
  const q = pickQuestion({ uid, now, answered: answeredFrom(chat), asked: askedFrom(chat), followUp: state?.followUp || null });
  return { id, data: { role: "seen", kind: "question", qid: q.id, text: q.q, createdAt: now, read: false } };
}

// Two identical questions in a row with nothing said between them — the 3.15 double. The later
// one goes; the person keeps the first.
export function duplicateQuestionIds(chat = []) {
  const out = [];
  let prevQ = null;
  for (const m of chat) {
    if (m.role === "me") { prevQ = null; continue; }
    if (m.kind !== "question") continue;
    if (prevQ && prevQ.text === m.text) out.push(m.id); else prevQ = m;
  }
  return out;
}

let lastSlot = null;
export async function ensureQuestion(db, uid, chat, state, now = Date.now()) {
  if (!db || !uid || !chat) return;
  duplicateQuestionIds(chat).forEach((id) => deleteDoc(doc(db, "users", uid, "seenChat", id)).catch(() => {}));
  const plan = planQuestion({ uid, chat, state, now, lastSlot });
  if (!plan) return;
  lastSlot = slotOf(now);
  try { await setDoc(doc(db, "users", uid, "seenChat", plan.id), plan.data); } catch { /* already asked in this slot */ }
}

// "Ask me something else" — one swap per question, replacing it in place.
export async function swapQuestion(db, uid, chat, msg, now = Date.now()) {
  const q = pickQuestion({ uid, now, answered: answeredFrom(chat), asked: askedFrom(chat), swap: 1 });
  if (!q || q.q === msg.text) return;
  await deleteDoc(doc(db, "users", uid, "seenChat", msg.id));
  await addDoc(collection(db, "users", uid, "seenChat"), { role: "seen", kind: "question", qid: q.id, text: q.q, createdAt: now, read: true });
}

// Turning Seen on: consent recorded, a hello, and the first question straight away.
export async function enableSeen(db, uid, now = Date.now()) {
  await setDoc(doc(db, "users", uid), { seenAI: { consent: true, at: now } }, { merge: true });
  await addDoc(collection(db, "users", uid, "seenChat"), { role: "seen", kind: "intro", text: FIRST_MESSAGE, createdAt: now, read: true });
  const q = pickQuestion({ uid, now, answered: 0, asked: [] });
  lastSlot = slotOf(now); // this slot's question is this one — nobody else asks it
  await setDoc(doc(db, "users", uid, "seenChat", questionIdFor(now)), { role: "seen", kind: "question", qid: q.id, text: q.q, createdAt: now + 1, read: false })
    .catch(() => { /* already asked in this slot */ });
}

// The person writes. If it follows an unanswered question it's an answer; otherwise it's a
// question or a thought for Seen. Then Seen replies, and checks whether it has noticed something.
export async function sendToSeen(db, currentUser, chat, text) {
  const uid = currentUser.uid;
  const clean = String(text || "").trim().slice(0, 600);
  if (!clean) return;
  const lastQ = [...(chat || [])].reverse().find((m) => m.role === "seen" && m.kind === "question");
  const answeredSince = lastQ && (chat || []).some((m) => m.role === "me" && m.kind === "answer" && Number(m.createdAt) > Number(lastQ.createdAt));
  await addDoc(collection(db, "users", uid, "seenChat"), {
    role: "me", kind: lastQ && !answeredSince ? "answer" : "ask", text: clean, createdAt: Date.now(), read: true,
  });
  try { await authedPost(currentUser, "/api/understand", { mode: "reply" }); } catch { /* reply arrives when it can */ }
  try { await authedPost(currentUser, "/api/understand", { mode: "reflect" }); } catch { /* not due, or later */ }
}

export function markSeenRead(db, uid, chat) {
  if (!db || !uid) return;
  const ids = (chat || []).filter((m) => m.role === "seen" && m.read === false).map((m) => m.id);
  ids.forEach((id) => updateDoc(doc(db, "users", uid, "seenChat", id), { read: true }).catch(() => {}));
}

export const giveFeedback = (db, uid, id, feedback) =>
  updateDoc(doc(db, "users", uid, "seenChat", id), { feedback, read: true }).catch(() => {});

// "Right now…" — one line shown on your glimpse, screened first because it becomes public.
export async function shareRightNow(db, currentUser, text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (clean) {
    const mod = await authedPost(currentUser, "/api/moderate-message", { text: clean, context: "profile" });
    if (!mod.checked || !mod.ok) throw new Error(mod.reason || "That didn't pass our kindness check. Try rewording it.");
  }
  await setDoc(doc(db, "publicProfiles", currentUser.uid), { uid: currentUser.uid, rightNow: clean || null, rightNowAt: clean ? Date.now() : null }, { merge: true });
}

// Forget everything: the conversation, what Seen understood, the shared line — and Seen off.
export async function forgetEverything(db, uid) {
  const snap = await getDocs(collection(db, "users", uid, "seenChat"));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "users", uid, "understanding", "state")).catch(() => {});
  await setDoc(doc(db, "publicProfiles", uid), { uid, rightNow: null, rightNowAt: null }, { merge: true }).catch(() => {});
  await setDoc(doc(db, "users", uid), { seenAI: { consent: false, at: Date.now() } }, { merge: true });
}
