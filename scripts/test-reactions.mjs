// test-reactions.mjs — the one-reaction-per-person rule, against a real Firestore.
//
// The rule is: a person has at most ONE reaction document per message. A heart or a sticker,
// never both; one sticker, never two. Picking anything replaces what you had.
//
// That was broken in production and the reason is worth remembering: FOUR separate places wrote
// reaction documents — the chip on the bubble, the heart in the long-press bar, the sticker
// picker, and a dead component nobody rendered — and each one's idea of "what this person
// already has" was the list ["❤️"]. So a sticker was invisible to the heart paths and the heart
// was invisible to the sticker path, and a message ended up carrying both from one person.
//
// There is now one writer, setMyReaction in src/reactions.js, and this asserts the property it
// exists to hold. It imports that function and runs it against the emulator rather than
// re-describing what it ought to do — a test that reimplements the logic proves nothing.
//
// Needs the emulator (and therefore Java):
//   npx firebase-tools emulators:exec --only firestore --project demo-seen "npm run test:reactions"
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { collection, getDocs } from "firebase/firestore";
import { setMyReaction, HEART } from "../src/reactions.js";

const RULES = join(dirname(fileURLToPath(import.meta.url)), "..", "firestore.rules");
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

const env = await initializeTestEnvironment({
  projectId: "demo-seen",
  firestore: { rules: readFileSync(RULES, "utf8"), host, port: Number(port) },
});
await env.clearFirestore();

const A = env.authenticatedContext("uidA").firestore();
const B = env.authenticatedContext("uidB").firestore();
const MSG = "msg-reactions";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);

// Everyone who currently holds a reaction on the message, as { uid: reactionId }.
// Deliberately read back from Firestore rather than tracked in the test: the point is what the
// database looks like afterwards, not what the caller believed it was doing.
async function board() {
  const snap = await getDocs(collection(A, "publicMessages", MSG, "reactions"));
  const held = {};
  const counts = {};
  snap.forEach((d) => {
    const { uids = [], count = 0 } = d.data();
    counts[d.id] = count;
    for (const u of uids) held[u] = held[u] ? `${held[u]}+${d.id}` : d.id;
  });
  return { held, counts };
}

const react = (db, uid, fromId, toId, country = "IN") =>
  setMyReaction({ db, uid, messageId: MSG, fromId, toId, country });

// ── 1. First reaction ─────────────────────────────────────────────────────────────────────────
await react(A, "uidA", null, HEART);
let { held, counts } = await board();
check("a heart is recorded", held.uidA === HEART, `got ${held.uidA}`);
check("count follows the list", counts[HEART] === 1, `got ${counts[HEART]}`);

// ── 2. Heart → sticker. THE regression: both used to survive. ────────────────────────────────
await react(A, "uidA", HEART, "sticker_hug");
({ held, counts } = await board());
check("a sticker REPLACES a heart", held.uidA === "sticker_hug", `got ${held.uidA}`);
check("the heart's count drops to zero", counts[HEART] === 0, `got ${counts[HEART]}`);

// ── 3. Sticker → a different sticker ─────────────────────────────────────────────────────────
await react(A, "uidA", "sticker_hug", "sticker_clap");
({ held, counts } = await board());
check("a sticker replaces a sticker", held.uidA === "sticker_clap", `got ${held.uidA}`);
check("the previous sticker is emptied", counts.sticker_hug === 0, `got ${counts.sticker_hug}`);

// ── 4. Sticker → heart, the other direction ──────────────────────────────────────────────────
await react(A, "uidA", "sticker_clap", HEART);
({ held, counts } = await board());
check("a heart replaces a sticker", held.uidA === HEART, `got ${held.uidA}`);
check("the sticker is emptied", counts.sticker_clap === 0, `got ${counts.sticker_clap}`);

// ── 5. Taking it back ────────────────────────────────────────────────────────────────────────
await react(A, "uidA", HEART, null);
({ held, counts } = await board());
check("taking it back leaves nothing", held.uidA === undefined, `got ${held.uidA}`);
check("count returns to zero", counts[HEART] === 0, `got ${counts[HEART]}`);

// ── 6. Two people are independent ────────────────────────────────────────────────────────────
await react(A, "uidA", null, HEART);
await react(B, "uidB", null, "sticker_hug");
({ held, counts } = await board());
check("one person's reaction does not disturb another's",
  held.uidA === HEART && held.uidB === "sticker_hug", JSON.stringify(held));
check("each count is 1", counts[HEART] === 1 && counts.sticker_hug === 1, JSON.stringify(counts));

// ── 7. Idempotence — a double tap must not count twice ───────────────────────────────────────
// A dropped frame, a retried transaction, a second tap in the same moment: the write can arrive
// twice with the same arguments. The uids list is a set in spirit, so it has to behave like one.
await react(A, "uidA", null, HEART);
({ held, counts } = await board());
check("re-applying the same reaction does not double the count",
  counts[HEART] === 1, `got ${counts[HEART]}`);
check("nor does it list the person twice", held.uidA === HEART, `got ${held.uidA}`);

// ── 8. The country map moves with the reaction ───────────────────────────────────────────────
// The globe reads `countries[uid]`. When a reaction is cleared the entry must go with it, or a
// person who took their heart back keeps a dot on someone else's map.
await react(A, "uidA", HEART, "sticker_sun", "JP");
const snap8 = await getDocs(collection(A, "publicMessages", MSG, "reactions"));
const byId = {};
snap8.forEach((d) => { byId[d.id] = d.data(); });
check("the new reaction carries the country", byId.sticker_sun?.countries?.uidA === "JP",
  JSON.stringify(byId.sticker_sun?.countries));
check("the old reaction drops it", !(("uidA") in (byId[HEART]?.countries ?? {})),
  JSON.stringify(byId[HEART]?.countries));
check("and drops its timestamp too", !(("uidA") in (byId[HEART]?.reactedAt ?? {})),
  JSON.stringify(byId[HEART]?.reactedAt));

// ── 9. A no-op is a no-op ────────────────────────────────────────────────────────────────────
// fromId === toId means "nothing changed". It must not run a transaction that re-adds you.
await react(A, "uidA", "sticker_sun", "sticker_sun");
({ counts } = await board());
check("setting the reaction you already have changes nothing",
  counts.sticker_sun === 1, `got ${counts.sticker_sun}`);

// ── Report ───────────────────────────────────────────────────────────────────────────────────
let failed = 0;
for (const [ok, name] of results) {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}`);
  if (!ok) failed++;
}
console.log(`\n  ${results.length - failed}/${results.length} reaction tests passed.`);
await env.cleanup();
process.exit(failed ? 1 : 0);
