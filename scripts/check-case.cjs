#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-case.cjs — no two source files whose names differ only by capital letters.
//
// Why this exists: src/replyNudge.js (rules) and src/ReplyNudge.jsx (the component) built fine on
// Linux — this machine, Vercel, the Android build — and broke the iOS build, because Codemagic's
// Mac treats "ReplyNudge" and "replyNudge" as the same name. An extensionless import resolved to
// the .js file and the build failed with '"default" is not exported by "src/replyNudge.js"'.
//
// Pairs where one side is CSS are fine: CSS is always imported with its extension.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CODE = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const problems = [];

for (const dir of ["src", "api"]) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  const seen = new Map(); // lower-cased base name -> [file names]
  for (const f of fs.readdirSync(abs)) {
    const ext = path.extname(f).toLowerCase();
    if (!CODE.has(ext)) continue;
    const key = path.basename(f, path.extname(f)).toLowerCase();
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(f);
  }
  for (const files of seen.values()) {
    if (files.length > 1) problems.push(`${dir}/: ${files.join(" and ")} have the same name on a Mac`);
  }
}

if (problems.length) {
  console.error("Case clash — this builds on Linux but breaks the iOS build on Codemagic's Mac:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK — no source files whose names differ only by case.");
