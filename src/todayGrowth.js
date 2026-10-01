// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// todayGrowth.js — what you did today, as things on your tree.
//
// The tree's 17 stages are weeks apart, so on any given day it looked exactly as it did
// yesterday, whatever you had done. This is the small, daily layer on top: every kind act today
// leaves one visible thing on the Grow tree — a droplet, a leaf, a warm mote, an envelope — and
// at midnight the tree starts the day fresh. "My tree is slightly different because of what I
// did today", which the stage ladder alone can never say.
//
// Fed by the same "seen-points" event the fly-to-Grow animation uses (motion.js), so the glyph
// that flies to the tab is the one that lands on the tree. Per-device, date-keyed, best-effort.

export const GROWTH_EVENT = "seen-today-growth";
const KEY = (day) => `seen_today_growth_${day}`;
const MAX = 12;
const KEEP_DAYS = 3;

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function todayGrowth(day = dayKey()) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(day)) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

// Old days are pruned on write, so the record never grows past a few small keys.
function prune(today) {
  try {
    const keep = new Set();
    for (let i = 0; i < KEEP_DAYS; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      keep.add(KEY(dayKey(d)));
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("seen_today_growth_") && !keep.has(k) && k !== KEY(today)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

export function recordGrowth(glyph) {
  const day = dayKey();
  const next = [...todayGrowth(day), glyph].slice(-MAX);
  try { localStorage.setItem(KEY(day), JSON.stringify(next)); } catch { /* ignore */ }
  prune(day);
  try { window.dispatchEvent(new CustomEvent(GROWTH_EVENT, { detail: { day, items: next } })); } catch { /* ignore */ }
  return next;
}
