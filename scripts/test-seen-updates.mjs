// test-seen-updates.mjs — what the app tells you in Seen (3.30).
//   node scripts/test-seen-updates.mjs

import {
  recapWeekKey, weeklyRecap, stageUpdate, badgeUpdate, certUpdate, parseAction, canCreate, MAX_UPDATE,
} from "../src/seenUpdates.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
// The repo's no-guilt rule (scripts/check-reflect.cjs).
const GUILT = /streak|don't lose|running out|last chance|still haven't|should have|failed|miss(ed)? out/i;

// ── Which week ──────────────────────────────────────────────────────────────────────────────
check("Sunday 22 Nov: this week, from Monday 16th", recapWeekKey(at(2026, 11, 22)) === "2026-11-16", recapWeekKey(at(2026, 11, 22)));
check("Monday 23 Nov: the week just gone", recapWeekKey(at(2026, 11, 23)) === "2026-11-16");
check("Tuesday 24 Nov: still the week just gone", recapWeekKey(at(2026, 11, 24)) === "2026-11-16");
check("Wednesday to Saturday: no recap", [25, 26, 27, 28].every((d) => recapWeekKey(at(2026, 11, d)) === null));
check("across the new year: Sunday 3 Jan 2027 → Monday 28 Dec", recapWeekKey(at(2027, 1, 3)) === "2026-12-28", recapWeekKey(at(2027, 1, 3)));

// ── Your week ───────────────────────────────────────────────────────────────────────────────
const NOW = at(2026, 11, 22, 18);
const base = {
  weekKey: "2026-11-16", now: NOW, createdAt: at(2026, 6, 1),
  activeDates: ["2026-11-14", "2026-11-16", "2026-11-17", "2026-11-19", "2026-11-22"],
  acts: [{ route: "sent", at: at(2026, 11, 17), delivered: true, country: "Algeria" }],
  replies: [{ fromName: "Mona Patel", text: "needed this today, thank you", ts: at(2026, 11, 18) }],
  hearts: [{ reactorName: "Kalpana", reactedAt: at(2026, 11, 19) }, { reactorName: "Vidhi", reactedAt: at(2026, 11, 20) }, { reactorName: "Old", reactedAt: at(2026, 11, 10) }],
  journalCount: 2, pace: "about 4 weeks", nextStage: "Young tree",
};
let r = weeklyRecap(base);
check("a week with activity has a recap at a fixed id", r && r.id === "u-week-2026-11-16", JSON.stringify(r));
check("…it counts this week's days only (4, not the 14th)", /on 4 days\./.test(r.text), r.text);
check("…what came back comes first", r.text.split("\n")[2].startsWith("❤️") || r.text.split("\n")[2].startsWith("💬"), r.text);
check("…with the reply's words and the people who felt it", /Mona wrote back: “needed this today, thank you”/.test(r.text) && /Kalpana and Vidhi felt your words/.test(r.text), r.text);
check("…a heart from before Monday isn't this week's", !/Old/.test(r.text), r.text);
check("…the journal as a count, and the tree's pace", /You wrote in your journal twice\./.test(r.text) && /Young tree in about 4 weeks at your pace\./.test(r.text), r.text);
check("…no guilt words", !GUILT.test(r.text), r.text);

check("nothing happened: no recap", weeklyRecap({ ...base, activeDates: [], acts: [], replies: [], hearts: [], journalCount: 0 }) === null);
check("a week before the kindness log began: no recap", weeklyRecap({ ...base, weekKey: "2026-11-09", now: at(2026, 11, 15, 18) }) === null);
check("an account created during the week: no recap", weeklyRecap({ ...base, createdAt: at(2026, 11, 18) }) === null);
check("'Forget everything' this week: no recap", weeklyRecap({ ...base, forgotAt: at(2026, 11, 21) }) === null);
check("…but forgetting before the week began doesn't stop it", weeklyRecap({ ...base, forgotAt: at(2026, 11, 10) }) !== null);

const long = "x".repeat(300);
r = weeklyRecap({ ...base, replies: [{ fromName: "A", text: long, ts: at(2026, 11, 18) }, { fromName: "B", text: long, ts: at(2026, 11, 19) }],
  acts: [{ route: "act", text: long, at: at(2026, 11, 20) }] });
check("never longer than the 400 the rules allow", r && r.text.length <= MAX_UPDATE, String(r?.text.length));
check("…and the pace line survives the cut", /at your pace\.$/.test(r.text), r.text.slice(-80));

// ── Stage, level, certificate ───────────────────────────────────────────────────────────────
const stages = [{ name: "Seed" }, { name: "Young tree" }, { name: "Leafing" }, { name: "Tree of Life" }];
r = stageUpdate({ stageIdx: 1, stages, pace: "about 6 weeks" });
check("a new stage says what's next, at your pace", r.id === "u-stage-1" && /Young tree\. At your pace, Leafing is about 6 weeks away\./.test(r.text) && r.action === "tree", JSON.stringify(r));
r = stageUpdate({ stageIdx: 3, stages });
check("the top stage keeps the real-tree promise", /real tree will be planted/.test(r.text), r.text);
check("an unknown stage writes nothing", stageUpdate({ stageIdx: 9, stages }) === null);

r = badgeUpdate({ stat: "streak", level: 3, threshold: 14 });
check("a level on days in a row, never the word 'streak'", r.id === "u-badge-streak-3" && /14 days in a row/.test(r.text) && !GUILT.test(r.text), JSON.stringify(r));
r = badgeUpdate({ stat: "hearts", level: 5, threshold: 250 });
check("a level on hearts", /250 hearts/.test(r.text) && r.action === "grow");
r = badgeUpdate({ stat: "countries", level: 1, threshold: 1 });
check("one country, said properly", /reached 1 country\./.test(r.text), r.text);
check("an unknown stat writes nothing", badgeUpdate({ stat: "x", level: 1, threshold: 3 }) === null);

r = certUpdate({ days: 30, name: "1 month", emoji: "🌿" });
check("a certificate with a button that opens it", r.id === "u-cert-30" && r.action === "cert:30" && /30 different days/.test(r.text), JSON.stringify(r));

// ── Buttons ─────────────────────────────────────────────────────────────────────────────────
check("tree, grow and real certificates are buttons", parseAction("tree")?.type === "tree" && parseAction("grow")?.type === "grow" && parseAction("cert:30")?.cert?.days === 30);
check("anything else is not", [null, "", "cert:31", "javascript:alert(1)", "open:settings"].every((a) => parseAction(a) === null));

// ── Writing ─────────────────────────────────────────────────────────────────────────────────
const chat = [{ id: "u-week-2026-11-16" }, { id: "q-1" }];
check("not written twice", !canCreate(chat, "u-week-2026-11-16", { fromServer: true }));
check("written when missing, from the server's list", canCreate(chat, "u-stage-4", { fromServer: true }));
check("not from a cached list (another device may have written it)", !canCreate(chat, "u-stage-4", { fromServer: false }));
check("not before the conversation has loaded", !canCreate(null, "u-stage-4", { fromServer: true }));

let failed = 0;
for (const [ok, line] of results) { console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} Seen update tests passed.`);
process.exit(failed ? 1 : 0);
