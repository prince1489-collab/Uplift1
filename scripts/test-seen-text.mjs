// test-seen-text.mjs — Seen's messages never show evidence ids, and the Send button sends words,
// not "[object Object]" (3.36.5).
//   node scripts/test-seen-text.mjs
import { readFileSync } from "node:fs";
import * as client from "../src/seenText.js";
import { stripEvidenceIds, isJunkText, guardReflection, guardReply, modelChat, buildDigest, reflectPrompt, replyPrompt } from "../api/_seen.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);

// The two reflections from the founder's screenshot, as saved, and as they should read.
const A = "You come alive tackling problems that look unsolvable at first (A4), and you're doing that with this app right now — turning over how to take it to the next level (A3). That pull toward the hard thing seems to be where your energy goes.";
const A_OUT = "You come alive tackling problems that look unsolvable at first, and you're doing that with this app right now — turning over how to take it to the next level. That pull toward the hard thing seems to be where your energy goes.";
const B = "You're sending kindness out into the world almost every day (S2), and it lands somewhere — Brazil, Nigeria, Sri Lanka (K5-K12). You've noticed how exposed it can feel to reach out (F3, F4), but also how warm (F1, F7).";
const B_OUT = "You're sending kindness out into the world almost every day, and it lands somewhere — Brazil, Nigeria, Sri Lanka. You've noticed how exposed it can feel to reach out, but also how warm.";

const CASES = [
  [A, A_OUT],
  [B, B_OUT],
  ["Both matter to you [A1, S2].", "Both matter to you."],
  ["You keep coming back to it (A4 and S2).", "You keep coming back to it."],
  ["It reached three countries (K5–K12), quietly.", "It reached three countries, quietly."],
  ["You run most mornings (about twice a week).", "You run most mornings (about twice a week)."],
  ["A 5k (or two) before work.", "A 5k (or two) before work."],
  ["Your flat is 4A (A).", "Your flat is 4A (A)."],
  ["", ""],
];

for (const [input, want] of CASES) {
  const got = stripEvidenceIds(input);
  check(`server: ${JSON.stringify(input.slice(0, 44))}…`, got === want, JSON.stringify(got));
  check(`app, the same: ${JSON.stringify(input.slice(0, 44))}…`, client.stripEvidenceIds(input) === got, JSON.stringify(client.stripEvidenceIds(input)));
}
check("an em dash keeps its spaces", stripEvidenceIds(A).includes("right now — turning"));

// "[object Object]" is the app's mistake, never the person's words.
for (const [t, want] of [["[object Object]", true], [" [object Object] ", true], ["hello", false], ["I saw [object Object] in the app", false], [null, false]]) {
  check(`junk text: ${JSON.stringify(t)} → ${want}`, isJunkText(t) === want && client.isJunkText(t) === want);
}

// New messages from the server come out clean.
check("a new reflection has its ids taken out", guardReflection(A) === A_OUT, JSON.stringify(guardReflection(A)));
check("…and a new reply too", guardReply("That sounds like a lovely morning (A2).") === "That sounds like a lovely morning.", JSON.stringify(guardReply("That sounds like a lovely morning (A2).")));
check("the model is told to keep ids out of the text", /ONLY in the "evidence" list/.test(reflectPrompt({ items: [] }).system) && /Never write evidence ids/.test(replyPrompt({}).system));

// The mistaken messages never reach the model, as conversation or as evidence.
const NOW = Date.parse("2026-11-27T12:00:00Z");
const chat = [
  { role: "seen", kind: "question", text: "What's on your mind?", createdAt: NOW - 3000 },
  { role: "me", text: "[object Object]", createdAt: NOW - 2000 },
  { role: "seen", kind: "reply", text: "Tech gremlins!", createdAt: NOW - 1500 },
  { role: "me", text: "Building the next version of my app", createdAt: NOW - 1000 },
  { role: "seen", kind: "update", text: "Your week in Seen", createdAt: NOW - 500 },
];
const seen = modelChat(chat);
check("the model's view leaves out \"[object Object]\" and the app's updates", seen.length === 3 && !seen.some((m) => isJunkText(m.text) || m.kind === "update"), JSON.stringify(seen.map((m) => m.text)));
const digest = buildDigest({ answers: chat.filter((m) => m.role === "me"), now: NOW });
const said = digest.filter((i) => i.id.startsWith("A"));
check("…and so does the evidence: one real answer, no \"[object Object]\"", said.length === 1 && !JSON.stringify(digest).includes("[object Object]"), JSON.stringify(said.map((i) => i.text)));

// The Send button sends what's in the box. Until 3.36.5 it was wired as onClick={send}, which
// handed send() the click event — sent as "[object Object]".
const ui = readFileSync(new URL("../src/SeenConversation.jsx", import.meta.url), "utf8");
check("the Send button calls send() with nothing", ui.includes("onClick={() => send()}") && !ui.includes("onClick={send}"));
check("send() only takes words as a one-tap answer", /typeof said === "string" \? said : null/.test(ui));
check("old mistaken messages are hidden, and old ids taken out, on screen", /isJunkText\(m\.text\)\) return null/.test(ui) && (ui.match(/stripEvidenceIds\(m\.text\)/g) || []).length >= 2);

let failed = 0;
for (const [ok, line] of results) { console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} Seen-text tests passed.`);
process.exit(failed ? 1 : 0);
