// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// deviceOwner.js — one account's data never shows up in another's (3.27).
//
// Seen keeps a lot of personal state on the device, in localStorage: the day's kind acts and the
// answers to the bar's questions (hytState), the "Feel it" history, a real-life plan, journal
// drafts and pinned prompts, who you follow (a cache), your points, which messages you hearted…
// None of it was tied to an account, and signing out cleared none of it. A recording of a brand-new
// account made on the founder's phone showed the founder's "✓ 3 today", their private answer
// "Very nearly", their real-life plan and 17 people they follow, labelled Family — and two of those
// were then written to the NEW account on the server (the follow cache was "migrated" into it, and
// points were merged as max(device, account)). On a family phone that is one person's private
// words shown to another.
//
// So the device's personal data belongs to ONE account at a time:
//   • signing out removes it (releaseDevice) and the app restarts clean, so nothing held in memory
//     carries over either;
//   • an account signing in over someone else's data — data written before this existed, or any
//     way round a sign-out — removes it first (claimDevice), and the app restarts once.
//
// What stays: device preferences (theme, sound, the intro already seen, install/update notices),
// sign-in plumbing (an email-link sign-in in progress, a referral), the device id push tokens are
// filed under, and keys that carry an account's own id (e.g. seen_pending_days_{uid}) — those are
// only ever read for that account, so they cannot leak, and the unsaved days in them must survive.
// Every key Seen writes starts with "seen"; nothing else (Firebase's own sign-in state) is touched.

export const OWNER_KEY = "seen_device_owner_v1";

const KEEP = new Set([
  OWNER_KEY,
  "seen-theme",              // light / dark
  "seen_sound_on",           // sounds on or off
  "seen_device_id_v1",       // which device a push token belongs to (nativePush.js)
  "seen_intro_v1",           // the word-by-word intro, already seen on this device
  "seen-install-dismissed",  // "add to home screen" notice
  "seenEmailForSignIn",      // an email-link sign-in in progress
  "seen_ref",                // who invited this device
]);
const KEEP_PREFIXES = ["seen_update_dismissed_"]; // "a new version is ready", per version

const isSeenKey = (k) => typeof k === "string" && /^seen/i.test(k);

// A Firebase uid inside a key — 20+ letters and digits as its own segment. Dates (2026-11-17),
// versions (3.26) and short words never match.
const UID_IN_KEY = /(?:^|[_\-.])([A-Za-z0-9]{20,})(?=$|[_\-.])/;
export function uidInKey(k) {
  const m = typeof k === "string" ? k.match(UID_IN_KEY) : null;
  return m ? m[1] : null;
}

// Personal and not tied to any one account: what has to go when the account changes.
export function isPersonalKey(k) {
  if (!isSeenKey(k) || KEEP.has(k)) return false;
  if (KEEP_PREFIXES.some((p) => k.startsWith(p))) return false;
  return !uidInKey(k);
}

const keysOf = (storage) => {
  const out = [];
  try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k != null) out.push(k); } } catch { /* blocked */ }
  return out;
};

// Remove every personal key; returns how many actually went.
export function wipePersonal(storage) {
  let n = 0;
  for (const k of keysOf(storage)) {
    if (!isPersonalKey(k)) continue;
    try { storage.removeItem(k); if (storage.getItem(k) == null) n += 1; } catch { /* blocked */ }
  }
  return n;
}

const defaultStorage = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } };

// `uid` has just signed in on this device. If what the device holds was someone else's, it goes.
// Returns { wiped } — true when anything was removed, so the caller restarts the app and nothing
// already read into memory survives either. Never true twice in a row for the same account.
//
// Whose was it? The owner this file recorded; "" after a sign-out, when the device was left clean
// and anything since (the welcome screens) is the newcomer's own; or, for data from before 3.27
// (no record at all), any key carrying a different account's id. No sign of anyone: theirs.
export function claimDevice(uid, storage = defaultStorage()) {
  if (!uid || !storage) return { wiped: false, previous: null };
  let owner = null;
  try { owner = storage.getItem(OWNER_KEY); } catch { /* blocked */ }
  const foreign = owner === "" ? false
    : owner ? owner !== uid
    : keysOf(storage).some((k) => isSeenKey(k) && uidInKey(k) && uidInKey(k) !== uid);
  const wiped = foreign ? wipePersonal(storage) > 0 : false;
  try { storage.setItem(OWNER_KEY, uid); } catch { /* blocked */ }
  return { wiped, previous: owner };
}

// Signing out: nothing personal stays behind for whoever uses the device next. The owner is set
// to "" — nobody, and clean — so the next sign-in doesn't take the welcome screens' few keys for
// someone else's data and restart the app mid-sign-up.
export function releaseDevice(storage = defaultStorage()) {
  if (!storage) return 0;
  const n = wipePersonal(storage);
  try { storage.setItem(OWNER_KEY, ""); } catch { /* blocked */ }
  return n;
}
