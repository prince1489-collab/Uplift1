#!/usr/bin/env node
/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// check-avatar-screening.cjs — nothing reaches Cloud Storage without being looked at first.
//
// ── THE BUG THIS EXISTS FOR, WHICH ALREADY HAPPENED ONCE ─────────────────────────────────────
// Avatars were uploaded from two places. Onboarding checked the file's size and type; the
// profile-edit sheet checked neither. The two paths to the same object disagreed about what was
// allowed, and nobody noticed until storage.rules was written and the disagreement had to be
// resolved to write a single rule. That is recorded in storage.rules' own header.
//
// Screening the PICTURE is the same shape of problem with a worse failure. A second upload path
// written by somebody who does not know what the first one checks is not a visible bug: the
// upload works, the avatar appears, and the only symptom is an unreviewed photograph in a
// world-readable bucket. There is no test that fails and no screen that looks wrong.
//
// ── WHAT IS ASSERTED, AND WHAT IS NOT ────────────────────────────────────────────────────────
// Screening happens when the photo is PICKED and the upload happens when the sheet is SAVED, so
// the two are deliberately in different functions — which means a function-scoped rule would be
// wrong here, and this works at file scope instead. Stated plainly: this catches a whole new
// upload path, and it catches the screening being deleted from an existing one. It does NOT
// catch a second uploadBytes added inside a file that already screens. If that ever becomes a
// real risk, the answer is one upload helper rather than a cleverer regex.
//
// Run: node scripts/check-avatar-screening.cjs

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");

const fail = [];
const ok = [];
let uploads = 0;

for (const file of fs.readdirSync(SRC)) {
  if (!/\.(js|jsx)$/.test(file)) continue;
  const src = fs.readFileSync(path.join(SRC, file), "utf8");
  const found = [...src.matchAll(/uploadBytes\s*\(/g)];
  if (!found.length) continue;
  uploads += found.length;

  const lineOf = (i) => src.slice(0, i).split("\n").length;

  // 1. The file re-encodes before it holds anything. imagePrep is what strips the EXIF, caps the
  //    bytes and makes the screened blob and the uploaded blob the same object.
  if (!/from\s+"\.\/imagePrep"/.test(src)) {
    fail.push(`${file}: uploads to Storage but does not import prepareImage from ./imagePrep`);
  }

  // 2. The file asks for a verdict. The shape matters — `image:` rather than `text:` — because
  //    posting the caption of a photo to the text reviewer would pass this check while screening
  //    nothing that anybody can see.
  if (!/"\/api\/moderate-message"[\s\S]{0,200}?\bimage\s*:/.test(src)) {
    fail.push(`${file}: uploads to Storage without posting an image to /api/moderate-message`);
  }

  for (const m of found) {
    // 3. The content type is ours, not the file's. `contentType: f.type` is the user telling the
    //    bucket what to serve their bytes as — the avatar.html case storage.rules names.
    const call = src.slice(m.index, src.indexOf(";", m.index) + 1);
    if (/contentType\s*:\s*[A-Za-z_$][\w$]*\s*\.\s*type/.test(call)) {
      fail.push(`${file}:${lineOf(m.index)} takes contentType from the user's file — use PREPARED_TYPE`);
    }
  }

  // 4. The object path is ours too. An extension spliced out of the end of the user's filename
  //    and pasted into the path is the other half of the same trick.
  for (const m of src.matchAll(/ref\s*\(\s*storage\s*,\s*`[^`]*\$\{\s*ext\s*\}/g)) {
    fail.push(`${file}:${lineOf(m.index)} builds the object path from a user-supplied extension`);
  }
}

// Guards the collector. If a refactor renames the upload call, every check above silently passes
// over nothing at all and reports success — the failure mode this project has hit twice.
if (!uploads) {
  fail.push("found no uploadBytes( calls in src/ — this check is seeing nothing and would pass no matter what");
} else {
  ok.push(`${uploads} Storage upload${uploads === 1 ? "" : "s"} in src/, all screened before they run`);
}

for (const line of ok) console.log(`  ok    ${line}`);
if (fail.length) {
  console.error("");
  for (const line of fail) console.error(`  FAIL  ${line}`);
  console.error(`\n  ${fail.length} unscreened upload problem${fail.length === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log("\n  Avatar screening OK.");
