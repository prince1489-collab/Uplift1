// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// usageStats.js — "How Seen is doing" (3.26): the two aims, counted. (Not adminStats.js: that
// and AdminStats.jsx are the same file name on a Mac, which breaks the iOS build — check:case.)
//
// Seen's aims are that everyone OPENS it once a day and USES it — any kind act — once a day.
// This turns every users/{uid} document into counts for the admin's stats screen
// (AdminStats.jsx), which is the only place it is used. Counts only: nothing here returns a name,
// an email or an id, and the screen shows nothing else.
//
//   • acts per day come from `activeDates` (the last 30 local days, every version — rhythm.js);
//   • opens per day from `openDates`, and opens a notification caused from `pushOpenDates`
//     (openDays.js) — only from 3.26 on, so each day's opens are counted among the people whose
//     app was already reporting them that day, and the screen says how many that is;
//   • "where everyone is" from the latest of lastOpenDay / openDates / activeDates.
//
// Days are compared as the YYYY-MM-DD strings each person's own device wrote, against the admin's
// today — close enough for a daily count, and the same convention the reminder sender uses.
// Mirrors what scripts/retention.mjs does with server keys, without needing them.

const isDay = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const days = (list) => (Array.isArray(list) ? list.filter(isDay) : []);

// `today` and the `n - 1` days before it, newest first.
export function lastDays(today, n) {
  const t = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(t)) return [];
  return Array.from({ length: n }, (_, i) => new Date(t - i * 86400000).toISOString().slice(0, 10));
}

export function daysBetween(a, b) {
  const x = Date.parse(`${a}T00:00:00Z`), y = Date.parse(`${b}T00:00:00Z`);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86400000) : null;
}

// Someone who got past signing in: finished onboarding, or has ever opened or acted.
export function isPerson(u) {
  return Boolean(u && (u.onboardingCompletedAt || isDay(u.lastOpenDay) || days(u.activeDates).length
    || days(u.openDates).length || Number(u.activeDays) > 0));
}

// Devices a reminder can go to, and on which platforms (fcmTokens map + the legacy single token).
export function devicesOf(u) {
  const out = [];
  const map = u?.fcmTokens;
  if (map && typeof map === "object") {
    for (const v of Object.values(map)) if (v && typeof v === "object" && v.token) out.push(v.platform || "web");
  }
  if (u?.fcmToken && !out.length) out.push("unknown");
  return out;
}
export const canRemind = (u) => devicesOf(u).length > 0 && typeof u?.timezone === "string" && u.timezone.length > 0;

// The last day there is any sign of them.
export function lastSeen(u) {
  const all = [u?.lastOpenDay, ...days(u?.openDates), ...days(u?.activeDates)].filter(isDay).sort();
  return all.length ? all[all.length - 1] : null;
}

export const RECENCY = [
  { id: "today", label: "Today", test: (d) => d === 0 },
  { id: "1-2", label: "1–2 days ago", test: (d) => d >= 1 && d <= 2 },
  { id: "3-6", label: "3–6 days ago", test: (d) => d >= 3 && d <= 6 },
  { id: "7-29", label: "1–4 weeks ago", test: (d) => d >= 7 && d <= 29 },
  { id: "30+", label: "A month or more", test: (d) => d >= 30 },
];
export const DEPTH = [
  { id: "0", label: "No acts", test: (n) => n === 0 },
  { id: "1-7", label: "1–7 days", test: (n) => n >= 1 && n <= 7 },
  { id: "8-20", label: "8–20 days", test: (n) => n >= 8 && n <= 20 },
  { id: "21-30", label: "21–30 days", test: (n) => n >= 21 },
];

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

// A daily share of opens is only shown once at least this many people's apps report them. With
// the first one to three phones on 3.26 it read "75% opened each day" — true of three people and
// misleading about ninety-seven.
export const MIN_COUNTED = 10;
const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };

export function summarise(users, { today, adminUid = null, withoutMe = false, window = 30 } = {}) {
  const all = (Array.isArray(users) ? users : []).filter(Boolean);
  const pool = withoutMe && adminUid ? all.filter((u) => u.id !== adminUid) : all;
  const people = pool.filter(isPerson);
  const P = people.length;
  const range = lastDays(today, window);

  // When each person's app started reporting opens: their earliest recorded open day.
  const reportingFrom = new Map(people.map((u) => [u, days(u.openDates).sort()[0] || null]));
  const firstOpenDay = [...reportingFrom.values()].filter(Boolean).sort()[0] || null;

  const series = range.map((day) => {
    const acted = people.filter((u) => days(u.activeDates).includes(day)).length;
    const reporting = people.filter((u) => reportingFrom.get(u) && reportingFrom.get(u) <= day);
    const opened = reporting.filter((u) => days(u.openDates).includes(day)).length;
    const fromPush = reporting.filter((u) => days(u.pushOpenDates).includes(day)).length;
    return {
      day, acted, actedPct: pct(acted, P),
      reporting: reporting.length,
      opened: reporting.length ? opened : null,
      openedPct: reporting.length ? pct(opened, reporting.length) : null,
      fromPush: reporting.length ? fromPush : null,
    };
  });

  const t = series[0] || { acted: 0, opened: null, fromPush: null, reporting: 0 };
  const openedToday = people.filter((u) => u.lastOpenDay === today || days(u.openDates).includes(today)).length;
  const week = series.slice(0, 7);

  const recency = RECENCY.map((b) => ({
    ...b, count: people.filter((u) => { const s = lastSeen(u); const d = s ? daysBetween(s, today) : null; return d != null && b.test(d); }).length,
  }));
  const never = people.filter((u) => !lastSeen(u)).length;

  const inWindow = (u) => days(u.activeDates).filter((d) => { const n = daysBetween(d, today); return n != null && n >= 0 && n < 30; }).length;
  const depth = DEPTH.map((b) => ({ ...b, count: people.filter((u) => b.test(inWindow(u))).length }));

  const platforms = { ios: 0, android: 0, web: 0, unknown: 0 };
  for (const u of people) for (const p of new Set(devicesOf(u))) platforms[p in platforms ? p : "unknown"] += 1;
  const hours = new Map();
  for (const u of people) {
    const h = Number.isInteger(u.nudgeHour) ? u.nudgeHour : null;
    hours.set(h, (hours.get(h) || 0) + 1);
  }

  const builds = new Map();
  for (const u of people) if (u.openBuild) builds.set(u.openBuild, (builds.get(u.openBuild) || 0) + 1);

  const sum = (k) => people.reduce((s, u) => s + (Number(u[k]) || 0), 0);
  return {
    accounts: pool.length,
    people: P,
    unfinished: pool.length - P,
    today: {
      opened: openedToday,
      acted: t.acted,
      fromPush: t.fromPush,
      planned: people.filter((u) => u.realLifePlan?.date === today).length,
    },
    week: {
      actedPct: mean(week.map((d) => d.actedPct)),
      // The most people counted on any day this week, and the average only when that is enough.
      counted: Math.max(0, ...week.map((d) => d.reporting || 0)),
      openedPct: Math.max(0, ...week.map((d) => d.reporting || 0)) >= MIN_COUNTED ? mean(week.map((d) => d.openedPct)) : null,
      pushShare: (() => {
        const o = week.reduce((s, d) => s + (d.opened || 0), 0);
        const p = week.reduce((s, d) => s + (d.fromPush || 0), 0);
        return pct(p, o);
      })(),
    },
    series,
    firstOpenDay,
    recency, never,
    depth,
    reach: {
      canRemind: people.filter(canRemind).length,
      platforms,
      hours: [...hours.entries()].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99)).map(([hour, count]) => ({ hour, count })),
      evening: people.filter((u) => u.eveningReminders === true).length,
    },
    coverage: {
      reporting: people.filter((u) => u.openBuild || days(u.openDates).length).length,
      builds: [...builds.entries()].sort((a, b) => b[1] - a[1]).map(([build, count]) => ({ build, count })),
    },
    totals: {
      messages: sum("greetingsSentCount"),
      replies: sum("seenRepliesSent"),
      realLife: sum("seenActsDone"),
    },
  };
}
