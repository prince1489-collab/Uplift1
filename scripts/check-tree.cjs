#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-tree.cjs — guards the Kindness Tree ladder.
//
// The scale was lowered so the top of the tree is reachable in a human lifetime (it used to
// want 10,000,000 drops, which is ~63 years of daily use). Lowering it is safe; RAISING any
// threshold is not, and the difference is not cosmetic:
//
//   docs/v2-roadmap.md — "never devalue testers' balances"
//
// Raise a threshold and somebody who opens the app tomorrow finds their tree has shrunk. There
// is no message that makes that acceptable, and no way to give the stage back afterwards
// without also handing it to people who never earned it. So this script asserts the one
// property that makes the rescale safe: at every tier, the new bar is at or below the old one,
// which means the change can only ever move a person UP.
//
// If you deliberately want a higher threshold, you have to change LEGACY_MINS here too — which
// is the point. It should take a second commit and a moment's thought.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "KindnessTree.jsx");

// The scale as it shipped before the rescale. A historical record, not a source of truth.
const LEGACY_MINS = [
  0, 200, 600, 1500, 3500, 7000, 15000, 30000, 60000,
  120000, 250000, 500000, 1000000, 2000000, 3500000, 6000000, 10000000,
];

const src = fs.readFileSync(SRC, "utf8");
const block = src.slice(src.indexOf("export const TREE_STAGES = ["), src.indexOf("export function treeStageFor"));
const stages = [...block.matchAll(/\{\s*min:\s*(\d+),\s*name:\s*"([^"]+)"/g)]
  .map((m) => ({ min: Number(m[1]), name: m[2] }));

const fail = [];
const ok = [];

if (stages.length === 0) fail.push("could not parse TREE_STAGES out of KindnessTree.jsx");

// 1. Strictly ascending, starting at zero.
if (stages[0]?.min !== 0) fail.push(`first stage must start at 0, found ${stages[0]?.min}`);
for (let i = 1; i < stages.length; i++) {
  if (stages[i].min <= stages[i - 1].min) {
    fail.push(`thresholds must ascend: ${stages[i - 1].name} ${stages[i - 1].min} then ${stages[i].name} ${stages[i].min}`);
  }
}
if (!fail.length) ok.push(`${stages.length} stages, strictly ascending from 0 to ${stages[stages.length - 1].min.toLocaleString()}`);

// 2. THE ONE THAT MATTERS. No tier may sit above where it used to.
if (stages.length !== LEGACY_MINS.length) {
  fail.push(`stage COUNT changed (${LEGACY_MINS.length} → ${stages.length}). Per-tier comparison is meaningless across a count change — re-derive LEGACY_MINS deliberately and say why in the commit.`);
} else {
  const raised = stages
    .map((s, i) => ({ ...s, was: LEGACY_MINS[i] }))
    .filter((s) => s.min > s.was);
  if (raised.length) {
    for (const r of raised) {
      fail.push(`"${r.name}" was raised ${r.was.toLocaleString()} → ${r.min.toLocaleString()} — anyone between those two numbers LOSES a stage`);
    }
  } else {
    ok.push("no tier raised — the rescale can only move people up");
  }
}

// 3. The gap between neighbours should not blow out. A ladder that doubles late is exactly the
//    sag that made the old scale boring in the second month.
const ratios = stages.slice(1).map((s, i) => (stages[i].min === 0 ? null : s.min / stages[i].min)).filter(Boolean);
const worst = Math.max(...ratios);
if (worst > 3) fail.push(`largest step is ${worst.toFixed(2)}× — steps above 3× stall progress`);
else ok.push(`largest step ${worst.toFixed(2)}×, smallest ${Math.min(...ratios).toFixed(2)}×`);

// 4. EVERY STAGE MUST DRAW SOMETHING DIFFERENT FROM THE ONE BEFORE IT.
//
// The ladder had the right numbers and the wrong picture. Measured across TreeScene: from First
// blossom (10) to Tree of Life (16) every stage drew the SAME features — canopy, butterflies,
// seven blossoms — separated only by +6px of stem and +4.9px of canopy radius on a 200px canvas.
// Roughly 3% of the image per stage, over 27,500 to 250,000 drops. Somebody could climb the whole
// back half of the ladder and never see it change.
//
// "Budding" was the sharpest case: the stage is named for buds, its blurb says "The first buds
// are forming", and blossoms did not start until the stage AFTER it.
//
// This asserts what the numbers cannot: that arriving somewhere looks like arriving somewhere.
// It reads the gate expressions out of the source, so a feature added without a gate, or two
// gates set to the same index, fails here rather than in a screenshot six months later.
const GATE = /const\s+(show[A-Za-z]+|richCanopy|blossomCount)\s*=\s*([^;]+);/g;
const gates = [...src.matchAll(GATE)]
  .map(([, name, expr]) => {
    // Only `eff`-gated features take part: `ambient` and friends are about WHERE the tree is
    // drawn, not how far it has grown.
    const nums = [...expr.matchAll(/eff\s*>=\s*(\d+)/g)].map((m) => Number(m[1]));
    const upper = [...expr.matchAll(/eff\s*<\s*(\d+)/g)].map((m) => Number(m[1]));
    const ternary = [...expr.matchAll(/eff\s*>=\s*(\d+)\s*\?/g)].map((m) => Number(m[1]));
    return nums.length || ternary.length ? { name, from: Math.min(...nums, ...ternary), to: upper.length ? Math.min(...upper) : Infinity } : null;
  })
  .filter(Boolean);

if (gates.length < 6) {
  fail.push(`only parsed ${gates.length} stage-gated features out of TreeScene — the gates have been rewritten and this check is no longer looking at anything`);
} else {
  const featuresAt = (i) => gates.filter((g) => i >= g.from && i < g.to).map((g) => g.name).sort().join(",");
  // A stage may differ by feature OR by growing enough that scale alone carries it. Both are real
  // ways of looking different, and the early stages use the second: the plant goes 8 → 14 → 20px,
  // which is +75% and then +43%, and nobody needs a new ornament to see that. By the top it is
  // 98 → 104, or +6%, which is where scale stops doing any work and a feature has to take over.
  //
  // 15% is where the two regimes meet on this curve — it is satisfied through Rooted and demands
  // a feature from Young tree onward. Without this the check fires on Seed → Sprouting, which is
  // a seed becoming a shoot, and a guard that cries wolf on the most obvious change in the set
  // gets switched off.
  const MIN_GROWTH = 1.15;
  const stemH = (i) => 8 + (i / (stages.length - 1)) * 96;
  const flat = [];
  for (let i = 1; i < stages.length; i++) {
    const sameFeatures = featuresAt(i) === featuresAt(i - 1);
    const grew = stemH(i) / stemH(i - 1) >= MIN_GROWTH;
    if (sameFeatures && !grew) {
      flat.push(`${stages[i - 1].name} → ${stages[i].name} (+${((stemH(i) / stemH(i - 1) - 1) * 100).toFixed(0)}% size, no new feature)`);
    }
  }
  if (flat.length) {
    fail.push(`arriving at these stages looks like nothing happened: ${flat.join("; ")}`);
  } else {
    ok.push(`all ${stages.length} stages differ from the one before, by feature or by ${((MIN_GROWTH - 1) * 100).toFixed(0)}%+ growth`);
  }
}

for (const line of ok) console.log(`  ok   ${line}`);
for (const line of fail) console.error(`  FAIL ${line}`);

if (fail.length) {
  console.error(`\ncheck-tree: ${fail.length} problem(s).`);
  process.exit(1);
}
console.log("\ncheck-tree: the ladder is sound.");
