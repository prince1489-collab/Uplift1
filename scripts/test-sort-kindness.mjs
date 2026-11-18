// test-sort-kindness.mjs — sorting a kind act into an area (3.36).
//   node scripts/test-sort-kindness.mjs

import { AREA_IDS, sortPrompt, parseArea, sortKindAct } from "../api/_sort.js";
import { AREAS, areaOf, areasLine } from "../src/kindAreas.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);

// ── The server side ─────────────────────────────────────────────────────────────────────────
check("six areas", AREA_IDS.join() === "family,friends,community,strangers,work,online");
check("the app and the server name the same areas", AREAS.map((a) => a.id).join() === AREA_IDS.join());
const p = sortPrompt("  Helped my   neighbour carry her shopping  ");
check("the prompt carries the act, tidied", p.user === 'Kind act: "Helped my neighbour carry her shopping"', p.user);
check("…and every area", AREA_IDS.every((a) => p.system.includes(a)));
check("a one-word reply is read", parseArea("community") === "community" && parseArea("Family.") === "family");
check("a chatty reply is read too", parseArea("I'd say this is work, because…") === "work");
check("anything else is not sorted", parseArea("neighbours") === null && parseArea("") === null && parseArea(null) === null);

const ok = await sortKindAct("Called my mum", async ({ user }) => (user.includes("mum") ? "family" : "x"));
check("an act is sorted by the model", ok === "family", String(ok));
check("no words, no call", (await sortKindAct("   ", async () => { throw new Error("called"); })) === null);
check("a failing model leaves it unsorted", (await sortKindAct("x", async () => { throw new Error("down"); })) === null);

// ── The app side: where each kind of act goes, and the weekly line ──────────────────────────
check("a message to a stranger is kindness to strangers", areaOf({ route: "sent" }) === "strangers");
check("a reply or note on Seen is online unless sorted", areaOf({ route: "reply" }) === "online" && areaOf({ route: "note", area: "friends" }) === "friends");
check("a real-life act goes where the AI sorted it", areaOf({ route: "act", area: "community" }) === "community");
check("…and an unsorted one isn't counted", areaOf({ route: "act" }) === null);
check("a heart isn't counted", areaOf({ route: "heart" }) === null);

const NOW = Date.parse("2026-11-22T18:00:00Z");
const DAY = 86400000;
const week = [
  { route: "act", area: "family", at: NOW - DAY },
  { route: "act", area: "family", at: NOW - 2 * DAY },
  { route: "act", area: "family", at: NOW - 3 * DAY },
  { route: "sent", at: NOW - DAY },
  { route: "sent", at: NOW - 2 * DAY },
  { route: "act", area: "work", at: NOW - 4 * DAY },
  { route: "act", area: "friends", at: NOW - 30 * DAY },
  { route: "heart", at: NOW - DAY },
];
const line = areasLine(week, { from: NOW - 7 * DAY, to: NOW });
check("the weekly line: most first, with counts, this week only", line === "Your kindness went to family (3), strangers (2) and work and study (1).", line);
check("one area reads naturally", areasLine([{ route: "sent", at: NOW }], { from: NOW - DAY, to: NOW + 1 }) === "Your kindness went to strangers (1).");
check("nothing sorted, no line", areasLine([{ route: "heart", at: NOW }], { from: NOW - DAY, to: NOW + 1 }) === null);

let failed = 0;
for (const [okk, l] of results) { console.log(`  ${okk ? "ok  " : "FAIL"}  ${l}`); if (!okk) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} kindness-sorting tests passed.`);
process.exit(failed ? 1 : 0);
