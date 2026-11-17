// test-open-days.mjs — which days each person opened Seen, and whether a notification did it (3.26).
//
//   node scripts/test-open-days.mjs

import { nextOpenDates, isPushOpen, openUpdate, OPEN_DAYS_KEPT } from "../src/openDays.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);
const D = "2026-11-18";

// ── The list ──
check("today is added", JSON.stringify(nextOpenDates([], D)) === JSON.stringify([D]));
check("…once", nextOpenDates([D], D).length === 1);
check("kept in date order", nextOpenDates(["2026-11-17", "2026-11-15"], "2026-11-16").join() === "2026-11-15,2026-11-16,2026-11-17");
check("not-a-date entries are dropped", nextOpenDates(["x", null, 7, "2026-11-17"], D).join() === `2026-11-17,${D}`);
const long = Array.from({ length: 80 }, (_, i) => new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10));
const kept = nextOpenDates(long, D);
check(`only the newest ${OPEN_DAYS_KEPT} are kept`, kept.length === OPEN_DAYS_KEPT && kept[kept.length - 1] === D && !kept.includes(long[0]));
check("a missing list is fine", nextOpenDates(undefined, D).join() === D);

// ── Was it a notification? ──
check("?via=push is a notification", isPushOpen("?via=push") && isPushOpen("?open=practice&via=push"));
check("anything else isn't", !isPushOpen("") && !isPushOpen("?open=practice") && !isPushOpen("?via=pushy") && !isPushOpen(undefined));

// ── What gets written ──
const u = openUpdate({ lastOpenDay: "2026-11-17", openDates: ["2026-11-17"] }, D, { build: "ff7523e" });
check("a new day writes lastOpenDay, the list and the build", u.lastOpenDay === D && u.openDates.join() === `2026-11-17,${D}` && u.openBuild === "ff7523e" && !("pushOpenDates" in u));
check("a second open the same day writes nothing", openUpdate({ lastOpenDay: D, openDates: [D] }, D) === null);
const p = openUpdate({ lastOpenDay: D, openDates: [D] }, D, { viaPush: true });
check("…unless a notification brought them, which is recorded once", p?.pushOpenDates?.join() === D);
check("…and then nothing again", openUpdate({ lastOpenDay: D, openDates: [D], pushOpenDates: [D] }, D, { viaPush: true }) === null);
check("someone on an older version (lastOpenDay only) starts their list", openUpdate({ lastOpenDay: D }, D)?.openDates?.join() === D);
check("a first-ever open works from nothing", openUpdate({}, D, { viaPush: true })?.pushOpenDates?.join() === D);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} open-day tests passed.`);
process.exit(failed ? 1 : 0);
