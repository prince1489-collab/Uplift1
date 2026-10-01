// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// rhythm.js — "N of the last 30 days", the forgiving cousin of the streak.
//
// A streak makes one missed day cost everything that came before it, which is exactly the moment
// somebody who travelled for a weekend decides it is not worth rebuilding. A rhythm loses one
// day's worth when a day is missed, and nothing else.
//
// Counted from users/{uid}.activeDates — the exact local dates somebody showed up, the last
// ACTIVE_DATES_KEEP of them, kept by recordGreetingDay in the same transaction as the streak.
// Null when that record does not exist yet (accounts not seen since it shipped): no estimate
// stands in for a number shown to the person it describes.

export const RHYTHM_WINDOW = 30;
export const ACTIVE_DATES_KEEP = 30;

const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function rhythmOf(activeDates, now = new Date()) {
  if (!Array.isArray(activeDates) || !activeDates.length) return null;
  const from = new Date(now);
  from.setDate(from.getDate() - (RHYTHM_WINDOW - 1));
  const lo = key(from), hi = key(now);
  return new Set(activeDates.filter((d) => typeof d === "string" && d >= lo && d <= hi)).size;
}

// The list after showing up on `today`: deduplicated, sorted, newest ACTIVE_DATES_KEEP only.
export function withActiveDate(activeDates, today) {
  const set = new Set(Array.isArray(activeDates) ? activeDates.filter((d) => typeof d === "string") : []);
  set.add(today);
  return [...set].sort().slice(-ACTIVE_DATES_KEEP);
}

// ── One transaction's worth of "you showed up today" ─────────────────────────────────────────
// Pure, so the streak, the grace day, activeDays and activeDates can be tested without
// Firestore (scripts/test-rhythm.mjs). recordGreetingDay runs it inside its transaction.
//
// `today` is the key the streak has always used (UTC — changing it now would break or
// double-count live streaks on the day it shipped). `localToday` is the person's own calendar
// date, which is what activeDates holds, because "N of the last 30 days" is read on their phone
// against their own days.
//
// THE GRACE DAY. A gap of exactly one missed day continues the streak instead of resetting it,
// at most once in any seven days. Life has weekends away and phones left in drawers; the streak
// should survive one of those without the person having to know a rule exists, and should not
// survive a week of absence. Paid freezes are untouched — this is the free one nothing provided.
export const GRACE_EVERY_DAYS = 7;

const DAY_MS = 86400000;
const keyToUtcMs = (k) => Date.parse(`${k}T00:00:00Z`);
const shiftKey = (k, n) => new Date(keyToUtcMs(k) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / DAY_MS);

export function nextShowingUp(data, today, localToday) {
  const lastDate = data.lastGreetingDate ?? "";
  const currentStreak = Number(data.streakDays ?? 0);
  const countedToday = lastDate === today;

  let streakDays = 1;
  let graceUsedAt = null;
  if (countedToday) streakDays = currentStreak;
  else if (lastDate === shiftKey(today, -1)) streakDays = currentStreak + 1;
  else if (lastDate === shiftKey(today, -2) && currentStreak > 0) {
    const last = typeof data.graceUsedAt === "string" ? data.graceUsedAt : null;
    if (!last || daysBetween(last, today) >= GRACE_EVERY_DAYS) {
      streakDays = currentStreak + 1;
      graceUsedAt = today;
    }
  }

  // Days you showed up at all, which is not the streak — see the note in recordGreetingDay.
  const activeDays = Math.max(Number(data.activeDays ?? 0), currentStreak) + (countedToday ? 0 : 1);

  const fields = {
    streakDays,
    lastGreetingDate: today,
    activeDays,
    activeDates: withActiveDate(data.activeDates, localToday),
  };
  if (graceUsedAt) fields.graceUsedAt = graceUsedAt;
  if (!data.firstActiveDate) fields.firstActiveDate = today;
  return fields;
}
