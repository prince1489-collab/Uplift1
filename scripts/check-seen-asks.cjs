#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-seen-asks.cjs — guards src/seenAsks.js, the questions Seen asks (3.15), and tests the
// picker: about twice a week, light first, deeper only after answers, no repeats for 60 days.

const path = require("path");
const assert = require("assert");
const { pathToFileURL } = require("url");

const GUILT_OR_LEADING = /should|must|why haven't|why don't|failed|lazy|streak|don't you think|isn't it/i;

(async () => {
  const m = await import(pathToFileURL(path.join(__dirname, "..", "src", "seenAsks.js")).href);
  const problems = [];
  const ids = new Set();
  for (const q of m.QUESTIONS) {
    if (ids.has(q.id)) problems.push(`duplicate id ${q.id}`);
    ids.add(q.id);
    if (!m.AREAS.includes(q.area)) problems.push(`${q.id}: unknown area ${q.area}`);
    if (![1, 2, 3].includes(q.depth)) problems.push(`${q.id}: depth must be 1–3`);
    if (!/\?$/.test(q.q)) problems.push(`${q.id}: must be a question`);
    if (q.q.length > 100) problems.push(`${q.id}: ${q.q.length} chars (max 100)`);
    if (GUILT_OR_LEADING.test(q.q)) problems.push(`${q.id}: guilt-shaped or leading`);
  }
  if (m.QUESTIONS.length < 40) problems.push(`only ${m.QUESTIONS.length} questions (need ≥40)`);
  for (const a of m.AREAS) {
    const inArea = m.QUESTIONS.filter((q) => q.area === a);
    if (inArea.length < 5) problems.push(`${a}: ${inArea.length} questions (need ≥5)`);
    for (const d of [1, 2, 3]) if (!m.QUESTIONS.some((q) => q.area === a && q.depth === d) && !(d === 1 && a === "people" && inArea.some((q) => q.depth === 1))) {
      if (!inArea.some((q) => q.depth === d)) problems.push(`${a}: no depth ${d} question`);
    }
  }

  try {
    const DAY = 86400000, NOW = Date.parse("2026-10-06T09:00:00Z");
    // Twice a week.
    assert.equal(m.questionDue([], NOW), true, "first question is due at once");
    const asked = [{ role: "seen", kind: "question", createdAt: NOW - 2 * DAY }];
    assert.equal(m.questionDue(asked, NOW), false, "not due after 2 days");
    assert.equal(m.questionDue([{ ...asked[0], createdAt: NOW - 3.6 * DAY }], NOW), true, "due after 3.5 days");
    // Light first.
    for (let s = 0; s < 30; s++) assert.equal(m.pickQuestion({ uid: `u${s}`, now: NOW, answered: 0 }).depth, 1, "day one is light");
    assert.equal(m.maxDepth(3), 2); assert.equal(m.maxDepth(8), 3);
    // No repeat within 60 days, and over a year of twice-weekly questions, every pick is new to the last 60 days.
    let history = [];
    for (let i = 0; i < 104; i++) {
      const now = NOW + i * 3.5 * DAY;
      const q = m.pickQuestion({ uid: "sim", now, answered: i, asked: history });
      const clash = history.find((h) => h.qid === q.id && now - h.at < 60 * DAY);
      assert.ok(!clash, `repeat of ${q.id} within 60 days at week ${i / 2}`);
      history.push({ qid: q.id, at: now });
    }
    // A swap gives a different question.
    const a = m.pickQuestion({ uid: "x", now: NOW, answered: 5 });
    const b = m.pickQuestion({ uid: "x", now: NOW, answered: 5, swap: 1 });
    assert.ok(a.id !== b.id || a.q !== b.q, "swap changes the question");
    // A fresh follow-up goes first, once.
    const f = m.pickQuestion({ uid: "x", now: NOW, answered: 5, followUp: { q: "How's the 10k going?", at: NOW - DAY } });
    assert.equal(f.id, "followup");
    const f2 = m.pickQuestion({ uid: "x", now: NOW, answered: 5, followUp: { q: "How's the 10k going?", at: NOW - DAY }, asked: [{ qid: "followup", at: NOW }] });
    assert.notEqual(f2.id, "followup", "a follow-up is asked once");
  } catch (e) {
    problems.push(`picker test failed: ${e.message}`);
  }

  if (problems.length) {
    console.error(`✗ seenAsks.js — ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`✓ seenAsks.js — ${m.QUESTIONS.length} questions, ${m.AREAS.length} areas × 3 depths; twice-weekly, light first, no repeats in 60 days`);
})();
