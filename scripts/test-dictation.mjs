// test-dictation.mjs — what you say goes into the box the way you'd expect (3.23).
import { joinDictation } from "../src/dictation.js";

const results = [];
const check = (n, got, want) => results.push([got === want, got === want ? n : `${n} — got "${got}", want "${want}"`]);

check("an empty box starts with a capital", joinDictation("", "your words made my day"), "Your words made my day");
check("words are added after what you typed", joinDictation("Thank you,", "your words made my day"), "Thank you, your words made my day");
check("after a full stop, a new sentence", joinDictation("Thank you.", "your words made my day"), "Thank you. Your words made my day");
check("trailing spaces don't double up", joinDictation("Thank you   ", "really"), "Thank you really");
check("nothing heard leaves the box alone", joinDictation("Thank you", "   "), "Thank you");
check("the box's limit is kept", joinDictation("abc", "defghij", 6), "abc de");
check("a limit on an empty box too", joinDictation("", "hello there", 5), "Hello");

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} dictation tests passed.`);
process.exit(failed ? 1 : 0);
