// test-app-version.mjs — when the "new version" line shows.
import { compareVersions, updateState } from "../src/appVersion.js";
const r = [];
const check = (n, ok) => r.push([ok, n]);
check("3.7 is older than 3.8", compareVersions("3.7", "3.8") === -1);
check("3.10 is newer than 3.9 (not text order)", compareVersions("3.10", "3.9") === 1);
check("3.8 equals 3.8.0", compareVersions("3.8", "3.8.0") === 0);
check("up to date shows nothing", updateState({ current: "3.8", latest: "3.8" }) === null);
check("newer than latest shows nothing", updateState({ current: "3.9", latest: "3.8" }) === null);
check("older shows a dismissible line", updateState({ current: "3.7", latest: "3.8", minimum: "3.4" })?.required === false);
check("dismissed stays hidden", updateState({ current: "3.7", latest: "3.8", dismissed: true }) === null);
check("below minimum shows even if dismissed, and can't be closed", updateState({ current: "3.3", latest: "3.8", minimum: "3.4", dismissed: true })?.required === true);
check("no latest set shows nothing", updateState({ current: "3.7" }) === null);
let f = 0; for (const [ok, n] of r) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) f++; }
console.log(`\n  ${r.length - f}/${r.length} app-version tests passed.`);
process.exit(f ? 1 : 0);
