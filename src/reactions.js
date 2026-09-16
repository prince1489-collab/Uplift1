// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// reactions.js — the one place a reaction is written.
//
// ── ONE REACTION PER PERSON PER MESSAGE ──────────────────────────────────────────────────────
// A heart or a sticker, never both, and never two stickers. Picking anything replaces whatever
// you had.
//
// That is an invariant, and an invariant needs a single writer. There used to be two, in two
// files, that could not see each other:
//
//   • the heart chip cleared your previous reaction before setting the new one — but its idea of
//     "previous" was the list ["❤️"], so a sticker was invisible to it;
//   • the sticker picker had no view of the message's other reactions at all, and simply wrote
//     its own document.
//
// So hearting a message and then sending a sticker left BOTH on the card, from one person. Two
// writers cannot hold an agreement between them; one function can.
//
// A third copy of the same transaction lived in a component that nothing rendered. It is gone.
//
// ── WHY fromId IS AN ARGUMENT ────────────────────────────────────────────────────────────────
// setMyReaction is told what to clear rather than discovering it. That keeps it out of the
// business of knowing which ids exist — no sticker table, no import of the component file that
// owns it, no cycle — and it means the caller can pass the OPTIMISTIC current reaction, so two
// quick taps in a row clear the right document instead of the one the server last confirmed.

import { deleteDoc, doc, runTransaction, setDoc } from "firebase/firestore";
// Extension spelled out, unlike most imports in this tree. Vite resolves either way, but Node
// does not — and scripts/test-reactions.mjs loads this module directly to run setMyReaction
// against the Firestore emulator. The invariant this file exists to hold is worth a test that
// exercises the real transaction rather than a description of it.
import { authedPost } from "./apiBase.js";

export const HEART = "❤️";

// ── The write ────────────────────────────────────────────────────────────────────────────────
//
// One transaction, because moving a reaction is one act: if the clear lands and the set does not,
// the person's reaction has silently vanished.
//
// `uids` is the list, `count` is its length, and `countries` / `reactedAt` are per-uid maps that
// feed the globe and the "who felt this" ordering. All four move together. An earlier version of
// the sticker path wrote `{ count, uids }` alone, which left sticker reactors with no country and
// no timestamp — bottom of the panel, no dot on the map.
export function setMyReaction({ db, uid, messageId, fromId, toId, country = null }) {
  if (!db || !uid || !messageId || fromId === toId) return Promise.resolve();

  return runTransaction(db, async (tx) => {
    // Firestore requires every read in a transaction to happen before every write, so the old
    // document is read first even though nothing between them depends on it.
    const fromRef = fromId ? doc(db, "publicMessages", messageId, "reactions", fromId) : null;
    const toRef = toId ? doc(db, "publicMessages", messageId, "reactions", toId) : null;
    const fromSnap = fromRef ? await tx.get(fromRef) : null;
    const toSnap = toRef ? await tx.get(toRef) : null;

    if (fromRef) {
      const d = fromSnap?.exists() ? fromSnap.data() : { uids: [] };
      const uids = (d.uids ?? []).filter((u) => u !== uid);
      const countries = { ...(d.countries ?? {}) };
      const reactedAt = { ...(d.reactedAt ?? {}) };
      delete countries[uid];
      delete reactedAt[uid];
      tx.set(fromRef, { count: Math.max(0, uids.length), uids, countries, reactedAt });
    }

    if (toRef) {
      const d = toSnap?.exists() ? toSnap.data() : { uids: [] };
      const uids = d.uids ?? [];
      const countries = { ...(d.countries ?? {}) };
      const reactedAt = { ...(d.reactedAt ?? {}) };
      // Idempotent: a double-tap that reaches here twice must not add you twice or inflate the
      // count, so membership is tested rather than assumed.
      const already = uids.includes(uid);
      countries[uid] = country;
      reactedAt[uid] = Date.now();
      tx.set(toRef, {
        count: already ? uids.length : uids.length + 1,
        uids: already ? uids : [...uids, uid],
        countries,
        reactedAt,
      });
    }
  });
}

// ── Telling the person ───────────────────────────────────────────────────────────────────────
//
// ONE THROTTLE, not one per kind of reaction. The heart and the sticker used to keep separate
// cooldowns on purpose, and the reasoning was sound at the time: they were two independent
// reactions, so a shared throttle would have swallowed a hug because you happened to have
// hearted the same message a minute earlier.
//
// Under one-reaction-per-person that reasoning inverts. A heart and a sticker are now the same
// gesture, changed — and two throttles would let one person switch from heart to sticker and
// push the recipient's phone twice inside a minute for what they experienced as one decision.
const NOTIFY_COOLDOWN_MS = 60 * 1000;
const lastNotifyAt = new Map();
function shouldNotify(messageId, reactorUid) {
  const key = `${messageId}_${reactorUid}`;
  const now = Date.now();
  const last = lastNotifyAt.get(key) ?? 0;
  if (now - last < NOTIFY_COOLDOWN_MS) return false;
  lastNotifyAt.set(key, now);
  return true;
}

// Writes the recipient's copy — the row behind their bell, their globe and their impact — and
// then pushes. Both paths already wrote the SAME document key, `{messageId}_{reactorUid}`, so a
// heart replaced by a sticker overwrites it and there is nothing to clean up.
//
// The push is CHAINED onto that write rather than fired beside it. notify-like proves the
// reaction really happened by re-reading it, so running the two in parallel raced an HTTP call
// to Vercel against a Firestore round trip and the endpoint would often find nothing yet.
//
// Every failure here is swallowed. The reaction itself has already landed and is on screen; a
// recipient's notification that did not send is not a reason to tell the sender their warmth
// failed.
export function announceReaction({ db, currentUser, messageId, senderUid, reaction, country = null, reactorName = "" }) {
  if (!db || !currentUser || !messageId) return;
  if (!senderUid || senderUid === currentUser.uid) return;

  const ownerRef = doc(db, "users", senderUid, "reactionsReceived", `${messageId}_${currentUser.uid}`);

  // No reaction left — take the row back off their bell too.
  if (!reaction) {
    deleteDoc(ownerRef).catch(() => {});
    return;
  }

  const isHeart = reaction.id === HEART;
  setDoc(ownerRef, {
    messageId,
    ownerUid: senderUid,
    reactorUid: currentUser.uid,
    emoji: reaction.emoji,
    // Only a sticker carries these; a heart is its own label.
    ...(isHeart ? {} : { stickerId: reaction.id, stickerLabel: reaction.label ?? "" }),
    country,
    reactorName: (reactorName || "").trim().split(" ")[0] || "Someone",
    reactedAt: Date.now(),
  })
    .then(() => {
      if (!shouldNotify(messageId, currentUser.uid)) return;
      authedPost(currentUser, "/api/notify-like", { ownerUid: senderUid, messageId }).catch(() => {});
    })
    .catch((err) => { console.error("[reactionsReceived]", err?.code, err?.message); });
}
