// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// storyLikes.js — the shared heart on the daily Inspiring story.
//
// ── WHY THIS IS NOT ON THE STORY DOCUMENT ────────────────────────────────────────────────────
// The story lives at meta/goodNewsToday, and firestore.rules has that collection as
// `allow read: if true; allow write: if isAdmin()` — deliberately, because it is written by a
// cron with admin credentials and nobody else should be able to touch what every client reads.
// A like has to be writable by an ordinary signed-in person, so it needs somewhere else to live.
//
// ── KEYED ON THE LINK, NOT THE DATE ──────────────────────────────────────────────────────────
// A story is identified by its article, not by the day it happened to be published. The card can
// outlive a calendar day — the endpoint fails closed, so a quiet morning leaves yesterday's story
// up — and a date key would silently start a second count for the same story, or worse, hand a
// new story the old one's hearts.
//
// A short hash rather than the URL itself: Firestore document ids cannot contain "/" and are
// capped at 1,500 bytes, and an article URL with tracking parameters is neither short nor
// predictable. FNV-1a is not a security function and does not need to be — the collision it
// would take to matter is two of the fourteen links in the rotation hashing alike.
//
// ── NO DROPS ────────────────────────────────────────────────────────────────────────────────
// Every other reward in this app follows a kind act aimed at a person. Liking a news story is not
// one, and it would be the only farmable one in the product: tap, untap, tap. The heart says
// "this moved me too", which is worth having on its own.

import { doc, onSnapshot, runTransaction } from "firebase/firestore";

export function storyKey(link) {
  const s = String(link || "");
  if (!s) return "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `s${h.toString(36)}`;
}

function likeRef(db, link) {
  return doc(db, "storyLikes", storyKey(link));
}

// Live count + whether it is yours, for everybody looking at the same story. onSnapshot on ONE
// document, which is the cheapest listener Firestore has — and a shared number is the whole point
// of the feature. Seeing that eleven other people were moved by the same story is the thing a
// private tally could never say.
export function watchStoryLikes(db, link, uid, onChange) {
  if (!db || !link) return () => {};
  return onSnapshot(
    likeRef(db, link),
    (snap) => {
      const d = snap.exists() ? snap.data() : null;
      const uids = Array.isArray(d?.uids) ? d.uids : [];
      onChange({ count: Number(d?.count ?? uids.length) || 0, mine: Boolean(uid) && uids.includes(uid) });
    },
    // A listener that cannot read says nothing rather than throwing into a render.
    () => onChange({ count: 0, mine: false }),
  );
}

// Toggle, in one transaction, in the shape reactions.js established: the count is COMPUTED from
// the membership list rather than incremented, so two taps in the same second cannot leave a
// count that disagrees with the people it claims to represent.
//
// Returns the new state so the caller can settle its optimistic paint against the truth.
export async function toggleStoryLike(db, uid, story) {
  const link = story?.link;
  if (!db || !uid || !link) return null;
  const ref = likeRef(db, link);
  let mine = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const uids = Array.isArray(data.uids) ? data.uids : [];
    const has = uids.includes(uid);
    const next = has ? uids.filter((u) => u !== uid) : [...uids, uid];
    mine = !has;
    tx.set(ref, {
      uids: next,
      count: next.length,
      // Kept so a human reading the console can tell which story a hash belongs to. The hash is
      // one-way, and an unlabelled row of counts would be unreadable.
      link,
      at: Date.now(),
    }, { merge: true });
  });
  return { mine };
}
