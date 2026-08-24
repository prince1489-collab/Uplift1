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
  reflect: 120,       // write a journal reflection
  like: 30,           // like a message
  reply: 200,         // private reply / kind moment
  story: 150,         // share a journal story
  post: 150,          // write your own message for the feed (same effort as a reflection)
  dailyOpen: 50,      // first open of the day
};

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
