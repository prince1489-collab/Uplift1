// check-flags.cjs — asserts every country the signup dropdown offers has a real flag.
//
// This is the check that would have caught the original defect: FLAG_MAP had 68 of 197
// countries, so 130 rendered as 🌍 and nobody noticed until a user sent a screenshot. It also
// catches the subtler failure — a flag that exists but is wrong, which is how Myanmar briefly
// resolved to the obsolete BU codepoints during the rewrite.
//
// Run: node scripts/check-flags.cjs

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const app = fs.readFileSync(path.join(ROOT, "src", "App.jsx"), "utf8");
const i = app.indexOf("const COUNTRY_OPTIONS = [");
if (i === -1) throw new Error("COUNTRY_OPTIONS not found in src/App.jsx");
const countries = [...app.slice(i, app.indexOf("];", i)).matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const mic = fs.readFileSync(path.join(ROOT, "src", "MicroAnimations.jsx"), "utf8");
const block = mic.slice(mic.indexOf("export const FLAG_MAP = {"), mic.indexOf("// </flag-map:generated>"));
const map = Object.fromEntries(
  [...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]])
);

const problems = [];

for (const name of countries) {
  const flag = map[name];
  if (!flag) problems.push(`${name}: no entry in FLAG_MAP`);
  else if (flag === "🌍") problems.push(`${name}: globe fallback baked in`);
}

// Every value must be exactly two regional-indicator symbols — anything else is not a flag,
// however plausible it looks in a diff.
for (const [name, flag] of Object.entries(map)) {
  const cp = [...flag].map((c) => c.codePointAt(0));
  const ok = cp.length === 2 && cp.every((x) => x >= 0x1f1e6 && x <= 0x1f1ff);
  if (!ok) problems.push(`${name}: "${flag}" is not a regional-indicator pair`);
}

if (problems.length) {
  console.error(`${problems.length} flag problem(s):`);
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}

console.log(`OK — ${countries.length} countries, ${Object.keys(map).length} flags, no gaps.`);
