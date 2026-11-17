// test-admin-stats.mjs — "How Seen is doing" counts the two aims correctly, and only counts (3.26).
//
//   node scripts/test-admin-stats.mjs

import { summarise, lastDays, isPerson, canRemind, lastSeen, lifetimeDays, isTestAccount, MIN_COUNTED } from "../src/usageStats.js";

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

// The weekly share of opens waits until enough phones count them (the "75%" of three people).
check("too few counted: no weekly open share, but how many are counted", s.week.openedPct === null && s.week.counted === 2, JSON.stringify(s.week));
const many = Array.from({ length: MIN_COUNTED }, (_, i) => ({ id: "r" + i, onboardingCompletedAt: 1, lastOpenDay: T, openDates: i % 2 ? [ago(1), T] : [ago(1)] }));
const m = summarise(many, { today: T });
check(`from ${MIN_COUNTED} counted, the weekly share appears`, m.week.counted === MIN_COUNTED && m.week.openedPct === 75, JSON.stringify(m.week));

// ── 3.26.1: people who left before the open and 30-day records began ──
const joinedMs = (n) => Date.parse(`${ago(n)}T12:00:00Z`);
const olds = [
  { id: "o1", onboardingCompletedAt: joinedMs(60), lastGreetingDate: ago(45), activeDays: 12 }, // used it for weeks, left 6 weeks ago
  { id: "o2", onboardingCompletedAt: joinedMs(40), lastGreetingDate: ago(40), activeDays: 1 },  // tried it once
  { id: "o3", onboardingCompletedAt: joinedMs(3) },                                               // signed up this week, nothing yet
  { id: "o4", onboardingCompletedAt: 1, activeDays: 4 },                                          // used it, no date kept
];
const o = summarise(olds, { today: T });
check("the last kind act counts as a sign of them, however old", o.recency.find((b) => b.id === "30+").count === 2 && lastSeen(olds[0]) === ago(45));
check("'never' means never did anything", o.never === 1 && o.undated === 1, JSON.stringify([o.never, o.undated]));
check("lifetime days: never / just 1 / 2-6 / 7-29", ["0", "1", "2-6", "7-29"].map((id) => o.lifetime.find((b) => b.id === id).count).join() === "1,1,1,1",
  JSON.stringify(o.lifetime.map((b) => b.count)));
check("lifetimeDays never undercounts the 30-day record", lifetimeDays({ activeDays: 2, activeDates: [T, ago(1), ago(2)] }) === 3);
check("joined: this week, 1-3 months, unknown", o.joined.find((b) => b.id === "7").count === 1 && o.joined.find((b) => b.id === "90").count === 2 && o.joinedUnknown === 0,
  JSON.stringify([o.joined.map((b) => b.count), o.joinedUnknown]));
check("joined at time 1 (a placeholder) reads as long ago, not unknown", o.joined.find((b) => b.id === "older").count === 1);
// As Firestore hands it back: a Timestamp (toMillis) — or a plain { seconds } after a JSON round trip.
const ts = (n) => ({ toMillis: () => joinedMs(n) });
const f = summarise([{ id: "t1", onboardingCompletedAt: ts(2) }, { id: "t2", onboardingCompletedAt: { seconds: joinedMs(20) / 1000, nanoseconds: 0 } }, { id: "t3", onboardingCompletedAt: "x", activeDays: 1 }], { today: T });
check("join dates from Firestore Timestamps", f.joined.find((b) => b.id === "7").count === 1 && f.joined.find((b) => b.id === "30").count === 1 && f.joinedUnknown === 1,
  JSON.stringify([f.joined.map((b) => b.count), f.joinedUnknown]));
check("reach split: acted in 30 days, reachable vs not", s.reach.actedReachable === 2 && s.reach.actedUnreachable === 2, JSON.stringify(s.reach));

// ── Test accounts ("test" in the email or name) ──
check("test accounts are recognised in any case", isTestAccount({ email: "test1@x.com" }) && isTestAccount({ email: "seen.TEST@x.com" })
  && isTestAccount({ fullName: "Test User" }) && !isTestAccount({ email: "maria@x.com", fullName: "Maria" }) && !isTestAccount({}) && !isTestAccount(null));
const withTests = [...users, { id: "x1", onboardingCompletedAt: 1, email: "test1@x.com", activeDates: [T] }, { id: "x2", onboardingCompletedAt: 1, fullName: "Seen Test", lastOpenDay: T }];
const keep = summarise(withTests, { today: T });
const drop = summarise(withTests, { today: T, withoutTests: true });
check("with tests: they count", keep.people === 7 && keep.today.acted === 3 && keep.testsLeftOut === 0, JSON.stringify([keep.people, keep.today.acted]));
check("without tests: left out of everything, and how many is said", drop.people === 5 && drop.today.acted === 2 && drop.today.opened === 2 && drop.testsLeftOut === 2,
  JSON.stringify([drop.people, drop.today, drop.testsLeftOut]));
check("both switches together", summarise(withTests, { today: T, adminUid: "me", withoutMe: true, withoutTests: true }).people === 4);
check("still nothing identifying comes back", !/test1@|Seen Test|"x1"|"x2"/.test(JSON.stringify(drop)));

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
