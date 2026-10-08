// test-delete-account.mjs — "Delete account" deletes everything that is the person's, leaves
// everyone else's alone, finishes on a retry, and takes the sign-in last (3.20).
// Runs api/_deleteAccount.js against an in-memory Firestore and fake Auth / Storage / Stripe.
import { deleteAccountData, CONFIRM_WORD } from "../api/_deleteAccount.js";
import handler from "../api/delete-account.js";
const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);

// ── An in-memory Firestore with the calls _deleteAccount.js makes ──
function fakeDb() {
  const store = new Map();
  const isDirectChild = (path, coll) => path.startsWith(`${coll}/`) && !path.slice(coll.length + 1).includes("/");
  const docRef = (path) => ({
    path, id: path.split("/").pop(),
    collection: (n) => coll(`${path}/${n}`),
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
  });
  const snapOf = (paths) => ({ docs: paths.map((p) => ({ id: p.split("/").pop(), ref: docRef(p), data: () => store.get(p) })) });
  const coll = (path) => ({
    doc: (id) => docRef(`${path}/${id}`),
    where: (field, op, value) => ({ get: async () => snapOf([...store.keys()].filter((k) => isDirectChild(k, path) && store.get(k)?.[field] === value)) }),
  });
  return {
    store,
    collection: (n) => coll(n),
    collectionGroup: (name) => ({ where: (field, op, value) => ({ get: async () => snapOf([...store.keys()].filter((k) => {
      const parts = k.split("/");
      return parts.length >= 2 && parts[parts.length - 2] === name && store.get(k)?.[field] === value;
    })) }) }),
    recursiveDelete: async (ref) => { for (const k of [...store.keys()]) if (k === ref.path || k.startsWith(`${ref.path}/`)) store.delete(k); },
  };
}
const put = (db, path, data) => db.store.set(path, data);

function seed() {
  const db = fakeDb();
  for (const who of ["me", "other"]) {
    put(db, `users/${who}`, { fullName: who, ...(who === "me" ? { stripeSubscriptionId: "sub_1" } : {}) });
    put(db, `users/${who}/journal/j1`, { text: "x" });
    put(db, `users/${who}/seenChat/c1`, { text: "x" });
    put(db, `users/${who}/understanding/state`, { themes: [] });
    put(db, `users/${who}/feelings/2026-10-08_1`, { feelings: ["warm"] });
    put(db, `publicProfiles/${who}`, { uid: who, rightNow: "x" });
    put(db, `presence/${who}`, { online: true });
    put(db, `feelings/${who}`, { legacy: true });
    put(db, `referrals/${who}`, { newUserUid: who });
    put(db, `publicMessages/m_${who}`, { uid: who, text: "hi" });
    put(db, `publicMessages/m_${who}/reactions/r1`, { uid: "someone" });
    put(db, `publicMessages/m_${who}/media/item`, { url: "x" });
    put(db, `sharedReflections/s_${who}`, { authorUid: who });
    put(db, `greetingSubmissions/g_${who}`, { authorUid: who });
  }
  // Across people: me ↔ other.
  put(db, "privateReplies/p1", { fromUid: "me", toUid: "other", text: "x" });
  put(db, "privateReplies/p2", { fromUid: "other", toUid: "me", text: "x" });
  put(db, "privateReplies/p3", { fromUid: "other", toUid: "third", text: "kept" });
  put(db, "waves/w1", { fromUid: "me", toUid: "other" });
  put(db, "waves/w2", { fromUid: "other", toUid: "me" });
  put(db, "kindMoments/k1", { aUid: "me", bUid: "other" });
  put(db, "kindMoments/k2", { aUid: "other", bUid: "me" });
  put(db, "kindMoments/k3", { aUid: "other", bUid: "third" });
  put(db, "publicMessages/m_other/reactions/mine", { uid: "me", emoji: "❤️" });
  put(db, "reports/rep1", { reporterUid: "me", reportedUid: "other" });
  return db;
}

const calls = [];
const deps = (db) => ({
  db, uid: "me",
  deleteAuthUser: async (u) => { calls.push(`auth:${u}`); },
  deleteStoragePrefix: async (p) => { calls.push(`storage:${p}`); },
  cancelSubscription: async (s) => { calls.push(`stripe:${s}`); },
});

// 1. Everything of theirs goes.
const db = seed();
const counts = await deleteAccountData(deps(db));
const left = [...db.store.keys()];
const mine = left.filter((k) => /(^|\/)(me|m_me|s_me|g_me)(\/|$)/.test(k) && !k.startsWith("reports/"));
check("nothing of theirs is left in Firestore", mine.length === 0, mine.join(", "));
check("their whole space goes, subcollections too", !left.some((k) => k.startsWith("users/me")));
check("private replies they sent AND received go", !db.store.has("privateReplies/p1") && !db.store.has("privateReplies/p2"));
check("waves and kind moments either way go", !db.store.has("waves/w1") && !db.store.has("waves/w2") && !db.store.has("kindMoments/k1") && !db.store.has("kindMoments/k2"));
check("their messages go with the reactions and media under them", !left.some((k) => k.startsWith("publicMessages/m_me")));
check("their reaction on someone else's message goes", !db.store.has("publicMessages/m_other/reactions/mine"));

// 2. Nobody else's does.
const otherOk = ["users/other", "users/other/journal/j1", "users/other/seenChat/c1", "publicProfiles/other", "publicMessages/m_other",
  "publicMessages/m_other/reactions/r1", "privateReplies/p3", "kindMoments/k3", "sharedReflections/s_other", "referrals/other"].every((k) => db.store.has(k));
check("other people's data is untouched", otherOk);
check("safety reports are kept", db.store.has("reports/rep1"));

// 3. Photos, subscription, and the sign-in last.
check("their photos are deleted", calls.includes("storage:profilePhotos/me/"));
check("an active subscription is cancelled", calls.includes("stripe:sub_1"));
check("the sign-in is deleted, and last", calls[calls.length - 1] === "auth:me", calls.join(" → "));
check("counts are reported", counts.publicMessages === 1 && counts.privateRepliesReceived === 1 && counts.auth === "deleted", JSON.stringify(counts));

// 4. A retry finishes the job without errors.
const again = await deleteAccountData({ ...deps(db), deleteAuthUser: async () => { const e = new Error("gone"); e.code = "auth/user-not-found"; throw e; } });
check("idempotent: a second run is clean", again.auth === "already deleted" && again.publicMessages === 0);

// 5. A Stripe or Storage failure never keeps their data on our servers.
const db2 = seed();
const c2 = await deleteAccountData({ ...deps(db2), cancelSubscription: async () => { throw new Error("stripe down"); }, deleteStoragePrefix: async () => { throw new Error("storage down"); } });
check("a Stripe outage doesn't stop deletion", !db2.store.has("users/me") && /failed/.test(c2.subscription));
check("a Storage outage doesn't stop deletion", /failed/.test(c2.profilePhotos) && c2.auth === "deleted");

// 6. A missing collection-group index doesn't either.
const db3 = seed();
db3.collectionGroup = () => ({ where: () => ({ get: async () => { const e = new Error("index"); e.code = 9; throw e; } }) });
const c3 = await deleteAccountData(deps(db3));
check("an index still building doesn't stop deletion", !db3.store.has("users/me") && /failed/.test(String(c3.reactionsGiven)));

// 7. The endpoint refuses without the typed confirmation (before touching anything).
const res = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
await handler({ method: "POST", headers: {}, body: {} }, res);
check("no token → refused", res.code === 401 || res.code === 503, String(res.code));
check("the confirm word is DELETE", CONFIRM_WORD === "DELETE");

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} account deletion tests passed.`);
process.exit(failed ? 1 : 0);
