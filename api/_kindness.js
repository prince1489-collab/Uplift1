// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// _kindness.js — a message sent to "a stranger, anywhere in the world" lands on one real person
// (3.21).
//
// Until 3.21 a message to a stranger went into the Worldwide Feed and nowhere else. With a
// community the size Seen has, that feed carried a handful of messages a week, so most of them
// were read by nobody — and the sender was told "you'll see here when someone feels them".
// Kindness with no one on the other end is a chore, and it is the chore the app was asking for
// every day. So now each one is also DELIVERED, privately, to one person who did not send it:
// they get a push ("Mahiman in the United Kingdom sent you a few kind words"), the message sits
// at the top of their app, and one tap tells the sender it landed. Both people now have a reason
// to open Seen that is about them.
//
// WHO RECEIVES IT is decided here, on the server, never by the client: a stranger message the
// sender could aim would be a way to push words at one chosen person, which is exactly what
// "a stranger" must not mean. Chosen from people who have opened Seen in the last
// ACTIVE_WITHIN_DAYS, never the sender, never anyone blocked in either direction, and never
// anyone already given PER_RECIPIENT_PER_DAY today. Among the rest, in this order of preference:
// nobody yet today; someone the sender doesn't follow (it is meant for a stranger — your mum
// already hears from you); someone they haven't reached recently; someone who will actually see
// it (a phone to push to, or opened recently); and someone in another country. Ties are random.
//
// WHAT IS CHECKED before anything is written: the caller wrote the message, it is fresh
// (MAX_AGE_MS), it hasn't been delivered already, the sender has deliveries left today
// (PER_SENDER_PER_DAY — further messages still reach the feed, just not an inbox), and the text
// passes the same reviewer as everything else (_screen.js, strict "delivered" context).
//
// THE LEDGER. The counts that enforce those limits live in kindnessLedger/{uid}, which no client
// can read or write (firestore.rules). They used to be the obvious thing to put on users/{uid},
// but the owner can write anything on their own user document, so a sender could have reset
// their own daily count. The delivered copy itself is users/{to}/kindnessInbox/{messageId} —
// a pointer, not a copy: the words are read from the message, so a message its author deletes
// disappears from the inbox too.
//
// No Firebase import here: the database, the reviewer and the randomness are passed in, so
// scripts/test-kindness.mjs runs every rule against fakes.

import { tokensFor } from "./_auth.js";

export const MAX_AGE_MS = 15 * 60 * 1000;
export const PER_RECIPIENT_PER_DAY = 2;
export const PER_SENDER_PER_DAY = 3;
export const ACTIVE_WITHIN_DAYS = 60;
export const REACHABLE_WITHIN_DAYS = 3;
export const CANDIDATE_LIMIT = 300;
export const RECENT_KEPT = 10;

const DAY_MS = 86400000;
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

// ── Choosing ─────────────────────────────────────────────────────────────────────────────────
// Pure. candidates: [{ uid, country, inToday, reachable, followed, recent, blocked }].
// Returns the eligible ones, best first.
export function rankRecipients(candidates, { senderUid, senderCountry = null, random = Math.random } = {}) {
  const eligible = (candidates || []).filter((c) => c && c.uid && c.uid !== senderUid && !c.blocked
    && (Number(c.inToday) || 0) < PER_RECIPIENT_PER_DAY);
  const cost = (c) => ((Number(c.inToday) || 0) > 0 ? 1000 : 0)
    + (c.followed ? 100 : 0)
    + (c.recent ? 10 : 0)
    + (c.reachable ? 0 : 5)
    + (senderCountry && c.country === senderCountry ? 1 : 0);
  return eligible
    .map((c) => ({ c, cost: cost(c), tie: random() }))
    .sort((a, b) => a.cost - b.cost || a.tie - b.tie)
    .map((x) => x.c);
}

// ── Delivering ───────────────────────────────────────────────────────────────────────────────
// Returns { delivered: true, country, toUid, already? } or { delivered: false, reason }. Throws
// only on a malformed request ({ status, error }) — every refusal that is simply "not this time"
// is an answer, not an error, because the message itself has already reached the feed.
export async function deliverKindness({ db, uid, messageId, screen, now = Date.now(), random = Math.random }) {
  if (!db || !uid || !messageId || typeof screen !== "function") throw Object.assign(new Error("bad request"), { status: 400 });
  const msgRef = db.collection("publicMessages").doc(String(messageId));
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) throw Object.assign(new Error("no such message"), { status: 404 });
  const msg = msgSnap.data() || {};
  if (msg.uid !== uid) throw Object.assign(new Error("not your message"), { status: 403 });
  if (msg.delivered) return { delivered: true, already: true, country: msg.delivered.country ?? null };

  const sentAt = Number(msg.timestamp) || 0;
  if (!sentAt || now - sentAt > MAX_AGE_MS || sentAt - now > MAX_AGE_MS) return { delivered: false, reason: "too_old" };
  const text = String(msg.text || "").trim();
  if (!text) return { delivered: false, reason: "empty" };
  // An anonymous post reaches the feed and stops there. Putting unsigned words in one person's
  // inbox is the least accountable thing this could do, and an answer back would start a private
  // conversation that could give the author's name away.
  if (isAnonymous(msg)) return { delivered: false, reason: "anonymous" };

  const day = dayKey(now);
  const ledgerRef = (id) => db.collection("kindnessLedger").doc(id);
  const myLedger = (await ledgerRef(uid).get()).data() || {};
  const sentToday = myLedger.outDay === day ? Number(myLedger.outCount) || 0 : 0;
  if (sentToday >= PER_SENDER_PER_DAY) return { delivered: false, reason: "daily_limit" };

  const verdict = await screen(text);
  if (!verdict?.ok) return { delivered: false, reason: "screened" };

  // Everyone who has opened Seen recently, apart from the sender.
  const presence = await db.collection("presence")
    .where("lastSeen", ">=", now - ACTIVE_WITHIN_DAYS * DAY_MS).limit(CANDIDATE_LIMIT).get();
  const lastSeen = new Map();
  for (const d of presence.docs) if (d.id !== uid) lastSeen.set(d.id, Number(d.data()?.lastSeen) || 0);
  if (!lastSeen.size) return { delivered: false, reason: "no_one" };

  const ids = [...lastSeen.keys()];
  const userRef = (id) => db.collection("users").doc(id);
  const [users, ledgers, theyBlocked, myBlocks, myFollows] = await Promise.all([
    db.getAll(...ids.map(userRef)),
    db.getAll(...ids.map(ledgerRef)),
    db.getAll(...ids.map((id) => userRef(id).collection("blockedUsers").doc(uid))),
    userRef(uid).collection("blockedUsers").get(),
    userRef(uid).collection("follows").get(),
  ]);
  const blockedByMe = new Set(myBlocks.docs.map((d) => d.id));
  const following = new Set(myFollows.docs.map((d) => d.id));
  const recent = new Set(Array.isArray(myLedger.recent) ? myLedger.recent : []);

  const candidates = [];
  ids.forEach((id, i) => {
    const u = users[i];
    // Only finished accounts: someone half-way through sign-up has no name and no feed yet.
    if (!u?.exists) return;
    const data = u.data() || {};
    if (!data.onboardingCompletedAt && !(data.fullName && data.country)) return;
    const l = ledgers[i]?.exists ? ledgers[i].data() || {} : {};
    candidates.push({
      uid: id,
      country: data.country ?? null,
      inToday: l.inDay === day ? Number(l.inCount) || 0 : 0,
      reachable: tokensFor(data).length > 0 || now - lastSeen.get(id) < REACHABLE_WITHIN_DAYS * DAY_MS,
      followed: following.has(id),
      recent: recent.has(id),
      blocked: blockedByMe.has(id) || Boolean(theyBlocked[i]?.exists),
    });
  });

  const ranked = rankRecipients(candidates, { senderUid: uid, senderCountry: msg.country ?? null, random });
  // A few tries: between choosing and writing, someone else's delivery may have filled a
  // recipient's day. The transaction re-reads everything it relies on.
  for (const chosen of ranked.slice(0, 3)) {
    const result = await db.runTransaction(async (tx) => {
      const [m, theirs, mine] = await Promise.all([tx.get(msgRef), tx.get(ledgerRef(chosen.uid)), tx.get(ledgerRef(uid))]);
      if (!m.exists) return { delivered: false, reason: "gone" };
      if (m.data()?.delivered) return { delivered: true, already: true, country: m.data().delivered.country ?? null };
      const t = theirs.exists ? theirs.data() || {} : {};
      const inToday = t.inDay === day ? Number(t.inCount) || 0 : 0;
      if (inToday >= PER_RECIPIENT_PER_DAY) return null;
      const me = mine.exists ? mine.data() || {} : {};
      const outToday = me.outDay === day ? Number(me.outCount) || 0 : 0;
      if (outToday >= PER_SENDER_PER_DAY) return { delivered: false, reason: "daily_limit" };

      tx.set(userRef(chosen.uid).collection("kindnessInbox").doc(String(messageId)), {
        messageId: String(messageId), fromUid: uid, deliveredAt: now, seen: false, answered: false,
      });
      tx.set(ledgerRef(chosen.uid), { inDay: day, inCount: inToday + 1 }, { merge: true });
      const recentList = [chosen.uid, ...(Array.isArray(me.recent) ? me.recent : []).filter((x) => x !== chosen.uid)].slice(0, RECENT_KEPT);
      tx.set(ledgerRef(uid), { outDay: day, outCount: outToday + 1, recent: recentList }, { merge: true });
      // Only the country, on a world-readable document: enough for the sender to be told where
      // their words went, never enough to say who received them.
      tx.update(msgRef, { delivered: { country: chosen.country ?? null, at: now } });
      return { delivered: true, country: chosen.country ?? null, toUid: chosen.uid };
    });
    if (result) return result;
  }
  return { delivered: false, reason: "no_one" };
}

// "in the United Kingdom". The same list as src/countryName.js — the client says the same
// sentences — and scripts/test-kindness.mjs fails if the two ever differ.
export const TAKES_THE = new Set([
  "United Kingdom", "United States", "United Arab Emirates", "Netherlands", "Philippines",
  "Czech Republic", "Dominican Republic", "Central African Republic", "Bahamas", "Gambia",
  "Maldives", "Marshall Islands", "Solomon Islands", "Comoros", "Seychelles",
]);
export const inCountry = (country) => {
  const name = String(country || "").trim();
  return !name ? "" : TAKES_THE.has(name) ? `the ${name}` : name;
};

export const isAnonymous = (msg) => String(msg?.sender || "").trim().toLowerCase() === "anonymous";

// What the person receiving it is told: the sender's first name and country, as the feed shows
// them. (Anonymous posts are never delivered; a sender with no country on file is "a stranger".)
export function deliveryPush(msg) {
  const first = String(msg?.sender || "").trim().split(/\s+/)[0] || "Someone";
  return {
    title: "Someone thought of you 💛",
    body: isAnonymous(msg) || !msg?.country
      ? "A stranger sent you a few kind words."
      : `${first} in ${inCountry(msg.country)} sent you a few kind words.`,
  };
}
