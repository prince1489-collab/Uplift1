// check-no-scores.cjs — Seen doesn't score anyone's wellbeing (3.31).
//
// Until 3.31 the app had a WHO-5 wellbeing score (out of 100, with a trend) and, in front of the
// helplines in Support, clinical questionnaires (PHQ-9, GAD-7, loneliness, stress, burnout) scored
// into a severity. The founder took them out: "dangerous for an app like this which is non
// clinical to give scores around wellbeing". This keeps them out. It reads the code with comments
// stripped (the comments explain the history, and may name what was removed).
//
// Run: node scripts/check-no-scores.cjs

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const problems = [];

if (fs.existsSync(path.join(SRC, "Wellbeing.jsx"))) problems.push("src/Wellbeing.jsx is back — the WHO-5 check-in was removed in 3.31");

const BANNED = /WHO-?5|who5|PHQ-?\d|GAD-?\d|QUESTIONNAIRE|WellbeingCheckin|WellbeingPanel|computeScore|isLowWellbeing|getAffiliateApps|COPING_TIPS/i;
const strip = (code) => code
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(js|jsx)$/.test(e.name) ? [path.join(dir, e.name)] : []);
for (const file of walk(SRC)) {
  const code = strip(fs.readFileSync(file, "utf8"));
  code.split("\n").forEach((line, i) => {
    const m = line.match(BANNED);
    if (m) problems.push(`${path.relative(path.join(__dirname, ".."), file)}:${i + 1} mentions "${m[0]}" in code`);
  });
}

// Support is helplines only: nothing to answer before a number is shown.
const support = strip(fs.readFileSync(path.join(SRC, "Support.jsx"), "utf8"));
if (!/getResources\(/.test(support) || !/getEmergency\(/.test(support)) problems.push("src/Support.jsx no longer shows the helplines and the emergency number");

if (problems.length) {
  console.error(`${problems.length} wellbeing score or questionnaire problem(s):`);
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}
console.log("OK — no wellbeing scores or questionnaires; Support is helplines.");
