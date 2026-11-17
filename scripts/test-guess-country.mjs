// test-guess-country.mjs — the sign-up form pre-selects the right country (3.28).
//
// Reads the REAL country list (App.jsx COUNTRY_OPTIONS) and flag map (MicroAnimations FLAG_MAP)
// from source, so a renamed country breaks this rather than the form.
//
//   node scripts/test-guess-country.mjs

import fs from "node:fs";
import { guessCountry, flagToCode, regionOf } from "../src/guessCountry.js";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const anim = fs.readFileSync(new URL("../src/MicroAnimations.jsx", import.meta.url), "utf8");
const optBlock = app.slice(app.indexOf("const COUNTRY_OPTIONS = ["), app.indexOf("];", app.indexOf("const COUNTRY_OPTIONS = [")));
const options = [...optBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const flagBlock = anim.slice(anim.indexOf("export const FLAG_MAP = {"), anim.indexOf("};", anim.indexOf("export const FLAG_MAP = {")));
const flagMap = Object.fromEntries([...flagBlock.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);
const g = (timeZone, languages = []) => guessCountry({ timeZone, languages, options, flagMap });

check("the real lists were read", options.length > 150 && Object.keys(flagMap).length > 150, `${options.length} options, ${Object.keys(flagMap).length} flags`);
check("a flag is its two letters", flagToCode("🇬🇧") === "GB" && flagToCode("🇮🇳") === "IN" && flagToCode("x") === null);
check("a language tag's region", regionOf("en-GB") === "GB" && regionOf("hi_IN") === "IN" && regionOf("zh-Hant-TW") === "TW" && regionOf("en") === null);
check("London → United Kingdom", g("Europe/London") === "United Kingdom", g("Europe/London"));
check("Kolkata → India, even with a US-English phone", g("Asia/Kolkata", ["en-US"]) === "India", g("Asia/Kolkata", ["en-US"]));
check("New York → United States", g("America/New_York") === "United States", g("America/New_York"));
check("the time zone wins over the language", g("Europe/London", ["en-IN"]) === "United Kingdom");
check("an unmapped zone falls back to the language region", g("Antarctica/Troll", ["en-GB"]) === "United Kingdom" && g(null, ["hi-IN"]) === "India");
check("nothing known, nothing guessed", g(null, []) === null && g("Antarctica/Troll", ["en"]) === null);
const missing = ["GB", "IN", "US", "CA", "AU", "NZ", "IE", "PK", "BD", "AE", "NG", "KE", "ZA", "DE", "FR", "ES"]
  .filter((code) => !Object.entries(flagMap).some(([name, f]) => flagToCode(f) === code && options.includes(name)));
check("the countries most people come from are all on the form", missing.length === 0, missing.join(", "));

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} country-guess tests passed.`);
process.exit(failed ? 1 : 0);
