// test-grow-stats.mjs — the three Grow numbers and their levels (3.30).
//   node scripts/test-grow-stats.mjs

import {
  tierFor, longestRun, bestStreakOf, weekDots, restDayReady, restDayShown, firstLevelLabel, heartsThisWeek, mergeCountries, planBadges, doneToday,
  STREAK_TIERS, HEART_TIERS, MILESTONES, WORLD_COUNTRIES,
} from "../src/growStats.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);
const J = JSON.stringify;

// ── Levels ──────────────────────────────────────────────────────────────────────────────────
let t = tierFor(0, STREAK_TIERS);
check("before the first rung: level 0, aiming for 3", t.level === 0 && t.next === 3 && t.pct === 0, J(t));
t = tierFor(3, STREAK_TIERS);
check("exactly on a rung counts as reached", t.level === 1 && t.reached === 3 && t.next === 7 && t.pct === 0, J(t));
t = tierFor(5, STREAK_TIERS);
check("between rungs: half way from 3 to 7", t.level === 1 && t.pct === 50 && t.toNext === 2, J(t));
t = tierFor(400, STREAK_TIERS);
check("past the top rung: no next, a full bar", t.level === STREAK_TIERS.length && t.next === null && t.pct === 100, J(t));
for (const bad of [NaN, -4, undefined, null, "x"]) {
  const b = tierFor(bad, HEART_TIERS);
  check(`a bad value (${String(bad)}) reads as nothing yet`, b.level === 0 && b.pct === 0 && b.next === 10, J(b));
}
let lastPct = -1, monotonic = true;
for (let v = 10; v < 25; v++) { const p = tierFor(v, HEART_TIERS).pct; if (p < lastPct || p < 0 || p > 100) monotonic = false; lastPct = p; }
check("the bar only moves forward within a level, and stays 0–100", monotonic);
check("country levels are the old impact milestones", J(MILESTONES) === J([1, 5, 10, 20, 35, 50, 75, 100]));

// ── Days in a row ───────────────────────────────────────────────────────────────────────────
check("no dates: a run of 0", longestRun([]) === 0 && longestRun(null) === 0);
check("unsorted, repeated and junk entries still give the run",
  longestRun(["2026-11-03", "2026-11-01", 7, "2026-11-02", "2026-11-02", "nope", "2026-11-05"]) === 3);
check("a run carries across the end of a month", longestRun(["2026-10-30", "2026-10-31", "2026-11-01"]) === 3);
check("…and the end of a year", longestRun(["2026-12-31", "2027-01-01"]) === 2);
check("…and the clocks going back (UK, 25 Oct)", longestRun(["2026-10-24", "2026-10-25", "2026-10-26"]) === 3);

const today = "2026-11-17";
check("best is never below what's stored", bestStreakOf({ bestStreak: 21, streakDays: 3, lastGreetingDate: today }, today) === 21);
check("best includes the run you're on", bestStreakOf({ bestStreak: 4, streakDays: 9, lastGreetingDate: today }, today) === 9);
check("best includes a run that has ended (it still happened)", bestStreakOf({ streakDays: 12, lastGreetingDate: "2026-10-01" }, today) === 12);
check("best includes the longest stretch in the 30 days of dates",
  bestStreakOf({ activeDates: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-10"] }, today) === 4);
check("a new account has a best of 0", bestStreakOf({}, today) === 0);

let dots = weekDots({ activeDates: ["2026-11-16", "2026-11-10"], lastGreetingDate: "2026-11-17" }, "2026-11-17");
check("seven days, Monday first", dots.length === 7 && dots[0].key === "2026-11-16" && dots[6].key === "2026-11-22", J(dots.map((d) => d.key)));
check("done days are this week's only", dots.filter((d) => d.done).map((d) => d.key).join() === "2026-11-16,2026-11-17", J(dots));
check("today is marked, later days are future", dots[1].isToday && dots[2].future && !dots[0].future);
dots = weekDots({}, "2026-11-22");
check("on a Sunday the week began six days before", dots[0].key === "2026-11-16" && dots[6].isToday);
dots = weekDots({}, "2027-01-01");
check("a week across the new year", dots[0].key === "2026-12-28" && dots[4].key === "2027-01-01");
check("done today from the date list or the last day counted",
  doneToday({ activeDates: [today] }, today) && doneToday({ lastGreetingDate: today }, today) && !doneToday({ lastGreetingDate: "2026-11-16" }, today));

check("rest day ready when it has never been used", restDayReady({ streakDays: 5, lastGreetingDate: "2026-11-16" }, today));
check("…not when it was used three days ago", !restDayReady({ streakDays: 5, lastGreetingDate: "2026-11-16", graceUsedAt: "2026-11-14" }, today));
check("…ready again after seven days", restDayReady({ streakDays: 9, lastGreetingDate: today, graceUsedAt: "2026-11-10" }, today));
check("…and not offered with no run to carry", !restDayReady({ streakDays: 5, lastGreetingDate: "2026-11-01" }, today));

// ── Hearts ──────────────────────────────────────────────────────────────────────────────────
const NOW = Date.parse("2026-11-17T12:00:00Z");
const ts = (ms) => ({ toMillis: () => ms });
const hearts = [
  { reactedAt: NOW - 3600000, reactorUid: "a" },
  { reactedAt: ts(NOW - 2 * 86400000), reactorUid: "b" },
  { reactedAt: NOW - 9 * 86400000, reactorUid: "c" },
  { reactedAt: NOW - 3600000, reactorUid: "me" },
  { reactorUid: "d" },
];
check("hearts this week: last 7 days, Timestamps too, not your own, not undated", heartsThisWeek(hearts, NOW, "me") === 2, String(heartsThisWeek(hearts, NOW, "me")));

// ── Countries ───────────────────────────────────────────────────────────────────────────────
const flagMap = { India: "🇮🇳", Algeria: "🇩🇿", "United Arab Emirates": "🇦🇪", UAE: "🇦🇪", Canada: "🇨🇦" };
let m = mergeCountries({ stored: ["India"], incoming: ["Algeria", "UAE", "United Arab Emirates", "India", "", null, "Atlantis"], flagMap });
check("new countries are added once, in order", J(m.all) === J(["India", "Algeria", "United Arab Emirates"]), J(m));
check("…'UAE' and 'United Arab Emirates' are one country", m.added.length === 2 && J(m.added) === J(["Algeria", "United Arab Emirates"]), J(m.added));
m = mergeCountries({ stored: ["UAE", "India"], incoming: ["United Arab Emirates", "India"], flagMap });
check("nothing already collected counts as new", m.added.length === 0 && m.all.length === 2, J(m));
check("the world has 197 countries to collect", WORLD_COUNTRIES === 197);

// ── Levels to announce ──────────────────────────────────────────────────────────────────────
const ready = { streak: true, hearts: true, countries: true };
let p = planBadges({ prev: null, values: { streak: 30, hearts: 170, countries: 12 }, ready });
check("first run: levels recorded quietly", p.announce.length === 0 && p.changed && p.next.streak === 4 && p.next.hearts === 4 && p.next.countries === 3, J(p));
p = planBadges({ prev: { streak: 4 }, values: { streak: 30, hearts: 170, countries: 12 }, ready: { streak: true, hearts: false, countries: true } });
check("a stat that hasn't loaded is left alone", !("hearts" in p.next) && p.next.countries === 3 && p.announce.length === 0, J(p));
p = planBadges({ prev: { streak: 4, hearts: 4, countries: 3 }, values: { streak: 30, hearts: 260, countries: 12 }, ready });
check("a new level is announced", p.announce.length === 1 && p.announce[0].stat === "hearts" && p.announce[0].level === 5 && p.announce[0].threshold === 250, J(p));
p = planBadges({ prev: { streak: 1, hearts: 4, countries: 3 }, values: { streak: 30, hearts: 170, countries: 12 }, ready });
check("a jump of several levels announces only the highest", p.announce.length === 1 && p.announce[0].level === 4 && p.announce[0].threshold === 30, J(p));
p = planBadges({ prev: { streak: 4, hearts: 5, countries: 3 }, values: { streak: 30, hearts: 240, countries: 12 }, ready });
check("a number that falls announces nothing and lowers nothing", p.announce.length === 0 && !p.changed && p.next.hearts === 5, J(p));

// ── 3.31.1: day one ─────────────────────────────────────────────────────────────────────────
check("no rest-day note on a 1- or 2-day run", !restDayShown({ streakDays: 1, lastGreetingDate: today }, today) && !restDayShown({ streakDays: 2, lastGreetingDate: today }, today));
check("…shown from 3 days", restDayShown({ streakDays: 3, lastGreetingDate: today }, today));
check("…and not once the rest day has been used", !restDayShown({ streakDays: 5, lastGreetingDate: today, graceUsedAt: "2026-11-15" }, today));
check("before the first level, a goal — never \"Level 0\"",
  firstLevelLabel("streak") === "Level 1 at 3 days" && firstLevelLabel("hearts") === "Level 1 at 10 hearts" && firstLevelLabel("countries") === "Level 1 at 1 country",
  [firstLevelLabel("streak"), firstLevelLabel("hearts"), firstLevelLabel("countries")].join(" | "));

let failed = 0;
for (const [ok, line] of results) { console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} grow-stats tests passed.`);
process.exit(failed ? 1 : 0);
