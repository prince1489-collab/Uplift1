// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// kindnessInbox.js — both ends of a message sent to "a stranger, anywhere in the world" (3.21).
//
// The sending end: after a message reaches the feed, deliverKindness asks the server to put it in
// front of one real person (api/_kindness.js decides who; this never does). The answer is only
// the country it reached, which the bar shows: "Your words reached someone in Canada".
//
// The receiving end: useKindnessInbox listens to users/{me}/kindnessInbox — pointers to the
// messages delivered to you — and reads each message itself, so a message its author deletes
// simply disappears. answerKindness is the one-tap "this landed": a real private reply, the same
// document a typed one is (privateReplyPayload), so it arrives in the sender's Messages with a
// push, starts a normal exchange they can answer, and counts as the day for whoever taps it.

import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { authedPost } from "./apiBase";
import { recordKindMoment } from "./Feed2";
import { privateReplyPayload } from "./privateReplies";

// One tap each, in the receiver's voice — shared with the reply sheet (privateReplies.js).
export { QUICK_ANSWERS } from "./privateReplies";

// How long a delivered message keeps asking for attention. After that it is still in the list,
// just no longer at the bottom of the screen.
const FRESH_MS = 3 * 86400000;

export const firstNameOf = (name) => String(name || "").trim().split(/\s+/)[0] || "Someone";

// ── Sending ──────────────────────────────────────────────────────────────────────────────────
// Never throws: the message is already in the feed, and a delivery that could not happen must not
// make it look like the send failed.
export async function deliverKindness(currentUser, messageId) {
  if (!currentUser || !messageId) return { delivered: false };
  try {
    return await authedPost(currentUser, "/api/notify-reply", { messageId });
  } catch {
    return { delivered: false, reason: "unavailable" };
  }
}

// Where today's words went, kept for the bar on this device. Local day key, like the bar's own state.
const deliveryKey = (day) => `seen_delivery_${day}`;
export function rememberDelivery(day, info) {
  try { localStorage.setItem(deliveryKey(day), JSON.stringify({ ...info, at: Date.now() })); } catch { /* storage blocked */ }
}
export function readDelivery(day) {
  try { return JSON.parse(localStorage.getItem(deliveryKey(day)) || "null"); } catch { return null; }
}

// ── Receiving ────────────────────────────────────────────────────────────────────────────────
// Newest first: [{ id, messageId, fromUid, deliveredAt, seen, answered, dismissed, message }].
// `message` is the public message as it is now; items whose message is gone, or whose sender you
// have blocked, are left out.
export function useKindnessInbox(db, uid, blockedUids) {
  // Rows are kept with the account they were read for, so signing out (or into another account)
  // shows nothing stale without a reset inside the effect.
  const [state, setState] = useState({ uid: null, rows: [] });
  const cache = useRef(new Map()); // messageId → message data | null (gone)

  useEffect(() => {
    if (!db || !uid) return undefined;
    let alive = true;
    const q = query(collection(db, "users", uid, "kindnessInbox"), orderBy("deliveredAt", "desc"), limit(10));
    const unsub = onSnapshot(q, async (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      await Promise.all(items.map(async (it) => {
        if (cache.current.has(it.messageId)) return;
        try {
          const m = await getDoc(doc(db, "publicMessages", it.messageId));
          cache.current.set(it.messageId, m.exists() ? { id: m.id, ...m.data() } : null);
        } catch { /* read again next time */ }
      }));
      if (alive) setState({ uid, rows: items.map((it) => ({ ...it, message: cache.current.get(it.messageId) ?? null })) });
    }, () => { if (alive) setState({ uid, rows: [] }); });
    return () => { alive = false; unsub(); };
  }, [db, uid]);

  const rows = state.uid === uid ? state.rows : [];
  return rows.filter((r) => r.message && !(blockedUids instanceof Set && blockedUids.has(r.fromUid)));
}

// The one still waiting for an answer, if any. The bar offers it until it is answered; the note
// above the bar can be put away ("not now" sets `dismissed`), which hides the note and nothing else.
export function waitingKindness(items, now = Date.now()) {
  return (items || []).find((it) => !it.answered && now - (Number(it.deliveredAt) || 0) < FRESH_MS) || null;
}

export function markKindness(db, uid, id, fields) {
  if (!db || !uid || !id) return Promise.resolve();
  return updateDoc(doc(db, "users", uid, "kindnessInbox", id), fields);
}

// The message as a reply target — the shape PrivateReplySheet and privateReplyPayload take.
export const replyTargetOf = (item) => ({
  uid: item.message.uid, id: item.messageId, text: item.message.text ?? "",
  sender: item.message.sender, country: item.message.country ?? null, isPersonal: item.message.isPersonal === true,
});

export async function answerKindness({ db, currentUser, me, item, text }) {
  const target = replyTargetOf(item);
  const ref = await addDoc(collection(db, "privateReplies"),
    privateReplyPayload({ me, uid: currentUser.uid, target, toName: firstNameOf(target.sender), text }));
  // Best effort, like every reply: the words have landed even if the push or the card do not.
  authedPost(currentUser, "/api/notify-reply", { replyId: ref.id }).catch(() => {});
  recordKindMoment(db, { fromUid: currentUser.uid, toUid: target.uid, fromCountry: me?.country ?? null, toCountry: target.country });
  markKindness(db, currentUser.uid, item.id, { answered: true, answeredAt: Date.now(), seen: true }).catch(() => {});
  return ref.id;
}
