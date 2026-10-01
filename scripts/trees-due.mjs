// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// trees-due.mjs — who has grown a Tree of Life and is waiting for a real tree.
//
// Grow promises: "A fully grown tree here plants a real one, in your name." The app records the
// moment somebody first reaches the top stage (users/{uid}.treeOfLifeAt, App.jsx). This lists
// everyone with that and no `treePlantedAt` yet — the minimum needed to plant in someone's name:
// first name, country, and when they got there. Run it on your own machine:
//
//   SEEN_SERVICE_ACCOUNT=/path/to/service-account.json node scripts/trees-due.mjs
//
// Read-only by default. After planting, mark one as done so it leaves the list:
//
//   SEEN_SERVICE_ACCOUNT=... node scripts/trees-due.mjs --planted <uid>
//
// The uid is printed only so it can be passed back here; it never leaves your terminal.

import { readFileSync } from "node:fs";

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "(no name)";
const when = (ms) => (Number(ms) ? new Date(Number(ms)).toISOString().slice(0, 10) : "?");

export function due(users) {
  return users
    .filter((u) => u.treeOfLifeAt && !u.treePlantedAt)
    .sort((a, b) => Number(a.treeOfLifeAt) - Number(b.treeOfLifeAt))
    .map((u) => ({ uid: u.uid, name: firstName(u.fullName), country: u.country || "", reached: when(u.treeOfLifeAt) }));
}

async function main() {
  const { cert, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const path = process.env.SEEN_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-seen" });
  else if (path) initializeApp({ credential: cert(JSON.parse(readFileSync(path, "utf8"))) });
  else { console.error("Set SEEN_SERVICE_ACCOUNT to the path of a service-account JSON file."); process.exit(1); }
  const db = getFirestore();

  const i = process.argv.indexOf("--planted");
  if (i > 0) {
    const uid = process.argv[i + 1];
    if (!uid) { console.error("Usage: --planted <uid>"); process.exit(1); }
    await db.collection("users").doc(uid).set({ treePlantedAt: Date.now() }, { merge: true });
    console.log(`Marked as planted: ${uid}`);
    return;
  }

  // Only the fields needed to plant in someone's name.
  const snap = await db.collection("users").select("fullName", "country", "treeOfLifeAt", "treePlantedAt").get();
  const list = due(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  if (!list.length) { console.log("Nobody is waiting for a tree yet."); return; }
  console.log(`${list.length} real ${list.length === 1 ? "tree" : "trees"} to plant:\n`);
  for (const t of list) console.log(`  ${t.reached}  ${t.name.padEnd(16)} ${t.country.padEnd(20)} ${t.uid}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
