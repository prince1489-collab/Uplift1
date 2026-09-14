#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-proverbs.cjs — guards src/proverbs.js.
//
// Two things here are guarded because they have ALREADY gone wrong once each.
//
// 1. ROTATION. pickDailyProverb must show a given person every proverb in the file before it
//    repeats any of them. The first version HASHED the date, and hashes collide: over 62 days a
//    user saw 21 distinct proverbs, the same handful again and again, which is the exact
//    opposite of the feature. Counting days fixes it, and this asserts the fix rather than
//    trusting it — for two different uids, because a bug in the uid term would hide behind one.
//
// 2. THEMATIC BALANCE. The original set was 68% "keep going, be patient, little by little" —
//    the same idea in nineteen languages. See the long note in the header of proverbs.js. The
//    theme field exists so that can be counted, and this is the thing doing the counting.
//
// Parses rather than imports: proverbs.js uses Vite-style extensionless imports, which plain
// node cannot resolve.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "proverbs.js");
const src = fs.readFileSync(SRC, "utf8");
const body = src.slice(src.indexOf("export const PROVERBS = ["), src.indexOf("\n];", src.indexOf("export const PROVERBS")));

const ENTRY = /\{ id: "([^"]+)", language: "([^"]+)", original: "([^"]*)", romanisation: (null|"[^"]*"),\s*english: "([^"]+)",\s*meaning: "([^"]+)", theme: "([^"]+)", sparkReward: R \},/g;
const rows = [...body.matchAll(ENTRY)].map((m) => ({
  id: m[1], language: m[2], original: m[3],
  romanisation: m[4] === "null" ? null : m[4].slice(1, -1),
  english: m[5], meaning: m[6], theme: m[7],
}));

const fail = [];
const ok = [];

// Every entry must parse. A block the regex misses would silently escape every check below.
const blockCount = (body.match(/\{ id: "/g) || []).length;
if (rows.length !== blockCount) {
  fail.push(`parsed ${rows.length} of ${blockCount} entries — one is formatted differently and is escaping these checks`);
} else {
  ok.push(`${rows.length} entries across ${new Set(rows.map((r) => r.language)).size} languages`);
}

// ── Shape ────────────────────────────────────────────────────────────────────────────────────
const ids = new Set();
const THEMES = new Set(["people", "living", "effort"]);
// Languages written in Latin script need no romanisation; anything else must carry one, or a
// reader has no way to say the line out loud.
const LATIN = new Set([
  "Afrikaans","Basque","Catalan","Croatian","Czech","Danish","Dutch","English","Estonian","Filipino",
  "Finnish","French","German","Haitian Creole","Hausa","Hungarian","Icelandic","Igbo","Indonesian",
  "Irish","Italian","Lithuanian","Malagasy","Malay","Māori","Hawaiian","Norwegian","Polish",
  "Portuguese","Romanian","Scottish Gaelic","Shona","Slovak","Somali","Spanish","Swahili","Swedish",
  "Turkish","Twi","Vietnamese","Welsh","Wolof","Xhosa","Yoruba","Zulu","Nahuatl",
]);
for (const r of rows) {
  if (ids.has(r.id)) fail.push(`duplicate id "${r.id}"`);
  ids.add(r.id);
  if (!THEMES.has(r.theme)) fail.push(`"${r.id}" has theme "${r.theme}" — must be one of ${[...THEMES].join(", ")}`);
  if (!r.english.trim()) fail.push(`"${r.id}" has no english line — that is the line that gets sent`);
  if (!r.meaning.trim()) fail.push(`"${r.id}" has no meaning`);
  if (!r.original.trim()) fail.push(`"${r.id}" has no original`);
  if (r.english.trim() === r.meaning.trim()) fail.push(`"${r.id}": meaning repeats the translation instead of explaining it`);
  const latin = LATIN.has(r.language);
  if (latin && r.romanisation !== null) fail.push(`"${r.id}" (${r.language}) is Latin-script but carries a romanisation that just repeats it`);
  if (!latin && !r.romanisation) fail.push(`"${r.id}" (${r.language}) is non-Latin and has no romanisation — nobody can say it`);
  // Quoting is the container's job; a pre-quoted line renders as ""like this"".
  if (/^["“]/.test(r.english)) fail.push(`"${r.id}" starts with a quote mark — containers add their own`);
}
if (!fail.length) ok.push("every entry well-formed: unique id, real english/meaning/original, romanisation iff non-Latin");

// ── Rule 5: the mix ──────────────────────────────────────────────────────────────────────────
const counts = rows.reduce((a, r) => ((a[r.theme] = (a[r.theme] || 0) + 1), a), {});
const pct = (n) => (100 * n) / rows.length;
const EFFORT_CAP = 25;
if (pct(counts.effort || 0) > EFFORT_CAP) {
  fail.push(`"effort" is ${pct(counts.effort || 0).toFixed(0)}% of the set (cap ${EFFORT_CAP}%). That is the drift the header warns about: persistence proverbs are advice about how the RECIPIENT should live, and they are the easiest kind to keep adding.`);
} else {
  ok.push(`themes — people ${pct(counts.people || 0).toFixed(0)}%, living ${pct(counts.living || 0).toFixed(0)}%, effort ${pct(counts.effort || 0).toFixed(0)}% (cap ${EFFORT_CAP}%)`);
}
if ((counts.people || 0) < (counts.effort || 0)) {
  fail.push(`there are more "effort" entries than "people" ones — this is an app about being noticed by another person`);
}

// ── Rotation: every proverb before any repeat ────────────────────────────────────────────────
// hytHash and localDayNumber are reimplemented here rather than imported, for the same reason
// the file is parsed rather than required. They must stay in step with proverbs.js/hytPrompts.js.
function hytHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) + str.charCodeAt(i)) >>> 0;
  return h;
}
function localDayNumber(d) {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
// Must match STRIDE in proverbs.js. If the two drift apart this test stops testing the real
// rotation, so the value is asserted against the source below rather than just copied.
const STRIDE = 37;
const declared = Number((src.match(/const STRIDE = (\d+);/) || [])[1]);
if (declared !== STRIDE) {
  fail.push(`STRIDE is ${declared} in proverbs.js but ${STRIDE} here — this test would be checking a rotation the app does not use`);
}
for (const uid of ["alice-uid-1", "bob-uid-2", "anon"]) {
  const seen = new Set();
  const start = new Date("2026-01-01T12:00:00");
  for (let i = 0; i < rows.length; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const step = localDayNumber(d) + hytHash(uid);
    seen.add(rows[((step * STRIDE) % rows.length + rows.length) % rows.length].id);
  }
  if (seen.size !== rows.length) {
    fail.push(`uid "${uid}" sees only ${seen.size} distinct proverbs in ${rows.length} days — the rotation is repeating before it should`);
  }
}
if (!fail.some((f) => f.includes("distinct proverbs"))) {
  ok.push(`rotation: a full ${rows.length} days before any repeat, for every uid tested`);
}

// ── Spread: consecutive days must not land in the same language ──────────────────────────────
// Full coverage is not sufficient on its own. The array is grouped by region for readability,
// and a stride of 1 through it walks one REGION at a time — which is how the set produced five
// consecutive days of Japanese followed by two of Korean. Every one of those days was a
// "different" proverb and the coverage test passed happily. The premise of the feature is a
// language that is not yours and a different one tomorrow, so this checks tomorrow.
let worstRun = 0;
for (const uid of ["alice-uid-1", "bob-uid-2", "anon"]) {
  const start = new Date("2026-01-01T12:00:00");
  const seq = [];
  for (let i = 0; i < rows.length; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const step = localDayNumber(d) + hytHash(uid);
    seq.push(rows[((step * STRIDE) % rows.length + rows.length) % rows.length].language);
  }
  let run = 1;
  for (let i = 1; i < seq.length; i++) {
    run = seq[i] === seq[i - 1] ? run + 1 : 1;
    if (run > 1) {
      fail.push(`uid "${uid}" gets ${run} days of ${seq[i]} in a row — pick a different STRIDE`);
    }
    worstRun = Math.max(worstRun, run);
  }
}
if (worstRun <= 1) ok.push("spread: no uid ever gets the same language two days running");

for (const line of ok) console.log(`  ok   ${line}`);
for (const line of fail) console.error(`  FAIL ${line}`);
if (fail.length) {
  console.error(`\ncheck-proverbs: ${fail.length} problem(s).`);
  process.exit(1);
}
console.log("\ncheck-proverbs: the set is sound.");
