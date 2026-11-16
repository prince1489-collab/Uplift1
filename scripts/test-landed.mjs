// test-landed.mjs — "Tell {name} how their words landed" is offered only when words could have
// landed (3.22): no routine greetings, no repeats of someone's usual line.
import { isRoutineGreeting, repeatsTheirUsual, couldHaveLanded, normalizeText, offeredOn } from "../src/landed.js";

const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);

for (const g of ["Ram Ram good morning 😊🙏", "Ram ram good morning 😊❤️", "Good morning everyone!", "Happy Monday Everyone",
  "Jai Shri Krishna 🙏", "good night ji", "Have a great day!", "Hello everyone", "Namaste 🙏 good morning", "Happy weekend all"]) {
  check(`a greeting: "${g}"`, isRoutineGreeting(g));
}
for (const t of ["You are not alone 🤝", "Just saw Ramayana Part 1. Really impressed with how well it has been made.",
  "Remember: you matter, always. 💙", "Good morning — I got the job!! Thank you all for the prayers",
  "Happy 2083! Wherever you are right now, I hope this new year brings peaceful mornings", "Wishing you and your family joy this season"]) {
  check(`not a greeting: "${t.slice(0, 40)}"`, !isRoutineGreeting(t));
}
check("emoji and case don't matter", normalizeText("Ram Ram good morning 😊🙏") === normalizeText("Ram ram GOOD morning 😊❤️"));

const mum = (id, text, ts) => ({ id, uid: "mum", text, timestamp: ts });
const feed = [mum("a", "Jai Mata Di, have faith today", 1), mum("b", "Jai Mata Di, have faith today", 2), mum("c", "We got the keys to the new house!", 3)];
check("the same line again is their usual", repeatsTheirUsual(feed[1], feed));
check("the first time they said it isn't", !repeatsTheirUsual(feed[0], feed));
check("someone else saying it doesn't count", !repeatsTheirUsual({ id: "z", uid: "sam", text: "Jai Mata Di, have faith today", timestamp: 9 }, feed));
check("news could have landed", couldHaveLanded(feed[2], feed));
check("a repeat could not", !couldHaveLanded(feed[1], feed));
check("a greeting could not", !couldHaveLanded(mum("d", "Good morning 🌞", 4), feed));

const rec = { day: "2026-11-16", uid: "vidhi", prev: { day: "2026-11-15", uid: "mum" } };
check("who was offered today", offeredOn(rec, "2026-11-16") === "vidhi");
check("who was offered yesterday", offeredOn(rec, "2026-11-15") === "mum");
check("nobody for a day with no record", offeredOn(rec, "2026-11-14") === null && offeredOn(null, "2026-11-16") === null);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} landed tests passed.`);
process.exit(failed ? 1 : 0);
