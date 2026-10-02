#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-reflect.cjs — guards the shape of src/reflectPrompts.js, the daily reflection question.
//
// The point of the bank is variety: a question that repeats becomes wallpaper. So this checks
// that every route has enough questions to go a week without repeating, that every format is
// represented, that nothing is too long to read at a glance, and that no question slips into
// guilt — the same rule the reminders are held to. Reading the bank is still the real review.

const path = require("path");
const { pathToFileURL } = require("url");

const MIN_PER_ROUTE = 8;   // > 7, so a week never has to repeat
const MAX_CHARS = 90;
const MAX_CHIPS = 4;
const GUILT = /streak|don't lose|running out|last chance|still haven't|should have|failed|miss(ed)? out/i;

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "src", "reflectPrompts.js")).href);
  const bank = mod.REFLECT_BANK;
  const problems = [];
  const ids = new Set();
  for (const q of bank) {
    if (ids.has(q.id)) problems.push(`duplicate id ${q.id}`);
    ids.add(q.id);
    if (q.q.length > MAX_CHARS) problems.push(`${q.id}: ${q.q.length} chars (max ${MAX_CHARS})`);
    if (GUILT.test(q.q)) problems.push(`${q.id}: guilt-shaped wording`);
    if (!q.routes?.length || q.routes.some((r) => !mod.ROUTES.includes(r))) problems.push(`${q.id}: bad routes`);
    if (q.kind === "chips" && (!q.options?.length || q.options.length > MAX_CHIPS)) problems.push(`${q.id}: 1–${MAX_CHIPS} chips needed`);
    if ((q.kind === "text" || q.kind === "next") && !q.placeholder) problems.push(`${q.id}: needs a placeholder`);
    if (q.q.includes("{name}") && q.routes.some((r) => r === "sent")) problems.push(`${q.id}: {name} on a route with no name`);
  }
  for (const r of mod.ROUTES) {
    const n = bank.filter((q) => q.routes.includes(r)).length;
    if (n < MIN_PER_ROUTE) problems.push(`route ${r}: only ${n} questions (need ${MIN_PER_ROUTE})`);
  }
  for (const f of ["imagine", "notice", "courage", "next", "finish", "surprise"]) {
    if (!bank.some((q) => q.format === f)) problems.push(`no "${f}" question`);
  }
  // A week of one person, every route: never the same question twice.
  for (const route of mod.ROUTES) {
    const hist = [];
    for (let d = 1; d <= 7; d++) {
      const day = `2026-10-${String(d).padStart(2, "0")}`;
      const q = mod.pickReflect({ uid: "u1", day, route, history: hist });
      if (hist.some((h) => h.id === q.id)) problems.push(`route ${route}: "${q.id}" repeated within a week`);
      hist.push({ day, id: q.id });
    }
  }
  if (problems.length) {
    console.error("Reflect bank problems:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log(`Reflect bank OK — ${bank.length} questions across ${mod.ROUTES.length} routes, no repeats in a week.`);
})();
