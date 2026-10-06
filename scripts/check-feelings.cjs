#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-feelings.cjs — guards src/feelingWords.js, the words for "Feel it" (3.9), and tests the
// helpers that turn picked words into a sentence.
//
// The card only works if it is quick, honest and FRESH (3.10): pools big enough to sample from,
// uneasy words in every pool so "awkward" is always sayable, endings for both good and uneasy
// picks, nothing too long to read at a glance — and, simulated over weeks, never the same card
// twice running for the same kind of act.

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
    if (words.length < 14) problems.push(`${r}: ${words.length} words (need ≥14 to sample from)`);
    if (new Set(words).size !== words.length) problems.push(`${r}: duplicate words`);
    if (words.filter((w) => m.UNEASY.has(w)).length < 3) problems.push(`${r}: fewer than 3 uneasy words — "awkward" must always be sayable`);
    for (const w of words) if (w.length > MAX_WORD) problems.push(`${r}: "${w}" too long`);
    for (const [tone, min] of [["good", 6], ["uneasy", 4]]) {
      const ends = m.BECAUSE[r]?.[tone] || [];
      if (ends.length < min) problems.push(`${r}/${tone}: ${ends.length} endings (need ≥${min})`);
      for (const e of ends) {
        if (e.length > MAX_ENDING) problems.push(`${r}/${tone}: "${e}" ${e.length} chars (max ${MAX_ENDING})`);
        if (GUILT.test(e)) problems.push(`${r}/${tone}: guilt-shaped "${e}"`);
        if (/[.!?]$/.test(e)) problems.push(`${r}/${tone}: "${e}" ends in punctuation (the sentence adds it)`);
      }
    }
    if ((m.STEMS[r] || []).length < 3) problems.push(`${r}: need ≥3 headings`);
    if ((m.CONSEQUENCES[r] || []).length < 4) problems.push(`${r}: need ≥4 consequence lines`);
    for (const l of [...(m.STEMS[r] || []), ...(m.CONSEQUENCES[r] || [])]) if (l.length > 80) problems.push(`${r}: "${l}" too long`);
  }
  for (const [kind, list] of Object.entries(m.CONTINUATIONS)) {
    if (list.length < 3) problems.push(`continuations/${kind}: need ≥3`);
    for (const c of list) {
      if (c.length > MAX_ENDING) problems.push(`continuations/${kind}: "${c}" ${c.length} chars (max ${MAX_ENDING})`);
      if (GUILT.test(c)) problems.push(`continuations/${kind}: guilt-shaped "${c}"`);
      if (/[.!?]$/.test(c)) problems.push(`continuations/${kind}: "${c}" ends in punctuation`);
    }
  }
  for (const k of Object.values(m.STARTER_KIND)) if (!m.CONTINUATIONS[k]) problems.push(`starter kind ${k} has no continuations`);
  try {
    const a = m.continuationsFor("quote", "msg1"), b = m.continuationsFor("quote", "msg1");
    assert.deepEqual(a, b); assert.equal(a.length, 3); assert.equal(new Set(a).size, 3);
    assert.deepEqual(m.continuationsFor("nope", "x"), []);
  } catch (e) { problems.push(`continuations test failed: ${e.message}`); }
  for (const list of [m.REPLY_FEEL, m.NOTE_FEEL]) if (new Set(list).size !== list.length || list.length < 4) problems.push("reply/note feeling row: need ≥4 unique words");

  // ── The helpers ──
  try {
    assert.equal(m.buildSentence(["proud"], "they smiled back"), "I feel proud because they smiled back.");
    assert.equal(m.buildSentence(["proud", "nervous"], ""), "I feel proud and nervous.");
    assert.equal(m.playBack({ feelings: ["warm"], because: "I really noticed them" }), "You felt warm — because you really noticed them.");
    assert.equal(m.playBack({ feelings: ["proud"], because: "I'm not used to this" }), "You felt proud — because you're not used to this.");
    assert.equal(m.playBack({}), "");
    assert.equal(m.sentenceFor("body", { words: ["warm"], body: "chest" }), "I felt it in my chest — warm.");
    assert.equal(m.playBack({ shape: "body", feelings: ["warm"], sentence: "I felt it in my chest — warm." }), "You felt it in your chest — warm.");
    assert.equal(m.sentenceFor("pulse", { pulse: m.PULSE[2] }), "That one landed: 😊 warm.");
    assert.equal(m.playBack({ shape: "pulse", feelings: ["warm"], pulse: "😊" }), "That one landed: 😊 warm.");
    assert.equal(m.sentenceFor("quote", { words: ["hopeful"], quote: "keep spreading the love" }), "“keep spreading the love” stayed with me — it made me feel hopeful.");
    assert.ok(m.endingsFor("act", ["awkward"], "s").every((e) => m.BECAUSE.act.uneasy.includes(e)));
    assert.ok(m.endingsFor("act", ["warm"], "s").every((e) => m.BECAUSE.act.good.includes(e)));
    assert.equal(m.endingsFor("act", ["warm", "nervous"], "s").length, 3);
    assert.equal(m.quoteChip("Reflect on the week … and keep spreading the love"), "“keep spreading the love” stayed with me because ");
    assert.equal(m.quoteChip("💪"), null);
    assert.equal(m.quoteChip(""), null);
    const VIDHI = "Reflect on the week gone by while keeping your eyes set straight on your goals for what’s coming this week … and keep spreading the love";
    assert.ok(m.phrasesFrom(VIDHI).length >= 2, "phrases from a long message");
    assert.deepEqual(m.phrasesFrom("💪🔥"), []);
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

    // ── The recording that started 3.10: two sends in a row must not look the same ──
    const day = "2026-10-06";
    const a = m.pickFeelCard({ uid: "u", day, n: 4, route: "sent", routeCount: 1, history: [] });
    const histA = [{ key: a.key, route: a.route, shape: a.shape, stem: a.stem, words: a.words, consequence: a.consequence, endings: [] }];
    const b = m.pickFeelCard({ uid: "u", day, n: 5, route: "sent", routeCount: 2, history: histA });
    assert.notEqual(a.shape, b.shape, "two sends: different shape");
    assert.notEqual(a.stem, b.stem, "two sends: different heading");
    assert.notDeepEqual([...a.words].sort(), [...b.words].sort(), "two sends: different words");
    const c = m.pickFeelCard({ uid: "u", day, n: 6, route: "sent", routeCount: 3, history: histA });
    assert.equal(c.shape, "pulse", "third send is a one-tap pulse");
    // A reply in between speaks as a reply.
    const r = m.pickFeelCard({ uid: "u", day, n: 6, route: "reply", routeCount: 1, name: "Vidhi", theirText: VIDHI, history: histA });
    assert.ok(["words", "quote"].includes(r.shape));
    assert.ok(r.words.every((w) => m.FEEL_WORDS.reply.includes(w)), "reply words come from the reply pool");
    assert.ok(/Vidhi|their/.test(r.stem + r.consequence), "reply names the person");
    assert.ok(!r.stem.startsWith("Them"), "no nameless {name}'s heading");
    // Reopening the sheet shows the same card.
    assert.deepEqual(m.pickFeelCard({ uid: "u", day, n: 4, route: "sent", routeCount: 1, history: [] }), a);
    // Every card has at least one uneasy word to say.
    for (const k of [a, b, r]) if (k.words.length) assert.ok(k.words.some((w) => m.UNEASY.has(w)), "an uneasy word is always offered");

    // ── 20 simulated days × 5 acts: never the same card twice running for a kind of act ──
    let hist = [];
    for (let d = 1; d <= 20; d++) {
      const dd = `2026-11-${String(d).padStart(2, "0")}`;
      const counts = {};
      const acts = ["sent", "reply", "sent", "act", "sent"];
      acts.forEach((route, i) => {
        counts[route] = (counts[route] || 0) + 1;
        const k = m.pickFeelCard({ uid: "sim", day: dd, n: i + 1, route, routeCount: counts[route], name: "Sam", theirText: VIDHI, history: hist });
        const ends = k.words.length ? m.endingsFor(route, k.words.slice(0, 1), k.key, k.endingsAvoid) : [];
        const prev = [...hist].reverse().find((h) => h.route === route);
        if (prev) {
          const same = prev.shape === k.shape && prev.stem === k.stem && JSON.stringify([...prev.words].sort()) === JSON.stringify([...k.words].sort());
          assert.ok(!same, `identical ${route} card twice running on ${dd}`);
          if (k.shape !== "pulse" && prev.shape !== "pulse") assert.notEqual(prev.stem, k.stem, `same ${route} heading twice running on ${dd}`);
        }
        hist = [...hist, { key: k.key, route, shape: k.shape, stem: k.stem, words: k.words, consequence: k.consequence, endings: ends }].slice(-12);
      });
    }
  } catch (e) {
    problems.push(`helper test failed: ${e.message}`);
  }

  if (problems.length) {
    console.error(`✗ feelingWords.js — ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✓ feelingWords.js — ${ROUTES.length} routes × ≥14 words, varied headings and shapes, 20 simulated days with no repeat`);
})();
