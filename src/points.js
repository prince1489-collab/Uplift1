// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// points.js — v2 preview points ledger (device-local). Every kind action earns points
// that grow the Kindness Tree. PREVIEW ONLY: stored in localStorage, never written to
// Firestore. The tree balance = real sparkBalance + these local points, so demo actions
// visibly water the tree. Real server-side points are merge-time work.

const KEY = "seen_v2_points";
const META = "seen_v2_points_meta"; // once-per-day guards

// Point values per action (varied by effort).
export const POINTS = {
  send: 100,          // send a kindness message
  practice: 150,      // complete a "Have you tried?" prompt
  practiceAll: 250,   // bonus for all 3 daily practices
  reflect: 120,       // write a journal reflection
  like: 30,           // like a message
  reply: 200,         // private reply / kind moment
  story: 150,         // share a journal story
  dailyOpen: 50,      // first open of the day
};

export function getPoints() {
  try { return Number(localStorage.getItem(KEY) || 0) || 0; } catch { return 0; }
}

function setPoints(n) {
  try { localStorage.setItem(KEY, String(Math.max(0, Math.round(n)))); } catch { /* ignore */ }
}

// Award points for an action. Returns the new total. Fires a window event so the tree /
// header chip can animate a "watering" pulse. `opts.once` (e.g. "dailyOpen") de-dupes per day.
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
  try { window.dispatchEvent(new CustomEvent("seen-points", { detail: { action, value, total: next } })); } catch { /* ignore */ }
  return next;
}
