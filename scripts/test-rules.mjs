// test-rules.mjs — exercises firestore.rules against the REAL rules engine.
//
// check-rules.cjs asks "does every collection have a rule?". This asks the harder question:
// "does the rule actually do what its comment claims?" Both matter, and this project has
// twice shipped a rules problem that presented as something else entirely.
//
// The headline claim under test: the one-reply-back cap on privateReplies is enforced by the
// RULES, not by hiding a button — so it has to hold against a client writing directly, which
// is exactly what this does.
//
// Needs the emulator (and therefore Java):
//   npx firebase-tools emulators:exec --only firestore --project demo-seen "npm run test:rules"
// or start `emulators:start` in one terminal and `npm run test:rules` in another.
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { doc, setDoc, getDoc, addDoc, collection, updateDoc, deleteDoc } from "firebase/firestore";

const RULES = join(dirname(fileURLToPath(import.meta.url)), "..", "firestore.rules");
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

const env = await initializeTestEnvironment({
  projectId: "demo-seen",
  firestore: { rules: readFileSync(RULES, "utf8"), host, port: Number(port) },
});
await env.clearFirestore();

const A = env.authenticatedContext("uidA").firestore(); // posted the public message
const B = env.authenticatedContext("uidB").firestore(); // replied privately
const C = env.authenticatedContext("uidC").firestore(); // uninvolved third party

const results = [];
const check = async (name, promise) => {
  try { await promise; results.push([true, name]); }
  catch (e) { results.push([false, `${name}  — ${e.message.slice(0, 90)}`]); }
};

const reply = (from, to, extra = {}) => ({
  fromUid: from, toUid: to, fromName: "Someone", messageId: "msg1",
  messageText: "hello world", text: "you are not alone", ts: 1, read: false, ...extra,
});

// ── 1. B replies privately to A's message (the existing behaviour, must still work)
const r1 = doc(collection(B, "privateReplies"));
await check("B can send a first private reply to A", assertSucceeds(setDoc(r1, reply("uidB", "uidA"))));

// ── 2. Only the two of them can read it
await check("A can read the reply addressed to them", assertSucceeds(getDoc(doc(A, "privateReplies", r1.id))));
await check("B can read their own sent reply", assertSucceeds(getDoc(doc(B, "privateReplies", r1.id))));
await check("an uninvolved third party CANNOT read it", assertFails(getDoc(doc(C, "privateReplies", r1.id))));

// ── 3. A answers once, at the derived id
const answerId = `${r1.id}__reply`;
await check("A can answer once, at the derived id",
  assertSucceeds(setDoc(doc(A, "privateReplies", answerId), reply("uidA", "uidB", { inReplyTo: r1.id }))));

// ── 4. THE CAP. A second answer is a write to an existing path = an update, and the update
//        rule permits only `read` to change. This must fail at the rules layer.
await check("A CANNOT answer a second time (the cap)",
  assertFails(setDoc(doc(A, "privateReplies", answerId), reply("uidA", "uidB", { inReplyTo: r1.id, text: "and another thing" }))));

// ── 5. An answer cannot be answered — no chains
await check("B CANNOT answer the answer (no __reply__reply)",
  assertFails(setDoc(doc(B, "privateReplies", `${answerId}__reply`), reply("uidB", "uidA", { inReplyTo: answerId }))));

// ── 6. The derived id cannot be forged: an answer must sit at inReplyTo + '__reply'
await check("an answer at a mismatched id is rejected",
  assertFails(setDoc(doc(A, "privateReplies", "some-other-id"), reply("uidA", "uidB", { inReplyTo: r1.id }))));
await check("an answer at an auto-id is rejected",
  assertFails(addDoc(collection(A, "privateReplies"), reply("uidA", "uidB", { inReplyTo: r1.id }))));

// ── 7. Existing guarantees must be untouched by the new clause
await check("cannot forge a reply as someone else",
  assertFails(addDoc(collection(C, "privateReplies"), reply("uidA", "uidB"))));
await check("cannot reply to yourself",
  assertFails(addDoc(collection(B, "privateReplies"), reply("uidB", "uidB"))));
await check("empty text is rejected",
  assertFails(addDoc(collection(B, "privateReplies"), reply("uidB", "uidA", { text: "" }))));
await check("over-long text is rejected",
  assertFails(addDoc(collection(B, "privateReplies"), reply("uidB", "uidA", { text: "x".repeat(501) }))));
await check("recipient can still mark it read",
  assertSucceeds(updateDoc(doc(A, "privateReplies", r1.id), { read: true })));
await check("recipient still cannot edit the text",
  assertFails(updateDoc(doc(A, "privateReplies", r1.id), { text: "rewritten" })));
await check("either party can still delete",
  assertSucceeds(deleteDoc(doc(B, "privateReplies", r1.id))));

// ── 8. The exact write shape the CLIENT produces, not a hand-rolled approximation.
//        PrivateReplySheet builds `${answering.id}__reply` with `inReplyTo: answering.id`;
//        if those two ever drift apart from the rule, replying back breaks in production
//        while every test above still passes.
const clientPayload = (fromUid, toUid, extra = {}) => ({
  fromUid, fromName: "Ada", fromCountry: "United Kingdom", toUid,
  messageId: "msg9", messageText: "a public message", text: "thank you, truly",
  ts: 1700000000000, read: false, ...extra,
});
const first = doc(collection(B, "privateReplies"));
await check("client shape: B's first reply is accepted",
  assertSucceeds(setDoc(first, clientPayload("uidB", "uidA"))));
await check("client shape: A's answer at `${id}__reply` with inReplyTo is accepted",
  assertSucceeds(setDoc(doc(A, "privateReplies", `${first.id}__reply`),
    clientPayload("uidA", "uidB", { inReplyTo: first.id }))));


console.log();
for (const [ok, name] of results) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n  ${results.length - failed}/${results.length} passed`);
await env.cleanup();
process.exit(failed ? 1 : 0);
