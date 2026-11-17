// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// growStats.js — the three numbers on the Grow tab, and the levels that make them a game (3.30).
//
// 3.29 folded nine counts into one line, and the founder still couldn't say what they told him:
// "As a user I am not getting excited looking at them." Grow is now the tree and three numbers,
// each with levels to climb:
//
//   🔥 days in a row     — the habit itself (the streak, and the best you've ever had)
//   ❤️ hearts received   — people answering your kindness
//   🌍 countries reached — a collection to fill, out of 197
//
// Everything here is pure, so the levels, the best run and the country collection are tested
// in node (scripts/test-grow-stats.mjs). The flag map lives in a .jsx file node can't load, so it
// is passed in.
//
// The copy that goes with these never says "streak", never counts missed days and never warns
// about losing anything (the repo's no-guilt rule; see scripts/check-reflect.cjs).

import { liveStreak, longestRun, GRACE_EVERY_DAYS } from "./rhythm.js";

export { longestRun };

export const STREAK_TIERS = [3, 7, 14, 30, 60, 100, 200, 365];
export const HEART_TIERS = [10, 25, 50, 100, 250, 500, 1000, 2500];
// The country milestones the old impact screen used (MyImpact.jsx imports them from here).
export const MILESTONES = [1, 5, 10, 20, 35, 50, 75, 100];
export const TIERS = { streak: STREAK_TIERS, hearts: HEART_TIERS, countries: MILESTONES };
export const STATS = ["streak", "hearts", "countries"];
export const WORLD_COUNTRIES = 197; // scripts/check-flags.cjs: 197 countries in the picker

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

// Where a value sits on a ladder: the level reached (0 before the first rung), the next rung and
// how far towards it (0–100). Past the top rung, `next` is null and the bar is full.
export function tierFor(value, tiers) {
  const v = num(value);
  const list = Array.isArray(tiers) ? tiers : [];
  const level = list.filter((t) => v >= t).length;
  const reached = level ? list[level - 1] : 0;
  const next = level < list.length ? list[level] : null;
  const pct = next == null ? 100 : Math.max(0, Math.min(100, Math.floor(((v - reached) / (next - reached)) * 100)));
  return { level, reached, next, pct, toNext: next == null ? 0 : next - v };
}

// ── Days in a row ───────────────────────────────────────────────────────────────────────────
const DAY_MS = 86400000;
const KEY = /^\d{4}-\d{2}-\d{2}$/;
const noonMs = (k) => Date.parse(`${k}T12:00:00Z`);
const shift = (k, n) => new Date(noonMs(k) + n * DAY_MS).toISOString().slice(0, 10);

// The best run ever: what's stored (rhythm.js keeps it from 3.30), the run they're on or last
// had, and the longest stretch in the 30 days of dates — whichever is largest. Never smaller than
// a number they've already been shown.
export function bestStreakOf(profile, today) {
  return Math.max(
    num(profile?.bestStreak),
    num(profile?.streakDays),
    liveStreak(profile || {}, today),
    longestRun(profile?.activeDates),
  );
}

export const doneToday = (profile, today) =>
  profile?.lastGreetingDate === today || (Array.isArray(profile?.activeDates) && profile.activeDates.includes(today));

// This week, Monday first: which days had a kind act. Only filled days are drawn; nothing marks
// a day as missed.
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export function weekDots(profile, today) {
  if (!KEY.test(String(today || ""))) return [];
  const dow = (new Date(noonMs(today)).getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  const monday = shift(today, -dow);
  const active = new Set(Array.isArray(profile?.activeDates) ? profile.activeDates : []);
  if (typeof profile?.lastGreetingDate === "string") active.add(profile.lastGreetingDate);
  return LETTERS.map((letter, i) => {
    const key = shift(monday, i);
    return { key, letter, done: active.has(key), isToday: key === today, future: key > today };
  });
}

// The free rest day (rhythm.js): one missed day in any seven carries the run on. Shown as ready
// while there is a run to carry and it hasn't been used in the last week.
export function restDayReady(profile, today) {
  if (!liveStreak(profile || {}, today)) return false;
  const used = typeof profile?.graceUsedAt === "string" && KEY.test(profile.graceUsedAt) ? profile.graceUsedAt : null;
  if (!used) return true;
  return Math.round((noonMs(today) - noonMs(used)) / DAY_MS) >= GRACE_EVERY_DAYS;
}

// ── Hearts ──────────────────────────────────────────────────────────────────────────────────
const msOf = (t) => (typeof t?.toMillis === "function" ? t.toMillis() : Number(t) || 0);

export function heartsThisWeek(docs, now = Date.now(), myUid = null) {
  const from = now - 7 * DAY_MS;
  return (docs || []).filter((d) => {
    const at = msOf(d?.reactedAt);
    return at >= from && at <= now + 60000 && (!myUid || d?.reactorUid !== myUid);
  }).length;
}

// ── Countries ───────────────────────────────────────────────────────────────────────────────
// One entry per flag, so "UAE" and "United Arab Emirates" (both in the flag map) are one country.
// The longer name wins. Names with no flag aren't countries and are dropped.
function canonicalByFlag(flagMap) {
  const out = new Map();
  for (const [name, flag] of Object.entries(flagMap || {})) {
    const cur = out.get(flag);
    if (!cur || name.length > cur.length) out.set(flag, name);
  }
  return out;
}

// `stored` is the list already on the account (oldest first); `incoming` is whatever was seen
// now. Returns the whole collection, oldest first, and the countries that are new.
export function mergeCountries({ stored = [], incoming = [], flagMap = {} } = {}) {
  const canon = canonicalByFlag(flagMap);
  const norm = (c) => {
    const flag = flagMap[String(c || "").trim()];
    return flag ? canon.get(flag) : null;
  };
  const all = [];
  const seen = new Set();
  for (const c of stored || []) { const n = norm(c); if (n && !seen.has(n)) { seen.add(n); all.push(n); } }
  const added = [];
  for (const c of incoming || []) { const n = norm(c); if (n && !seen.has(n)) { seen.add(n); all.push(n); added.push(n); } }
  return { all: all.slice(0, WORLD_COUNTRIES), added };
}

// ── Levels reached, and which to announce ───────────────────────────────────────────────────
// `prev` is users/{uid}.badges — the highest level already announced for each stat. The first
// time a stat is seen (no entry yet) its level is recorded quietly: nobody should open 3.30 to a
// flood of "new level" messages for things they did months ago. A stat whose numbers haven't
// loaded yet is left alone. A jump of several levels announces only the highest, and a number
// that falls (a heart taken back) never lowers what was reached.
export function planBadges({ prev = null, values = {}, ready = {} } = {}) {
  const next = { ...(prev && typeof prev === "object" ? prev : {}) };
  const announce = [];
  let changed = false;
  for (const stat of STATS) {
    if (!ready[stat]) continue;
    const t = tierFor(values[stat], TIERS[stat]);
    const had = Number.isInteger(next[stat]) ? next[stat] : null;
    if (had == null) { next[stat] = t.level; changed = true; continue; }
    if (t.level > had) {
      announce.push({ stat, level: t.level, threshold: t.reached, value: num(values[stat]) });
      next[stat] = t.level;
      changed = true;
    }
  }
  return { next, announce, changed };
}
