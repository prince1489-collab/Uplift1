// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// openDays.js — which days each person opened Seen (3.26).
//
// Seen's two aims are that everyone OPENS it once a day and USES it once a day. The second was
// measurable — `activeDates` keeps every day with a kind act for 30 days (rhythm.js) — but the
// first wasn't: `lastOpenDay` is overwritten on every open, so nobody could say whether someone
// opened Seen on Tuesday, only when they last did. And it was written once per SESSION, which on a
// phone can last days: a Tuesday return to Monday's still-running app counted for nothing.
//
// So each open now adds the LOCAL date to `openDates` (the last 60), and when a notification is
// what brought them — every push link carries `via=push` (api/_auth.js linkFor) — to
// `pushOpenDates` as well. That separates the two questions that matter: do people come back on
// their own, or only when they're reminded? `openBuild` says which build reported it, so the
// stats screen (usageStats.js) can tell how many people run a version that counts opens at all.
//
// Counts only, read only by the admin's stats screen; the privacy policy says so.

export const OPEN_DAYS_KEPT = 60;

// The list with `day` in it: sorted, no repeats, the newest `cap` kept. Not-a-date entries go.
export function nextOpenDates(list, day, cap = OPEN_DAYS_KEPT) {
  const ok = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
  const all = new Set((Array.isArray(list) ? list : []).filter(ok));
  if (ok(day)) all.add(day);
  return [...all].sort().slice(-cap);
}

// Did a tapped notification open this page? (`?via=push`, put on every push link.)
export function isPushOpen(search) {
  try { return new URLSearchParams(search || "").get("via") === "push"; } catch { return false; }
}

// What to write for an open on `day`, given the profile as it stands — or null when there is
// nothing new to say (today is already counted, and so is the notification if one brought them).
export function openUpdate(profile, day, { viaPush = false, build = null } = {}) {
  const opened = Array.isArray(profile?.openDates) && profile.openDates.includes(day);
  const pushed = Array.isArray(profile?.pushOpenDates) && profile.pushOpenDates.includes(day);
  if (opened && profile?.lastOpenDay === day && (!viaPush || pushed)) return null;
  const update = { lastOpenDay: day, openDates: nextOpenDates(profile?.openDates, day) };
  if (viaPush && !pushed) update.pushOpenDates = nextOpenDates(profile?.pushOpenDates, day);
  if (build) update.openBuild = String(build).slice(0, 12);
  return update;
}
