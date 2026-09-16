#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-hyt.cjs — guards the shape of src/hytPrompts.js.
//
// ── WHAT THIS CANNOT DO, SAID FIRST ──────────────────────────────────────────────────────────
// It cannot tell you a sentence does not mean anything. The line that prompted this script was
//
//     "Have you tried… asking for the day to be a little kinder, starting with your break?"
//
// which passed every structural test there is — correct stem, correct punctuation, ten words, no
// duplicate — and is not a sentence. Asking WHOM? It shipped, and it filled one of the two cards
// on the Practice screen in a recording of the app.
//
// Nor can it find semantic duplicates. "writing down what you're worried about, in plain words"
// and "writing your worries on paper so they stop rattling round your head" are the same prompt
// twice; measured on shared words they score 0.07, so no similarity threshold that catches them
// survives contact with 800 lines. Both were found by reading, and the only thing that finds the
// next one is reading.
//
// So: this guards the mechanical half, which it does completely and forever. The other half is a
// human reading the bank, and the self-care banks are 60 lines each precisely so that is possible
// in a sitting. A guard that implied more coverage than it has would be worse than none, because
// it would be a reason not to read.
//
// Parses rather than imports: hytPrompts.js uses Vite-style extensionless imports elsewhere in
// the tree and plain node cannot resolve those.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "hytPrompts.js");
const src = fs.readFileSync(SRC, "utf8");

const STEM = "Have you tried… ";
// Word counts measured over the current bank: min 5, median 9, max 15. The bounds sit just
// outside that, so they catch a line that has lost its ending or swallowed a paragraph, without
// firing on ordinary variation.
const MIN_WORDS = 4;
const MAX_WORDS = 18;
const SELF_BAND_SIZE = 60;

const fail = [];
const ok = [];

// ── Collect every prompt, remembering which list it came from ────────────────────────────────
// The bank name matters: two identical prompts in DIFFERENT areas are fine, because a person
// only ever sees one area at a time. Two in the same list is a bug.
const banks = new Map();
let current = null;
for (const [i, line] of src.split("\n").entries()) {
  // A closing bracket ends the list. Without this the collector never stops, and the very next
  // array of strings in the file gets appended to whichever bank happened to be open last —
  // which is exactly what SELF_EVENING_ONLY did on its first run: seven more entries silently
  // joined the `older` band and it reported 67 prompts and a duplicate.
  if (/^\s*\]/.test(line)) { current = null; continue; }
  // Two shapes open a list: `NAME: [` / `export const NAME = [` on its own, and an area object
  // whose `prompts: [` trails the rest of its fields on one line. `new Set([` deliberately opens
  // nothing — it is a lookup, not a prompt list, and it is checked separately below.
  const area = line.match(/id:\s*"([^"]+)".*\bprompts:\s*\[\s*$/);
  const open = area || line.match(/^\s*(?:export const )?([A-Za-z_][\w]*)\s*[:=]\s*\[\s*$/);
  if (open) { current = open[1]; if (!banks.has(current)) banks.set(current, []); continue; }
  const quoted = line.match(/^\s*"(.*)",?\s*$/);
  if (current && quoted) banks.get(current).push({ text: quoted[1], line: i + 1, bank: current });
}

const all = [...banks.values()].flat();

// ── 0. EVERY prompt was collected ────────────────────────────────────────────────────────────
// This runs before the real checks because without it none of them mean anything. A collector
// that quietly stops at a formatting change reports "ok" over a bank it never opened — and this
// script did exactly that on its second run: tightening one regex dropped it from 800 prompts to
// 280, still green, having skipped 520 lines. Count the raw stem occurrences in the file and
// insist the two agree.
// SELF_EVENING_ONLY quotes seven prompts a second time, and is not a bank, so it comes out of the
// file before counting — otherwise this check fails by exactly seven and the honest answer looks
// like a parser bug.
const setStart = src.indexOf("SELF_EVENING_ONLY = new Set([");
const setEnd = setStart < 0 ? -1 : src.indexOf("]);", setStart);
const banksOnly = setStart < 0 ? src : src.slice(0, setStart) + src.slice(setEnd);
const stems = (banksOnly.match(/^\s*"Have you tried/gm) || []).length;
if (all.length !== stems) {
  fail.push(`collected ${all.length} prompts but the file contains ${stems} — a list is not being parsed, so every check below is running over a subset`);
}
if (!all.length) fail.push("parsed no prompts at all — the file's shape has changed and every check below is vacuous");

// ── 1. Every line is a prompt ────────────────────────────────────────────────────────────────
for (const p of all) {
  if (!p.text.startsWith(STEM)) fail.push(`${SRC}:${p.line} does not open with the stem — "${p.text.slice(0, 50)}…"`);
  else if (!p.text.endsWith("?")) fail.push(`${SRC}:${p.line} does not end in a question mark — "${p.text.slice(0, 60)}…"`);
}

// ── 2. Length ────────────────────────────────────────────────────────────────────────────────
for (const p of all) {
  const words = p.text.slice(STEM.length).replace(/\?$/, "").trim().split(/\s+/).length;
  if (words < MIN_WORDS || words > MAX_WORDS) {
    fail.push(`${SRC}:${p.line} is ${words} words, outside ${MIN_WORDS}-${MAX_WORDS} — "${p.text}"`);
  }
}

// ── 3. Typography ────────────────────────────────────────────────────────────────────────────
// Invisible in a diff, very visible at 15px on a phone.
//
// The apostrophe rule is the file's, not mine: all 178 lines that need one use a STRAIGHT quote
// and not one uses a curly one. So the thing to catch is a curly one arriving — which is what
// happens when a prompt is drafted in a word processor and pasted in, and which would render as
// a different glyph beside 177 that match. (Written the other way round first, asserting curly,
// it failed on 178 lines. A guard that disagrees with the whole file is describing the author's
// assumption rather than the codebase.)
for (const p of all) {
  if (/ {2}/.test(p.text)) fail.push(`${SRC}:${p.line} has a double space — "${p.text}"`);
  if (/’/.test(p.text)) fail.push(`${SRC}:${p.line} has a curly apostrophe; every other line uses a straight one — "${p.text}"`);
  if (/\.\.\./.test(p.text)) fail.push(`${SRC}:${p.line} uses three dots; the stem is a single … character — "${p.text}"`);
}

// ── 4. Exact duplicates WITHIN a bank ────────────────────────────────────────────────────────
for (const [name, rows] of banks) {
  const seen = new Map();
  for (const p of rows) {
    const key = p.text.toLowerCase();
    if (seen.has(key)) fail.push(`${name} repeats a prompt at lines ${seen.get(key)} and ${p.line} — "${p.text}"`);
    else seen.set(key, p.line);
  }
}

// ── 5. The three self-care bands stay the same size ──────────────────────────────────────────
// Not tidiness: the fix for a near-duplicate is to REPLACE it, not delete it, and a band that has
// quietly shrunk is how "replace" turns into "delete" over a few rounds of edits.
for (const band of ["teen", "adult", "older"]) {
  const rows = banks.get(band);
  if (!rows) { fail.push(`the ${band} self-care band is missing`); continue; }
  if (rows.length !== SELF_BAND_SIZE) fail.push(`the ${band} self-care band has ${rows.length} prompts, expected ${SELF_BAND_SIZE}`);
}

// ── 6. Self care must not assume a job ───────────────────────────────────────────────────────
// The adult band is 18-49: students, carers, people between jobs, people who work for themselves.
// Six prompts here assumed a desk, a lunch break, meetings, clocking off or annual leave, and
// handed those people something they could not do about one day in ten. Exactly the finding that
// was already fixed once for the kindness bank — see the header of hytPrompts.js.
const JOB = /\b(meetings?|your desk|clock(ed|ing)? off|annual leave|lunch break|the office|your boss|colleagues?)\b/i;
for (const band of ["teen", "adult", "older"]) {
  for (const p of banks.get(band) ?? []) {
    if (JOB.test(p.text)) fail.push(`${SRC}:${p.line} assumes a job, in a self-care band — "${p.text}"`);
  }
}

// ── 7. SELF_EVENING_ONLY still points at real prompts ────────────────────────────────────────
// The list names prompts that cannot be acted on before the evening, by their exact text, and
// pickDaily keeps them out of the morning pool. Its failure mode is silent: reword one prompt and
// it drops out of the set, and from then on somebody is offered "go to bed 30 minutes earlier" at
// half past seven in the morning with nothing to indicate anything broke.
const setBlock = src.slice(src.indexOf("SELF_EVENING_ONLY = new Set(["));
const setBody = setBlock.slice(0, setBlock.indexOf("]);"));
const listed = [...setBody.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const selfTexts = new Set(["teen", "adult", "older"].flatMap((b) => (banks.get(b) ?? []).map((p) => p.text)));
if (!listed.length) fail.push("SELF_EVENING_ONLY parsed as empty — the morning pool is no longer being filtered");
for (const text of listed) {
  if (!selfTexts.has(text)) fail.push(`SELF_EVENING_ONLY names a prompt that no self-care band contains — "${text}"`);
}
ok.push(`${listed.length} evening-only self-care prompts, all still present`);

// ── Report ───────────────────────────────────────────────────────────────────────────────────
ok.push(`${all.length} prompts across ${banks.size} lists`);
ok.push(`self care: ${["teen", "adult", "older"].map((b) => `${b} ${(banks.get(b) ?? []).length}`).join(", ")}`);

for (const line of ok) console.log(`  ok    ${line}`);
if (fail.length) {
  console.error("");
  for (const line of fail) console.error(`  FAIL  ${line}`);
  console.error(`\n  ${fail.length} problem${fail.length === 1 ? "" : "s"} in the Practice bank.`);
  process.exit(1);
}
console.log("\n  Practice bank OK — shape only. Read it now and then; this cannot.");
