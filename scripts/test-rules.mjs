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
// Signed OUT. The story-like rules below turn on the difference between "any signed-in person"
// and "anyone at all", and without a context that is genuinely unauthenticated the test would be
// asserting that three signed-in users can do what signed-in users can do.
const ANON = env.unauthenticatedContext().firestore();

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


// ── publicMessages: the world-readable collection, which had no length bound at all until the
//    composer limit went to 200. The bound is the ABUSE ceiling (500), deliberately looser than
//    the composer's 200 so a preset or a proverb that grows by a word is not a permission error —
//    but a client writing straight to Firestore can no longer drop a megabyte into the feed
//    everyone loads. These are the first rules tests this collection has ever had.
const publicMsg = (uid, text) => ({
  uid, sender: "Ada", text, timestamp: 1700000000000,
  country: "United Kingdom", isMystery: false, isPremium: true, sparkReward: 25,
});

await check("public: an ordinary greeting is accepted",
  assertSucceeds(addDoc(collection(A, "publicMessages"), publicMsg("uidA", "Morning! Hope something good finds you today"))));
await check("public: a 200-character post (the composer's limit) is accepted",
  assertSucceeds(addDoc(collection(A, "publicMessages"), publicMsg("uidA", "x".repeat(200)))));
await check("public: a proverb carrying its extra fields is accepted",
  assertSucceeds(addDoc(collection(A, "publicMessages"), {
    ...publicMsg("uidA", "A journey of a thousand miles begins with a single step."),
    proverbOriginal: "千里之行，始于足下", proverbRomanisation: "Qiān lǐ zhī xíng, shǐ yú zú xià",
    proverbLanguage: "Chinese", proverbMeaning: "Big goals require you to start with small actions.",
  })));
await check("public: 500 characters is the ceiling, and still allowed",
  assertSucceeds(addDoc(collection(A, "publicMessages"), publicMsg("uidA", "x".repeat(500)))));
await check("public: 501 characters is refused",
  assertFails(addDoc(collection(A, "publicMessages"), publicMsg("uidA", "x".repeat(501)))));
await check("public: a megabyte is refused",
  assertFails(addDoc(collection(A, "publicMessages"), publicMsg("uidA", "x".repeat(200000)))));
await check("public: empty text is refused",
  assertFails(addDoc(collection(A, "publicMessages"), publicMsg("uidA", ""))));
await check("public: a non-string text is refused",
  assertFails(addDoc(collection(A, "publicMessages"), publicMsg("uidA", 42))));
await check("public: you still cannot post as someone else",
  assertFails(addDoc(collection(B, "publicMessages"), publicMsg("uidA", "not mine to send"))));

// ── Editing your own post ────────────────────────────────────────────────────────────────────
// The update rule used to be "are you the author" and nothing else, which made the text field
// writable without moderation — post something warm, rewrite it to anything, and
// api/moderate-message.js never sees what ends up in the feed. These tests exist because that
// bypass is the reason the rule was tightened, and a rule that silently loosens again would look
// exactly like a working edit feature.
const mineForEdit = await addDoc(collection(A, "publicMessages"), publicMsg("uidA", "Happy birthday Sam"));

await check("author can edit their own post, marking it edited",
  assertSucceeds(updateDoc(doc(A, "publicMessages", mineForEdit.id),
    { text: "Happy birthday Sam!", editedAt: 1700000001000 })));
await check("somebody else cannot edit your post",
  assertFails(updateDoc(doc(B, "publicMessages", mineForEdit.id),
    { text: "not yours to change", editedAt: 1700000002000 })));

// THE MARKER IS NOT OPTIONAL. It is the entire protection for anyone who already reacted: the
// heart stays, so the post has to admit it is not the post they hearted.
await check("text cannot change WITHOUT editedAt — the marker cannot be skipped",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id), { text: "quietly different" })));

// hasMedia still has to work: Feed2 sets it immediately after a GIF attaches, and it does not
// touch the text, so it must pass without pretending to be an edit.
await check("hasMedia can still be set on a post whose text is unchanged",
  assertSucceeds(updateDoc(doc(A, "publicMessages", mineForEdit.id), { hasMedia: true })));

// The fields an author must NOT be able to rewrite.
await check("sparkReward is not editable (delete claws it back, so it would refund drops never earned)",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id), { sparkReward: 99999 })));
await check("timestamp is not editable",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id), { timestamp: 1 })));
await check("uid is not editable — a post cannot be reassigned to someone else",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id), { uid: "uidB" })));
await check("sender is not editable — the name on a post cannot change after the fact",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id), { sender: "Someone Else" })));
await check("a permitted key cannot smuggle a forbidden one alongside it",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id),
    { text: "fine words", editedAt: 1700000003000, sparkReward: 99999 })));

// The same bounds a create is held to.
await check("an edit to 500 characters is allowed",
  assertSucceeds(updateDoc(doc(A, "publicMessages", mineForEdit.id),
    { text: "x".repeat(500), editedAt: 1700000004000 })));
await check("an edit to 501 characters is refused",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id),
    { text: "x".repeat(501), editedAt: 1700000005000 })));
await check("a post cannot be edited to empty",
  assertFails(updateDoc(doc(A, "publicMessages", mineForEdit.id),
    { text: "", editedAt: 1700000006000 })));

// ── Attached media — the only part of the feed that is NOT world-readable ────────────────────
// Everything above in publicMessages is `allow read: if true`. Media is the exception, because
// the promise made about it was "only people in your Focused Feed can see them" — and a filter
// in the client is not that promise, it is a picture of it.
// Shape taken from Klipy's file.<quality>.gif.url. The exact CDN subdomain is unconfirmed
// (their docs were unreachable when this was written) — see firestore.rules. What the
// tests below actually assert is the property that matters: the host must be the
// provider's, and near-misses must not pass.
const KLIPY = "https://cdn.klipy.com/abc123/happy.gif";
const media = (uid, extra = {}) => ({
  uid, type: "gif", url: KLIPY, previewUrl: KLIPY,
  width: 320, height: 240, description: "someone waving", ...extra,
});

// A posts a message and attaches a GIF to it.
const msgWithMedia = await addDoc(collection(A, "publicMessages"), publicMsg("uidA", "look at this"));
await check("author can attach a GIF to their own message",
  assertSucceeds(setDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "item"), media("uidA"))));
await check("you cannot attach media to someone else's message as them",
  assertFails(setDoc(doc(B, "publicMessages", msgWithMedia.id, "media", "other"), media("uidA"))));

// The URL pin. Without it "attach a GIF" accepts any URL a client cares to write.
await check("a non-provider url is refused (tracking pixel / IP-logging host)",
  assertFails(setDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "evil"),
    media("uidA", { url: "https://evil.example.com/pixel.gif", previewUrl: "https://evil.example.com/pixel.gif" }))));
await check("a lookalike host is refused (klipy.com.evil.example)",
  assertFails(setDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "evil2"),
    media("uidA", { url: "https://cdn.klipy.com.evil.example/x.gif", previewUrl: KLIPY }))));
await check("a provider url is not enough on its own — the preview is pinned too",
  assertFails(setDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "evil3"),
    media("uidA", { previewUrl: "https://evil.example.com/pixel.gif" }))));
await check("a non-gif type is refused (photos get their own rule when they exist)",
  assertFails(setDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "evil4"), media("uidA", { type: "image" }))));

// THE READ GATE. B follows A; C does not.
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "users", "uidB", "follows", "uidA"), { uid: "uidA", name: "A" });
});
await check("a follower CAN see the GIF",
  assertSucceeds(getDoc(doc(B, "publicMessages", msgWithMedia.id, "media", "item"))));
await check("a NON-follower cannot see the GIF, even though the message itself is public",
  assertFails(getDoc(doc(C, "publicMessages", msgWithMedia.id, "media", "item"))));
await check("the author can always see their own GIF",
  assertSucceeds(getDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "item"))));

// Write-once. A published GIF that has already been seen must not become a different one.
await check("media cannot be edited after it is published",
  assertFails(setDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "item"),
    media("uidA", { url: "https://cdn.klipy.com/zzz/switched.gif" }))));
await check("the author can delete their own media",
  assertSucceeds(deleteDoc(doc(A, "publicMessages", msgWithMedia.id, "media", "item"))));

// ── Hearts on the daily story ────────────────────────────────────────────────────────────────
// The count is public on purpose — a private tally could not say "other people were moved by this
// too", which is the only reason it is on the card. What has to hold is that only a signed-in
// person can change it, and that nobody but an admin can delete the document out from under a
// story that is still on screen.
const STORY = "s1a2b3c4";
await check("anyone at all can read the count, signed in or not",
  assertSucceeds(getDoc(doc(ANON, "storyLikes", STORY))));
await check("a signed-in person can add their heart",
  assertSucceeds(setDoc(doc(A, "storyLikes", STORY), { uids: ["uidA"], count: 1, link: "https://x.test/1", at: Date.now() })));
await check("a second person can add theirs to the same story",
  assertSucceeds(setDoc(doc(B, "storyLikes", STORY), { uids: ["uidA", "uidB"], count: 2, link: "https://x.test/1", at: Date.now() }, { merge: true })));
await check("an anonymous visitor cannot",
  assertFails(setDoc(doc(ANON, "storyLikes", STORY), { uids: ["nobody"], count: 1 })));
await check("nobody ordinary can delete the count for a story still on screen",
  assertFails(deleteDoc(doc(A, "storyLikes", STORY))));

console.log();
for (const [ok, name] of results) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n  ${results.length - failed}/${results.length} passed`);
await env.cleanup();
process.exit(failed ? 1 : 0);
