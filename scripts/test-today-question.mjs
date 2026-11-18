// test-today-question.mjs — one question a day, the same for everyone (3.33).
//   node scripts/test-today-question.mjs

import { QUESTIONS, questionFor, answerIdFor, othersAnswers, answersSoFar, answerDoc, MAX_ANSWER, SHOWN } from "../src/todayQuestion.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);
// The repo's no-guilt rule (scripts/check-reflect.cjs), and nothing clinical or sensitive.
const GUILT = /streak|don't lose|running out|last chance|still haven't|should have|failed|miss(ed)? out/i;
const SENSITIVE = /depress|anxi|lonel|sad\b|struggl|mental|therap|diagnos|suicid|religio|politic|sexual|weight|money|debt/i;

check("at least 30 questions", QUESTIONS.length >= 30, String(QUESTIONS.length));
check("each one is a question, under 90 characters", QUESTIONS.every((x) => x.q.endsWith("?") && x.q.length <= 90), QUESTIONS.filter((x) => !x.q.endsWith("?") || x.q.length > 90).map((x) => x.id).join());
check("ids are unique", new Set(QUESTIONS.map((x) => x.id)).size === QUESTIONS.length);
check("no guilt, nothing clinical or sensitive", QUESTIONS.every((x) => !GUILT.test(x.q) && !SENSITIVE.test(x.q)), QUESTIONS.filter((x) => GUILT.test(x.q) || SENSITIVE.test(x.q)).map((x) => x.q).join(" | "));
check("the same day gives everyone the same question", questionFor("2026-11-18").id === questionFor("2026-11-18").id);
check("the next day gives a different one", questionFor("2026-11-18").id !== questionFor("2026-11-19").id);
const ids = new Set(); for (let d = 0; d < QUESTIONS.length; d++) ids.add(questionFor(new Date(Date.UTC(2026, 10, 18 + d)).toISOString().slice(0, 10)).id);
check("every question comes round before any repeats", ids.size === QUESTIONS.length, String(ids.size));
check("a bad date still gives a question", typeof questionFor("nope").q === "string");
check("one answer per person per day, at a fixed id", answerIdFor("2026-11-18", "u1") === "2026-11-18_u1");

const doc = answerDoc({ dayKey: "2026-11-18", uid: "u1", text: "  My   neighbour Raj   carried my shopping  ", firstName: "Mona Patel", country: "India", now: 5 });
check("an answer is tidied and signed with a first name and a flag",
  doc.text === "My neighbour Raj carried my shopping" && doc.name === "Mona" && doc.country === "India" && doc.qid === questionFor("2026-11-18").id && doc.createdAt === 5, JSON.stringify(doc));
check("…without a name when posted anonymously", answerDoc({ dayKey: "2026-11-18", uid: "u1", text: "x", firstName: "Mona", anonymous: true }).name === null);
check("…cut to 200 characters", answerDoc({ dayKey: "2026-11-18", uid: "u1", text: "y".repeat(500) }).text.length === MAX_ANSWER);
check("…and nothing to save without words", answerDoc({ dayKey: "2026-11-18", uid: "u1", text: "   " }) === null);

const list = [
  { uid: "me", text: "mine", createdAt: 9 },
  { uid: "a", text: "first", country: "India", createdAt: 1 },
  { uid: "b", text: "second", country: "Kenya", createdAt: 3 },
  { uid: "blocked", text: "hidden", country: "Kenya", createdAt: 4 },
  { uid: "c", text: "  ", createdAt: 5 },
  ...Array.from({ length: 12 }, (_, i) => ({ uid: `x${i}`, text: `x${i}`, country: "Brazil", createdAt: 10 + i })),
];
const shown = othersAnswers(list, { myUid: "me", blocked: new Set(["blocked"]) });
check("others' answers: never yours, never someone blocked, never empty", !shown.some((a) => ["me", "blocked", "c"].includes(a.uid)));
check("…newest first, and the list ends at ten", shown.length === SHOWN && shown[0].uid === "x11", JSON.stringify(shown.map((a) => a.uid)));
check("so far: everyone's answers and countries", JSON.stringify(answersSoFar(list)) === JSON.stringify({ count: 16, countries: 3 }), JSON.stringify(answersSoFar(list)));

let failed = 0;
for (const [ok, line] of results) { console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} today's-question tests passed.`);
process.exit(failed ? 1 : 0);
