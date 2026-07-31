// check-css.cjs — assert that rules the app depends on SURVIVE CSS PARSING.
//
// This exists because of a bug that every other tool called fine.
//
// A comment in index.css closed early, half way through its prose, leaving the remaining
// sentences as raw text at the top level of the stylesheet. CSS error recovery skips forward to
// the next rule boundary when it meets that — so it silently ate the rule immediately after:
// the pinned feed header's background. The bar shipped with no background, its text painting
// directly onto the messages behind it.
//
// What made it expensive is that NOTHING flagged it:
//   - the build stayed green (a malformed comment is valid input);
//   - the rule was present in index.css;
//   - the rule was present in the built stylesheet, so grep found it;
//   - only the browser's parser dropped it, at runtime, on the user's phone.
//
// It cost two wrong diagnoses — the background's opacity, then the z-index — and the first fix
// for it reintroduced the same fault by quoting the offending character sequence inside the
// replacement comment.
//
// So this parses the BUILT stylesheet the way a browser does and checks the rules are really
// there. Add to REQUIRED any selector whose absence would be a visible bug rather than a
// cosmetic one — the point is a short list that fails loudly, not a snapshot of every rule.
//
// Run: node scripts/check-css.cjs   (after `npm run build`)

const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const ASSETS = path.join(__dirname, "..", "dist", "assets");

// selector -> a declaration that must be present on it
const REQUIRED = [
  [".seen-feed-header", "background-color"],   // the one that was eaten
  [".seen-feed-title--world", "color"],
  [".seen-feed-title--focus", "color"],
  [".seen-feed-header .seen-feed-meta", "color"],
];

if (!fs.existsSync(ASSETS)) {
  console.error("No dist/assets — run `npm run build` first.");
  process.exit(1);
}
const cssFile = fs.readdirSync(ASSETS).find((f) => f.endsWith(".css"));
if (!cssFile) {
  console.error("No built stylesheet in dist/assets.");
  process.exit(1);
}
const css = fs.readFileSync(path.join(ASSETS, cssFile), "utf8");

// Collect every (selector, prop) pair the parser actually kept. postcss reports the same
// structure a browser builds, so a rule lost to error recovery simply is not here.
const found = new Map();
postcss.parse(css).walkRules((rule) => {
  rule.selectors.forEach((sel) => {
    const key = sel.replace(/\s+/g, " ").trim();
    if (!found.has(key)) found.set(key, new Set());
    rule.walkDecls((d) => found.get(key).add(d.prop));
  });
});

const missing = REQUIRED.filter(([sel, prop]) => !found.get(sel)?.has(prop));

if (missing.length) {
  console.error(`\nFAIL — ${missing.length} rule(s) did not survive parsing of ${cssFile}:\n`);
  missing.forEach(([sel, prop]) => console.error(`  ${sel} { ${prop}: … }`));
  console.error(
    "\nThe usual cause is a malformed comment in src/index.css: a comment that ends early\n" +
    "leaves prose at the top level, and the parser discards everything up to the next rule\n" +
    "boundary — taking the rule after it with it. Check the comment ABOVE each selector.\n" +
    "grep will not help: the text is in the file and in the build. Only the parser drops it.\n"
  );
  process.exit(1);
}

console.log(`OK — all ${REQUIRED.length} required rules survive parsing (${cssFile}).`);
