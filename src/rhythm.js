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
