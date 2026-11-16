// test-kindness-emulator.mjs — the delivery (api/_kindness.js) against the REAL Firestore Admin
// SDK and emulator, not a fake: transactions, getAll, the presence query and the writes it makes.
// Needs the emulator (and therefore Java):
//   npx firebase-tools emulators:exec --only firestore --project demo-seen "node scripts/test-kindness-emulator.mjs"
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { deliverKindness, dayKey } from "../api/_kindness.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error("Run this inside the Firestore emulator (see the header)."); process.exit(1); }
initializeApp({ projectId: "demo-seen" });
const db = getFirestore();
const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);

const NOW = Date.now();
const person = (country) => ({ fullName: "A Person", country, onboardingCompletedAt: 1 });
const batch = db.batch();
batch.set(db.doc("users/s1"), person("United Kingdom"));
batch.set(db.doc("users/r1"), person("India"));
batch.set(db.doc("users/r2"), person("United Kingdom"));
batch.set(db.doc("users/r3"), person("Canada"));
for (const id of ["s1", "r1", "r2", "r3"]) batch.set(db.doc(`presence/${id}`), { uid: id, lastSeen: NOW - 3600000 });
batch.set(db.doc("users/r3/blockedUsers/s1"), { name: "s1" });
batch.set(db.doc("publicMessages/e1"), { uid: "s1", sender: "Sam Smith", country: "United Kingdom", text: "You are not alone", timestamp: NOW });
batch.set(db.doc("publicMessages/e2"), { uid: "s1", sender: "Sam Smith", country: "United Kingdom", text: "It's okay to rest", timestamp: NOW });
await batch.commit();

const screen = async () => ({ ok: true });
const r = await deliverKindness({ db, uid: "s1", messageId: "e1", screen, random: () => 0.5 });
check("delivers through the real SDK", r.delivered === true && r.toUid === "r1" && r.country === "India", JSON.stringify(r));
const inbox = await db.doc("users/r1/kindnessInbox/e1").get();
check("the inbox pointer is written", inbox.exists && inbox.data().fromUid === "s1" && inbox.data().seen === false);
check("the message carries only the country", JSON.stringify(Object.keys((await db.doc("publicMessages/e1").get()).data().delivered).sort()) === '["at","country"]');
const ledger = (await db.doc("kindnessLedger/r1").get()).data();
check("the recipient's day is counted", ledger.inDay === dayKey(NOW) && ledger.inCount === 1, JSON.stringify(ledger));

const again = await deliverKindness({ db, uid: "s1", messageId: "e1", screen });
check("a second call is a no-op", again.already === true);

const r2 = await deliverKindness({ db, uid: "s1", messageId: "e2", screen, random: () => 0.5 });
check("the next message goes to someone new, never someone who blocked the sender", r2.toUid === "r2", JSON.stringify(r2));
check("the sender's ledger remembers both", JSON.stringify((await db.doc("kindnessLedger/s1").get()).data().recent) === '["r2","r1"]');

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} emulator delivery tests passed.`);
process.exit(failed ? 1 : 0);
