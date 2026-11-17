// test-rhythm.mjs — the streak's grace day, activeDays and the 30-day rhythm.
//
// These numbers are shown to people about themselves, and a certificate hangs off one of them,
// so every transition the transaction can make is pinned here. Pure functions, no emulator:
//   node scripts/test-rhythm.mjs

import { nextShowingUp, rhythmOf, withActiveDate, liveStreak, longestRun, GRACE_EVERY_DAYS } from "../src/rhythm.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);
const T = "2026-10-10";
const run = (data) => nextShowingUp(data, T, T);

// ── The streak ───────────────────────────────────────────────────────────────────────────────
let r = run({});
check("a first day starts at 1", r.streakDays === 1 && r.activeDays === 1, JSON.stringify(r));
check("a first day stamps when you began", r.firstActiveDate === T, r.firstActiveDate);

r = run({ lastGreetingDate: T, streakDays: 5, activeDays: 9, activeDates: [T] });
check("a second act the same day changes nothing", r.streakDays === 5 && r.activeDays === 9, JSON.stringify(r));

r = run({ lastGreetingDate: "2026-10-09", streakDays: 5, activeDays: 9 });
check("yesterday continues the streak", r.streakDays === 6 && r.activeDays === 10, JSON.stringify(r));
check("…and spends no grace", !("graceUsedAt" in r), JSON.stringify(r));

r = run({ lastGreetingDate: "2026-10-08", streakDays: 5, activeDays: 9 });
check("ONE missed day is forgiven", r.streakDays === 6, JSON.stringify(r));
check("…and the grace is recorded", r.graceUsedAt === T, r.graceUsedAt);

r = run({ lastGreetingDate: "2026-10-07", streakDays: 5, activeDays: 9 });
check("TWO missed days reset the streak", r.streakDays === 1, JSON.stringify(r));
check("…but never the days you showed up", r.activeDays === 10, r.activeDays);

r = run({ lastGreetingDate: "2026-10-08", streakDays: 5, graceUsedAt: "2026-10-05" });
check("a second miss within a week is not forgiven", r.streakDays === 1, JSON.stringify(r));

r = run({ lastGreetingDate: "2026-10-08", streakDays: 5, graceUsedAt: `2026-10-0${10 - GRACE_EVERY_DAYS}` });
check(`grace is available again after ${GRACE_EVERY_DAYS} days`, r.streakDays === 6, JSON.stringify(r));

r = nextShowingUp({ lastGreetingDate: "2026-02-28", streakDays: 3 }, "2026-03-02", "2026-03-02");
check("grace works across a month end", r.streakDays === 4, JSON.stringify(r));

r = run({ firstActiveDate: "2026-01-01", lastGreetingDate: "2026-10-09", streakDays: 1 });
check("the start date never moves", !("firstActiveDate" in r), JSON.stringify(r));

// ── activeDates and the rhythm ───────────────────────────────────────────────────────────────
const many = Array.from({ length: 40 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`).filter((d) => d <= "2026-08-31");
const kept = withActiveDate(many, T);
check("only the newest 30 dates are kept", kept.length === 30 && kept.at(-1) === T, `${kept.length} ${kept.at(-1)}`);
check("no duplicates when today is already there", withActiveDate([T, T], T).length === 1);
check("junk in the stored list is dropped", withActiveDate([T, 7, null], T).length === 1);

const now = new Date(2026, 9, 10, 12);
check("no record means no number", rhythmOf(undefined, now) === null && rhythmOf([], now) === null);
check("dates inside 30 days count", rhythmOf(["2026-10-10", "2026-10-01", "2026-09-11"], now) === 3, rhythmOf(["2026-10-10", "2026-10-01", "2026-09-11"], now));
check("a date 30 days back does not", rhythmOf(["2026-09-10", "2026-10-10"], now) === 1, rhythmOf(["2026-09-10", "2026-10-10"], now));

// ── The rhythm agrees with the streak (3.6) ────────────────────────────────────────────────
check("a 22-day streak reads at least 22 of 30, even with only today recorded",
  rhythmOf(["2026-10-10"], now, { days: 22, last: "2026-10-10" }) === 22,
  rhythmOf(["2026-10-10"], now, { days: 22, last: "2026-10-10" }));
check("streak days already recorded are not counted twice",
  rhythmOf(["2026-10-10", "2026-10-09"], now, { days: 2, last: "2026-10-10" }) === 2);
check("a 90-day streak never reads more than 30",
  rhythmOf([], now, { days: 90, last: "2026-10-10" }) === 30);
check("no streak and no record still means no number", rhythmOf([], now, { days: 0, last: null }) === null);
r = run({ lastGreetingDate: "2026-10-09", streakDays: 21, activeDays: 40 });
check("the first act after 3.6 backfills the stored dates from the streak",
  r.activeDates.length === 22 && r.activeDates.at(-1) === T && r.activeDates[0] === "2026-09-19",
  `${r.activeDates.length} ${r.activeDates[0]}`);

// ── An earlier day: a retried save, or an old UTC key ahead of the local date (3.21) ─────────
r = nextShowingUp({ lastGreetingDate: "2026-10-10", streakDays: 4, activeDays: 9, activeDates: ["2026-10-10"] }, "2026-10-09");
check("a retried earlier day joins the record", r.activeDates.includes("2026-10-09") && r.activeDays === 10, JSON.stringify(r));
check("…and leaves the streak and its date alone", !("streakDays" in r) && !("lastGreetingDate" in r), JSON.stringify(r));
r = nextShowingUp({ lastGreetingDate: "2026-10-11", streakDays: 6, activeDays: 12, activeDates: ["2026-10-10"] }, "2026-10-10");
check("an old UTC key a day ahead never resets the streak", !("streakDays" in r) && r.activeDays === 12, JSON.stringify(r));
check("a local day is the default for both keys", nextShowingUp({}, T).activeDates.at(-1) === T);

// ── The streak as it stands today ────────────────────────────────────────────────────────────
check("a streak counted today is alive", liveStreak({ streakDays: 5, lastGreetingDate: T }, T) === 5);
check("a streak counted yesterday is alive", liveStreak({ streakDays: 5, lastGreetingDate: "2026-10-09" }, T) === 5);
check("two days ago is alive while the grace day is free", liveStreak({ streakDays: 5, lastGreetingDate: "2026-10-08" }, T) === 5);
check("two days ago with grace just spent has ended", liveStreak({ streakDays: 5, lastGreetingDate: "2026-10-08", graceUsedAt: "2026-10-06" }, T) === 0);
check("three days ago has ended — no stale number in the header", liveStreak({ streakDays: 12, lastGreetingDate: "2026-10-07" }, T) === 0);
check("an old UTC key a day ahead still shows the streak", liveStreak({ streakDays: 3, lastGreetingDate: "2026-10-11" }, T) === 3);
check("no streak shows nothing", liveStreak({}, T) === 0 && liveStreak(null, T) === 0);

// ── The best run (3.30) ───────────────────────────────────────────────────────────────────────
r = run({ lastGreetingDate: "2026-10-09", streakDays: 5, activeDays: 9, bestStreak: 3 });
check("the best run rises with the streak", r.bestStreak === 6, JSON.stringify(r));
r = run({ lastGreetingDate: "2026-10-01", streakDays: 5, activeDays: 9, bestStreak: 20 });
check("…and never falls when a new run starts", r.streakDays === 1 && !("bestStreak" in r), JSON.stringify(r));
r = run({ lastGreetingDate: "2026-10-09", streakDays: 1, activeDays: 9, activeDates: ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-09"] });
check("the first time, it starts from the longest stretch in the dates", r.bestStreak === 4, JSON.stringify(r));
r = nextShowingUp({ lastGreetingDate: "2026-10-12", streakDays: 4, bestStreak: 2 }, "2026-10-11", "2026-10-11");
check("an earlier day being saved late leaves it alone", !("bestStreak" in r), JSON.stringify(r));
check("longestRun counts consecutive days only", longestRun(["2026-10-01", "2026-10-02", "2026-10-04"]) === 2);

let failed = 0;
for (const [ok, name] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} rhythm tests passed.`);
process.exit(failed ? 1 : 0);
