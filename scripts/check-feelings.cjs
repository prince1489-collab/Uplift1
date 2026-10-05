#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-feelings.cjs — guards src/feelingWords.js, the words for "Feel it" (3.9), and tests the
// helpers that turn picked words into a sentence.
//
// The card only works if it is quick and honest: eight distinct words per kind of act (two rows
// of four on a phone), at least one uneasy word in every set so "awkward" is always sayable,
// endings for both good and uneasy picks, and nothing too long to read at a glance.

const path = require("path");
const assert = require("assert");
const { pathToFileURL } = require("url");

const ROUTES = ["act", "sent", "reply", "note"];
const MAX_WORD = 12;
const MAX_ENDING = 45;
const GUILT = /should|must|failed|streak|lazy|selfish/i;

(async () => {
  const m = await import(pathToFileURL(path.join(__dirname, "..", "src", "feelingWords.js")).href);
  const problems = [];
  for (const r of ROUTES) {
    const words = m.FEEL_WORDS[r] || [];
    if (words.length !== 8) problems.push(`${r}: ${words.length} words (need exactly 8)`);
    if (new Set(words).size !== words.length) problems.push(`${r}: duplicate words`);
    if (!words.some((w) => m.UNEASY.has(w))) problems.push(`${r}: no uneasy word — "awkward" must always be sayable`);
    for (const w of words) if (w.length > MAX_WORD) problems.push(`${r}: "${w}" too long`);
    for (const tone of ["good", "uneasy"]) {
      const ends = m.BECAUSE[r]?.[tone] || [];
      if (ends.length < 2) problems.push(`${r}/${tone}: ${ends.length} endings (need ≥2)`);
      for (const e of ends) {
        if (e.length > MAX_ENDING) problems.push(`${r}/${tone}: "${e}" ${e.length} chars (max ${MAX_ENDING})`);
        if (GUILT.test(e)) problems.push(`${r}/${tone}: guilt-shaped "${e}"`);
        if (/[.!?]$/.test(e)) problems.push(`${r}/${tone}: "${e}" ends in punctuation (the sentence adds it)`);
      }
    }
  }
  for (const list of [m.REPLY_FEEL, m.NOTE_FEEL]) if (new Set(list).size !== list.length || list.length < 4) problems.push("reply/note feeling row: need ≥4 unique words");

  // ── The helpers ──
  try {
    assert.equal(m.buildSentence(["proud"], "they smiled back"), "I feel proud because they smiled back.");
    assert.equal(m.buildSentence(["proud", "nervous"], ""), "I feel proud and nervous.");
    assert.equal(m.playBack({ feelings: ["warm"], because: "I really noticed them" }), "You felt warm — because you really noticed them.");
    assert.equal(m.playBack({ feelings: ["proud"], because: "I'm not used to this" }), "You felt proud — because you're not used to this.");
    assert.equal(m.playBack({}), "");
    assert.deepEqual(m.endingsFor("act", ["awkward"]), m.BECAUSE.act.uneasy);
    assert.deepEqual(m.endingsFor("act", ["warm"]), m.BECAUSE.act.good);
    assert.equal(m.endingsFor("act", ["warm", "nervous"]).length, 3);
    assert.equal(m.quoteChip("Reflect on the week … and keep spreading the love"), "“keep spreading the love” stayed with me because ");
    assert.equal(m.quoteChip("💪"), null);
    assert.equal(m.quoteChip(""), null);
    const now = Date.parse("2026-10-05T12:00:00Z");
    const s = m.feelingSummary([
      { feelings: ["warm"], because: "they smiled back", createdAt: now - 1000 },
      { feelings: ["warm", "proud"], createdAt: now - 2000 },
      { feelings: ["awkward"], createdAt: now - 9 * 86400000 }, // too old
      { answer: "x", question: "y", createdAt: now },            // a question answer, no words
    ], now);
    assert.deepEqual(s.top, [["warm", 2], ["proud", 1]]);
    assert.equal(s.total, 2);
    assert.equal(s.lines[0], "You felt warm — because they smiled back.");
  } catch (e) {
    problems.push(`helper test failed: ${e.message}`);
  }

  if (problems.length) {
    console.error(`✗ feelingWords.js — ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✓ feelingWords.js — ${ROUTES.length} routes × 8 words, endings for good and uneasy, helpers pass`);
})();
