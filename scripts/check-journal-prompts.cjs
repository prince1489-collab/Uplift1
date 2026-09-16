#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-journal-prompts.cjs — guards src/JournalPrompts.js.
//
// THE BUG THIS EXISTS FOR. Every prompt in Reflect used to look backwards: 79% carried a
// past-tense verb, 28% said "today" outright, and only eight of eighty-eight could be answered
// before the day had happened. Meanwhile the app's one notification lands at nine in the morning.
// A recording of a real session at 07:30 shows Reflect opening with
//
//     "What small thing did you do that you hope made a difference?"
//
// which at half past seven has no honest answer. The cost is not a worse entry, it is no entry.
//
// The fix split the file into MORNING, EVENING and ANYTIME. The failure mode of that fix is
// silent: one retrospective prompt written into the morning bank by someone who did not know the
// banks existed, and a person is asked at breakfast what they did with their day — with nothing
// anywhere to indicate it. So the tense of the morning bank is asserted here, not trusted.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "JournalPrompts.js");
const src = fs.readFileSync(SRC, "utf8");

const fail = [];
const ok = [];

// ── Collect ──────────────────────────────────────────────────────────────────────────────────
function listBetween(startMarker, label) {
  const i = src.indexOf(startMarker);
  if (i < 0) { fail.push(`could not find ${label} — the file's shape has changed`); return []; }
  const j = src.indexOf("]", i);
  return [...src.slice(i, j).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const grateful = listBetween("  grateful: [", "the grateful bank");
const kindness = listBetween("  kindness: [", "the kindness bank");
const morning = listBetween("export const MORNING_PROMPTS = [", "MORNING_PROMPTS");
const anytime = listBetween("export const ANYTIME_PROMPTS = [", "ANYTIME_PROMPTS");

const banks = { grateful, kindness, morning, anytime };
const all = [...grateful, ...kindness, ...morning, ...anytime];

// Guards the collector itself. Every quoted string in the file that ends in a question mark is a
// prompt; if the count disagrees, one of the four lists is not being read and every check below
// is running over a subset.
const quoted = (src.match(/^\s*"[^"]+\?",?$/gm) || []).length;
if (all.length !== quoted) {
  fail.push(`collected ${all.length} prompts but the file holds ${quoted} — a bank is not being parsed`);
}

// ── 1. Every prompt is a question ────────────────────────────────────────────────────────────
for (const [name, list] of Object.entries(banks)) {
  for (const p of list) {
    if (!p.endsWith("?")) fail.push(`${name}: not a question — "${p}"`);
    if (p.length > 90) fail.push(`${name}: ${p.length} characters, too long to sit on one card — "${p}"`);
  }
}

// ── 2. No prompt in two banks ────────────────────────────────────────────────────────────────
// ANYTIME exists precisely so a timeless prompt is written ONCE and mixed into both pools. A copy
// left behind in morning or evening is the same prompt twice in one rotation, and the two copies
// drift the moment either is reworded.
const seen = new Map();
for (const [name, list] of Object.entries(banks)) {
  for (const p of list) {
    if (seen.has(p)) fail.push(`"${p}" is in both ${seen.get(p)} and ${name} — if it belongs to both hours it belongs in anytime, once`);
    else seen.set(p, name);
  }
}

// ── 3. The morning bank cannot ask about a day that has not happened ─────────────────────────
// The whole point of the split. Two tests, both deliberately narrow so they do not fire on
// ordinary phrasing:
//
//   "did you"        — always retrospective, in any sentence, at any hour.
//   "today" + a past-tense verb — "What would make today feel like a good one?" is fine and must
//                      stay fine; "What did you do today" is not.
const PAST = /\b(did|was|were|went|made|gave|got|said|showed|helped|taught|felt|noticed|enjoyed)\b/i;
for (const p of morning) {
  if (/\bdid you\b/i.test(p)) {
    fail.push(`morning asks about the past — "${p}"`);
  } else if (/\b(today|your day)\b/i.test(p) && PAST.test(p)) {
    fail.push(`morning asks about a day that has not happened yet — "${p}"`);
  }
}

// ── 4. Both pools are big enough not to repeat inside a month ────────────────────────────────
// The rotation is one prompt a day, so a pool of thirty repeats monthly and a daily writer
// notices. Morning is the smaller of the two and the one to watch.
const MIN_POOL = 40;
const morningPool = morning.length + anytime.length;
const eveningPool = grateful.length + kindness.length + anytime.length;
if (morningPool < MIN_POOL) fail.push(`the morning pool is ${morningPool} prompts, under ${MIN_POOL} — it repeats within ${morningPool} days`);
if (eveningPool < MIN_POOL) fail.push(`the evening pool is ${eveningPool} prompts, under ${MIN_POOL}`);

// ── Report ───────────────────────────────────────────────────────────────────────────────────
ok.push(`morning pool ${morningPool} (${morning.length} + ${anytime.length} anytime)`);
ok.push(`evening pool ${eveningPool} (${grateful.length} + ${kindness.length} + ${anytime.length} anytime)`);
ok.push("no prompt appears in two banks");

for (const line of ok) console.log(`  ok    ${line}`);
if (fail.length) {
  console.error("");
  for (const line of fail) console.error(`  FAIL  ${line}`);
  console.error(`\n  ${fail.length} problem${fail.length === 1 ? "" : "s"} in the Reflect prompts.`);
  process.exit(1);
}
console.log("\n  Reflect prompts OK.");
