// test-admin-stats.mjs — "How Seen is doing" counts the two aims correctly, and only counts (3.26).
//
//   node scripts/test-admin-stats.mjs

import { summarise, lastDays, isPerson, canRemind, lastSeen } from "../src/usageStats.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);
const T = "2026-11-18";
const ago = (n) => lastDays(T, n + 1)[n];

const users = [
  // me: every day, from a phone on 3.26
  { id: "me", onboardingCompletedAt: 1, lastOpenDay: T, openDates: [ago(1), T], activeDates: lastDays(T, 30), timezone: "Europe/London",
    fcmTokens: { a: { token: "t1", platform: "android" } }, nudgeHour: 12, openBuild: "abc1234", greetingsSentCount: 40, seenRepliesSent: 10, seenActsDone: 5 },
  // opened today from a notification, acted today; iPhone; on 3.26
  { id: "u1", onboardingCompletedAt: 1, lastOpenDay: T, openDates: [ago(2), T], pushOpenDates: [T], activeDates: [T, ago(3)], timezone: "Asia/Kolkata",
    fcmTokens: { b: { token: "t2", platform: "ios" } }, nudgeHour: 9, openBuild: "abc1234", realLifePlan: { date: T, hour: 17 }, greetingsSentCount: 3 },
  // opened yesterday, older version (no openDates), web, no timezone — can't be reminded
  { id: "u2", onboardingCompletedAt: 1, lastOpenDay: ago(1), activeDates: [ago(1), ago(8)], fcmTokens: { c: { token: "t3", platform: "web" } } },
  // drifting: last act 10 days ago
  { id: "u3", onboardingCompletedAt: 1, lastOpenDay: ago(10), activeDates: [ago(10)] },
  // signed up, never did anything
  { id: "u4", onboardingCompletedAt: 1 },
  // signed in, never finished setting up
  { id: "u5" },
];

const s = summarise(users, { today: T, adminUid: "me", withoutMe: false });
check("people are those who got past signing in", s.accounts === 6 && s.people === 5 && s.unfinished === 1, JSON.stringify([s.accounts, s.people, s.unfinished]));
check("today: two opened, two acted, one from a notification", s.today.opened === 2 && s.today.acted === 2 && s.today.fromPush === 1, JSON.stringify(s.today));
check("today: one real-life plan", s.today.planned === 1);
check("a 30-day series, newest first", s.series.length === 30 && s.series[0].day === T && s.series[29].day === ago(29));
check("acts per day are counted for everyone", s.series[1].acted === 2 && s.series[1].actedPct === 40, JSON.stringify(s.series[1]));
check("opens per day only among people already reporting", s.series[0].reporting === 2 && s.series[0].opened === 2 && s.series[0].openedPct === 100, JSON.stringify(s.series[0]));
check("…someone not yet reporting on a day isn't counted as not opening", s.series[2].reporting === 1 && s.series[2].opened === 1 && s.series[2].openedPct === 100, JSON.stringify(s.series[2]));
check("…while a reporting person who didn't open is", s.series[1].reporting === 2 && s.series[1].opened === 1 && s.series[1].openedPct === 50, JSON.stringify(s.series[1]));
check("…and before anyone reported, opens are unknown, not zero", s.series[5].opened === null && s.series[5].openedPct === null);
check("the day opens started counting", s.firstOpenDay === ago(2));
const bucket = (id) => s.recency.find((b) => b.id === id).count;
check("where everyone is", bucket("today") === 2 && bucket("1-2") === 1 && bucket("7-29") === 1 && s.never === 1, JSON.stringify(s.recency.map((b) => b.count)) + " never " + s.never);
const depth = (id) => s.depth.find((b) => b.id === id).count;
check("habit depth over the last 30 days", depth("21-30") === 1 && depth("1-7") === 3 && depth("0") === 1, JSON.stringify(s.depth.map((b) => b.count)));
check("reach: a device and a timezone", s.reach.canRemind === 2 && s.reach.platforms.ios === 1 && s.reach.platforms.android === 1 && s.reach.platforms.web === 1);
check("reminder hours, unchosen as its own row", s.reach.hours.some((h) => h.hour === null && h.count === 3) && s.reach.hours.some((h) => h.hour === 12));
check("coverage: two on a reporting version", s.coverage.reporting === 2 && s.coverage.builds[0]?.build === "abc1234");
check("totals add up", s.totals.messages === 43 && s.totals.replies === 10 && s.totals.realLife === 5);

const w = summarise(users, { today: T, adminUid: "me", withoutMe: true });
check("without me: one fewer person, and my every-day habit leaves the numbers", w.people === 4 && w.today.opened === 1 && w.depth.find((b) => b.id === "21-30").count === 0);
check("without me changes nothing if there's no admin id", summarise(users, { today: T, withoutMe: true }).people === 5);

// ── Only counts ──
const text = JSON.stringify(s);
check("nothing identifying comes back", !/"(me|u1|u2|u3|u4|u5)"/.test(text) && !/Kolkata|London|t1|t2/.test(text));

// ── Helpers ──
check("isPerson", isPerson({ onboardingCompletedAt: 1 }) && isPerson({ activeDates: [T] }) && !isPerson({}) && !isPerson(null));
check("canRemind needs both a device and a timezone", canRemind(users[1]) && !canRemind(users[2]) && !canRemind({ timezone: "x" }));
check("lastSeen is the latest sign of them", lastSeen(users[2]) === ago(1) && lastSeen({}) === null);
check("an empty list is fine", summarise([], { today: T }).people === 0 && summarise(undefined, { today: T }).series.length === 30);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} stats tests passed.`);
process.exit(failed ? 1 : 0);
