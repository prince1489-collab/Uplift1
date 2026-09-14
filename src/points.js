// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// points.js — the points ledger behind the Kindness Tree. Every kind action earns points that
// grow the tree. The tree balance = real sparkBalance + these points.
//
// WHY THIS IS NO LONGER LOCAL-ONLY. It used to say "PREVIEW ONLY: stored in localStorage, never
// written to Firestore", and that was survivable while the Android app was a TWA — a TWA is
// Chrome, so its localStorage is the website's. The Capacitor build is a WebView at a DIFFERENT
// ORIGIN, and cannot read what Chrome stored. On the day that build replaced the TWA, every
// existing user's tree would have silently reset to a seed, with no way to recover it afterwards.
//
// So the total is now mirrored to users/{uid}.treePoints. localStorage stays the fast path — it
// is synchronous, works offline, and keeps the UI instant — and Firestore is what survives a
// change of shell, a new device, or a reinstall.
//
// The mirror writes the ABSOLUTE TOTAL rather than increment(). A retried or duplicated write of
// an absolute value is harmless; a duplicated increment silently inflates someone's tree, and
// there is no way to tell afterwards that it happened.

import { doc, getDoc, setDoc } from "firebase/firestore";

const KEY = "seen_v2_points";
const META = "seen_v2_points_meta"; // once-per-day guards
const FIELD = "treePoints";         // users/{uid}.treePoints

// Set once by syncPoints() after sign-in. Until then every award is local-only, which is correct:
// a signed-out user has nowhere to mirror to.
let mirror = null; // { db, uid }

// Point values per action (varied by effort).
export const POINTS = {
  send: 100,          // send a kindness message
  practice: 150,      // complete a "Have you tried?" prompt
  practiceAll: 250,   // bonus for all 3 daily practices
  reflect: 500,       // write a journal reflection (see THE 500s below)
  like: 30,           // like a message
  reply: 200,         // private reply / kind moment
  story: 150,         // share a journal story
  postFirst: 500,     // your first written-from-scratch message of the day
  post: 150,          // and every one after it
  dailyOpen: 50,      // first open of the day
};

// ── THE 500s, and why only one of them needed a guard ────────────────────────────────────────
// Writing a reflection and writing your own message are the two things in this app that take a
// minute of someone's actual attention, so they are the two worth 500. Everything else is a tap.
//
// Reflect needs no protection: Journal.jsx keeps one entry per date, and a second save that day
// EDITS the first rather than creating another, so the award can only land once however many
// times you press save.
//
// Sending does. DAILY_GREETING_LIMIT is 50, so a flat 500 would pay 25,000 drops a day to
// someone typing "hi" fifty times — which would outrun the whole tree in under a week and make
// the ladder meaningless for everyone who used the app properly. Hence two keys: the first
// message of the day is the one that gets the 500.
//
// Note this is NOT a cap or a countdown. Nothing is refused, nothing is displayed as running
// out, and the fifty-first message is as welcome as the first. App.jsx:1348 is explicit that a
// menu which prices each option and counts down an allowance is the transactional framing the
// Kindness Tree exists to avoid. This is the opposite: an unannounced bonus on the first one.

export function getPoints() {
  try { return Number(localStorage.getItem(KEY) || 0) || 0; } catch { return 0; }
}

function setPoints(n) {
  try { localStorage.setItem(KEY, String(Math.max(0, Math.round(n)))); } catch { /* ignore */ }
}

function announce(action, value, total) {
  try { window.dispatchEvent(new CustomEvent("seen-points", { detail: { action, value, total } })); }
  catch { /* ignore */ }
}

// Best-effort, deliberately not awaited: the tree must animate the instant you act, and a slow or
// failed write must never make an earned point look like it did not land. The local ledger is
// already authoritative for this session, and the next sync reconciles.
function pushRemote(total) {
  if (!mirror) return;
  try {
    setDoc(doc(mirror.db, "users", mirror.uid), { [FIELD]: total }, { merge: true }).catch(() => {});
  } catch { /* ignore */ }
}

// Called once after sign-in. Reconciles the two ledgers and arms the mirror.
//
// max(), not "remote wins" or "local wins". Remote-wins would erase points earned offline or
// before this shipped; local-wins would erase the whole tree the first time someone opens the app
// on a new device or a new shell, which is the exact disaster this function exists to prevent.
// Taking the larger can only ever be generous, which is the right way to be wrong about someone's
// record of their own kindness.
// The parameter is `myUid`, not `uid`, deliberately: scripts/check-privacy.cjs treats that name
// as the signal that a users/{uid} read is of your OWN document rather than someone else's, and
// asks call sites to say so rather than accepting an ambiguous name. This only ever reads the
// signed-in user's own doc — the rules would deny anything else.
export async function syncPoints(db, myUid) {
  if (!db || !myUid) return getPoints();
  mirror = { db, uid: myUid };

  let remote = 0;
  try {
    const snap = await getDoc(doc(db, "users", myUid));
    remote = Number(snap.data()?.[FIELD]) || 0;
  } catch {
    return getPoints(); // offline or denied — keep what we have, never clobber either side
  }

  const local = getPoints();
  const merged = Math.max(remote, local);

  if (merged !== local) {
    setPoints(merged);
    // Components hold the old figure in state; without this the restored tree only appears on
    // the next remount.
    announce("sync", 0, merged);
  }
  if (merged !== remote) pushRemote(merged);
  return merged;
}

// True the FIRST time it is asked on a given local day, false for the rest of that day.
//
// Named "claim" rather than "is" because it MARKS as well as reads — calling it twice in the
// same render would silently answer false the second time. Call it once, at the moment of the
// act, and branch on the result.
//
// It shares the META store with awardPoints' oncePerDay guard but namespaces its keys, because
// the two mean different things: oncePerDay suppresses the award entirely, this one only
// chooses between two of them. A collision would make the second message of the day pay nothing
// at all instead of paying 150.
export function claimFirstToday(key) {
  const k = `first:${key}`;
  try {
    const meta = JSON.parse(localStorage.getItem(META) || "{}");
    const today = new Date().toDateString();
    if (meta[k] === today) return false;
    meta[k] = today;
    localStorage.setItem(META, JSON.stringify(meta));
    return true;
  } catch {
    // Storage blocked (private window). Paying the larger amount is the generous way to be
    // wrong, and matches syncPoints' reasoning about someone's record of their own kindness.
    return true;
  }
}

// Award points for an action. Returns the new total. Fires a window event so the tree / header
// chip can animate a "watering" pulse. `opts.oncePerDay` (e.g. "dailyOpen") de-dupes per day.
export function awardPoints(action, opts = {}) {
  const value = POINTS[action] ?? 0;
  if (!value) return getPoints();
  if (opts.oncePerDay) {
    try {
      const meta = JSON.parse(localStorage.getItem(META) || "{}");
      const today = new Date().toDateString();
      if (meta[action] === today) return getPoints();
      meta[action] = today;
      localStorage.setItem(META, JSON.stringify(meta));
    } catch { /* ignore */ }
  }
  const next = getPoints() + value;
  setPoints(next);
  pushRemote(next);
  announce(action, value, next);
  return next;
}
