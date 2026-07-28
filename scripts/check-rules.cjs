// check-rules.cjs — every collection the app writes must have a rule covering it.
//
// This exists because of a failure that was invisible for weeks: private replies were
// denied for every user, and the app blamed their connection. The `privateReplies` rule was
// sitting in firestore.rules the whole time — it had simply never been deployed, because
// until now the repo had no firebase.json and no deploy step, so the rules file was a
// document describing intentions rather than anything Firebase had ever seen.
//
// This check cannot see what is deployed — nothing in the repo can. What it CAN do is catch
// the other half of the problem: a collection the code writes that the rules file never
// mentions, which is denied by default the moment it ships.
//
// The deploy itself is `npm run deploy:rules`, and it has to be run whenever this file
// changes. That is the part a human has to remember; this check makes sure the file is at
// least complete before they do.
//
// Run: node scripts/check-rules.cjs

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

const rules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
const declared = new Set(
  [...rules.matchAll(/match\s+\/([A-Za-z][A-Za-z0-9_]*)\s*\/\s*\{/g)].map((m) => m[1])
);

// Top-level collections the client touches: collection(db, "x") and doc(db, "x", …).
const used = new Map(); // name -> Set(files)
for (const file of fs.readdirSync(SRC)) {
  if (!/\.(js|jsx)$/.test(file)) continue;
  const src = fs.readFileSync(path.join(SRC, file), "utf8");
  for (const m of src.matchAll(/\b(?:collection|doc)\(\s*db\s*,\s*"([A-Za-z][A-Za-z0-9_]*)"/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(file);
  }
}

const missing = [...used.entries()].filter(([name]) => !declared.has(name));

if (missing.length) {
  console.error(`${missing.length} collection(s) written by the app with no rule in firestore.rules:`);
  for (const [name, files] of missing) {
    console.error(`  ${name}  — used in ${[...files].join(", ")}`);
  }
  console.error("\nWithout a rule these are denied by default once deployed.");
  process.exit(1);
}

console.log(
  `OK — ${used.size} collections used, all covered by firestore.rules ` +
  `(${declared.size} rules declared).\n` +
  `Reminder: the rules file is NOT deployed automatically. Run 'npm run deploy:rules' after changing it.`
);
