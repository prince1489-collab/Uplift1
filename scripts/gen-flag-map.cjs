// gen-flag-map.cjs — regenerates FLAG_MAP in src/MicroAnimations.jsx.
//
// WHY THIS IS GENERATED
// FLAG_MAP was a hand-written literal with 68 entries against the 197 countries in
// COUNTRY_OPTIONS, so 130 of them fell back to 🌍 — including most of Africa, the Caribbean,
// Central America and the Pacific. That's what the V2 review meant by "some countries' flags
// don't show up". Hand-maintaining 197 emoji is how it drifted the first time, so the table
// is derived from Node's own ICU data instead and committed as generated output.
//
// The emoji are baked in rather than computed in the browser on purpose: Intl.DisplayNames
// is fine in current engines, but the app also runs inside Android WebView and older WebViews
// carry older ICU. A committed table renders the same everywhere.
//
// Run:  node scripts/gen-flag-map.cjs          (rewrites the block in place)
//       node scripts/gen-flag-map.cjs --check  (verifies, exits non-zero on drift)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "src", "App.jsx");
const TARGET = path.join(ROOT, "src", "MicroAnimations.jsx");

const BEGIN = "// <flag-map:generated> — do not edit by hand; see scripts/gen-flag-map.cjs";
const END = "// </flag-map:generated>";

// Names the app shows that ICU doesn't use, or uses for a different region. Each one is a
// deliberate editorial choice about what to call a place, so it belongs here rather than in
// the normaliser — silently fuzzy-matching a country name is how you ship the wrong flag.
const ALIASES = {
  "Cabo Verde": "CV",
  "Czech Republic": "CZ",
  "Ivory Coast": "CI",
  "Turkey": "TR",
  "Palestine": "PS",
  "Congo": "CG",                              // Republic of the Congo (Brazzaville)
  "Democratic Republic of the Congo": "CD",   // Kinshasa
  "Saint Vincent and the Grenadines": "VC",
};

// Not in COUNTRY_OPTIONS, but present in profiles saved before the dropdown settled.
const EXTRA = { "UAE": "AE" };

// Fold the cosmetic differences between our labels and CLDR's: diacritics, "and" vs "&",
// "Saint" vs "St.", and CLDR's parenthetical / SAR suffixes.
const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\band\b/gi, "&")
    .replace(/^Saint\b/i, "St.")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+SAR China$/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

// A code is deprecated when CLDR canonicalises it to a different region. These must be
// skipped: ICU maps them to the *current* country's display name, so iterating A→Z lets an
// obsolete code claim the name first. Without this, "Myanmar" resolved to BU (🇧🇺) not MM.
const isCurrent = (cc) => {
  try {
    return (new Intl.Locale(`und-${cc}`).maximize().region || cc) === cc;
  } catch {
    return false;
  }
};

const toFlag = (cc) =>
  String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

function readCountryOptions() {
  const src = fs.readFileSync(APP, "utf8");
  const i = src.indexOf("const COUNTRY_OPTIONS = [");
  if (i === -1) throw new Error("COUNTRY_OPTIONS not found in src/App.jsx");
  const seg = src.slice(i, src.indexOf("];", i));
  return [...seg.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function buildCodeIndex() {
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  const byNorm = new Map();
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of A) {
    for (const b of A) {
      const cc = a + b;
      if (!isCurrent(cc)) continue;
      let name;
      try { name = dn.of(cc); } catch { continue; }
      if (!name || name === cc) continue;
      const key = norm(name);
      if (!byNorm.has(key)) byNorm.set(key, cc);
    }
  }
  return byNorm;
}

function build() {
  const countries = readCountryOptions();
  const byNorm = buildCodeIndex();
  const resolve = (name) => ALIASES[name] || EXTRA[name] || byNorm.get(norm(name));

  const entries = [];
  const unresolved = [];
  for (const name of [...countries, ...Object.keys(EXTRA)]) {
    const cc = resolve(name);
    if (!cc) { unresolved.push(name); continue; }
    entries.push([name, toFlag(cc), cc]);
  }
  if (unresolved.length) {
    throw new Error(
      `No ISO code for ${unresolved.length} name(s): ${unresolved.join(", ")}.\n` +
      "Add each to ALIASES in scripts/gen-flag-map.cjs with its ISO 3166-1 alpha-2 code."
    );
  }

  const lines = entries.map(([name, flag]) => `  ${JSON.stringify(name)}: "${flag}",`);
  return [
    BEGIN,
    `// ${entries.length} entries, generated from Node's ICU data. Regenerate after editing`,
    "// COUNTRY_OPTIONS in src/App.jsx: node scripts/gen-flag-map.cjs",
    "export const FLAG_MAP = {",
    ...lines,
    "};",
    END,
  ].join("\n");
}

function main() {
  const check = process.argv.includes("--check");
  const block = build();
  const src = fs.readFileSync(TARGET, "utf8");
  const i = src.indexOf(BEGIN);
  const j = src.indexOf(END);
  if (i === -1 || j === -1) throw new Error(`Generated block markers not found in ${TARGET}`);
  const next = src.slice(0, i) + block + src.slice(j + END.length);

  if (check) {
    if (next !== src) {
      console.error("FLAG_MAP is out of date. Run: node scripts/gen-flag-map.cjs");
      process.exit(1);
    }
    console.log(`FLAG_MAP up to date (${block.split("\n").length - 6} entries).`);
    return;
  }
  fs.writeFileSync(TARGET, next);
  console.log(`Wrote FLAG_MAP with ${block.split("\n").length - 6} entries.`);
}

main();
