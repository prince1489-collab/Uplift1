// test-kindness.mjs — a message sent to "a stranger" lands on one real person, chosen fairly,
// never the wrong person, and never past the limits (3.21). Runs api/_kindness.js against an
// in-memory Firestore with the calls the Admin SDK version makes.
import {
  rankRecipients, deliverKindness, deliveryPush, dayKey,
  PER_RECIPIENT_PER_DAY, PER_SENDER_PER_DAY, MAX_AGE_MS,
} from "../api/_kindness.js";
import { TAKES_THE as SERVER_THE } from "../api/_kindness.js";
import { TAKES_THE as CLIENT_THE, inCountry } from "../src/countryName.js";
import handler from "../api/notify-reply.js";

const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);

// ── An in-memory Firestore (Admin SDK shape) ──────────────────────────────────────────────────
function fakeDb() {
  const store = new Map();
  const snap = (path) => ({ id: path.split("/").pop(), exists: store.has(path), data: () => store.get(path), ref: docRef(path) });
  const docRef = (path) => ({
    path, id: path.split("/").pop(),
    get: async () => snap(path),
    collection: (n) => coll(`${path}/${n}`),
  });
  const children = (path) => [...store.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes("/"));
  const coll = (path) => ({
    doc: (id) => docRef(`${path}/${id}`),
    get: async () => ({ docs: children(path).map(snap) }),
    where: (field, op, value) => ({
      limit: (n) => ({
        get: async () => ({
          docs: children(path).filter((k) => {
            const v = store.get(k)?.[field];
            return op === ">=" ? v >= value : v === value;
          }).slice(0, n).map(snap),
        }),
      }),
    }),
  });
  const write = (ref, data, merge) => store.set(ref.path, merge ? { ...(store.get(ref.path) || {}), ...data } : { ...data });
  return {
    store,
    collection: (n) => coll(n),
    getAll: async (...refs) => refs.map((r) => snap(r.path)),
    runTransaction: async (fn) => fn({
      get: async (ref) => snap(ref.path),
      set: (ref, data, opts) => write(ref, data, opts?.merge),
      update: (ref, data) => { if (!store.has(ref.path)) throw new Error("no document to update"); write(ref, data, true); },
    }),
  };
}

const NOW = Date.UTC(2026, 10, 16, 13, 0, 0);
const DAY = dayKey(NOW);
const person = (country, extra = {}) => ({ fullName: "A Person", country, onboardingCompletedAt: 1, ...extra });

function world() {
  const db = fakeDb();
  const put = (path, data) => db.store.set(path, data);
  put("users/me", person("United Kingdom"));
  put("presence/me", { lastSeen: NOW });
  put("publicMessages/m1", { uid: "me", sender: "Mahiman Rathore", country: "United Kingdom", text: "You are not alone 🤝", timestamp: NOW - 1000 });
  // Three other people: one at home, one abroad, one abroad with a phone to push to.
  for (const [id, country, extra] of [["uk1", "United Kingdom", {}], ["in1", "India", {}], ["ca1", "Canada", { fcmTokens: { d1: { token: "t", platform: "ios" } } }]]) {
    put(`users/${id}`, person(country, extra));
    put(`presence/${id}`, { lastSeen: NOW - 5 * 86400000 });
  }
  return { db, put };
}
const ok = async () => ({ ok: true });
const deliver = (db, extra = {}) => deliverKindness({ db, uid: "me", messageId: "m1", screen: ok, now: NOW, random: () => 0.5, ...extra });

// ── Choosing ─────────────────────────────────────────────────────────────────────────────────
{
  const base = { inToday: 0, reachable: true, followed: false, recent: false, blocked: false };
  const ranked = rankRecipients([
    { ...base, uid: "me" },
    { ...base, uid: "blocked", blocked: true },
    { ...base, uid: "full", inToday: PER_RECIPIENT_PER_DAY },
    { ...base, uid: "had-one", inToday: 1 },
    { ...base, uid: "mum", followed: true },
    { ...base, uid: "recent", recent: true },
    { ...base, uid: "quiet", reachable: false },
    { ...base, uid: "same", country: "UK" },
    { ...base, uid: "abroad", country: "India" },
  ], { senderUid: "me", senderCountry: "UK", random: () => 0.5 });
  const order = ranked.map((c) => c.uid);
  check("never the sender, never blocked, never past today's limit", !order.includes("me") && !order.includes("blocked") && !order.includes("full"), order.join());
  check("someone abroad who will see it comes first", order[0] === "abroad", order.join());
  check("then someone at home", order[1] === "same", order.join());
  check("someone who won't see it soon comes after those who will", order.indexOf("quiet") > order.indexOf("same"), order.join());
  check("someone reached recently comes after someone new", order.indexOf("recent") > order.indexOf("quiet"), order.join());
  check("someone the sender follows only when no stranger is left", order.indexOf("mum") > order.indexOf("recent"), order.join());
  check("someone who already had one today comes last", order.at(-1) === "had-one", order.join());
}

// ── Delivering ───────────────────────────────────────────────────────────────────────────────
{
  const { db } = world();
  const r = await deliver(db);
  check("a message lands on one real person", r.delivered === true && Boolean(r.toUid), JSON.stringify(r));
  check("…abroad and with a phone to hear it, ahead of someone at home", r.toUid === "ca1" && r.country === "Canada", JSON.stringify(r));
  const inbox = db.store.get("users/ca1/kindnessInbox/m1");
  check("it waits in their inbox, pointing at the message", inbox?.messageId === "m1" && inbox?.fromUid === "me" && inbox?.seen === false && inbox?.answered === false, JSON.stringify(inbox));
  check("the inbox holds a pointer, not a copy of the words", !("text" in (inbox || {})));
  check("the message records only the country it reached", JSON.stringify(db.store.get("publicMessages/m1").delivered) === JSON.stringify({ country: "Canada", at: NOW }));
  check("the recipient's day is counted", db.store.get("kindnessLedger/ca1")?.inCount === 1 && db.store.get("kindnessLedger/ca1")?.inDay === DAY);
  check("the sender's day is counted and the recipient remembered", db.store.get("kindnessLedger/me")?.outCount === 1 && db.store.get("kindnessLedger/me")?.recent?.[0] === "ca1");
  const again = await deliver(db);
  check("delivering twice is a no-op", again.already === true && again.country === "Canada" && db.store.get("kindnessLedger/ca1").inCount === 1, JSON.stringify(again));
}

{
  const { db } = world();
  let threw = null;
  try { await deliverKindness({ db, uid: "uk1", messageId: "m1", screen: ok, now: NOW }); } catch (e) { threw = e; }
  check("only the author can deliver their message", threw?.status === 403, String(threw?.status));
  threw = null;
  try { await deliverKindness({ db, uid: "me", messageId: "nope", screen: ok, now: NOW }); } catch (e) { threw = e; }
  check("a message that doesn't exist is refused", threw?.status === 404, String(threw?.status));
}

{
  const { db, put } = world();
  put("publicMessages/m1", { ...db.store.get("publicMessages/m1"), timestamp: NOW - MAX_AGE_MS - 1 });
  const r = await deliver(db);
  check("an old message is not delivered", r.delivered === false && r.reason === "too_old" && !db.store.has("users/ca1/kindnessInbox/m1"), JSON.stringify(r));
}

{
  const { db, put } = world();
  put("publicMessages/m1", { ...db.store.get("publicMessages/m1"), sender: "Anonymous", country: null });
  const r = await deliver(db);
  check("an anonymous post reaches the feed only, never an inbox", r.reason === "anonymous" && !db.store.has("users/ca1/kindnessInbox/m1"), JSON.stringify(r));
}

{
  const { db } = world();
  let screened = null;
  const r = await deliver(db, { screen: async (t) => { screened = t; return { ok: false }; } });
  check("every message is screened before it reaches anyone", screened === "You are not alone 🤝");
  check("…and one that fails reaches no inbox and no ledger", r.reason === "screened" && ![...db.store.keys()].some((k) => k.includes("kindnessInbox") || k.startsWith("kindnessLedger")), JSON.stringify(r));
}

{
  const { db, put } = world();
  put("kindnessLedger/me", { outDay: DAY, outCount: PER_SENDER_PER_DAY });
  const r = await deliver(db);
  check(`a sender's ${PER_SENDER_PER_DAY} deliveries a day are the limit`, r.reason === "daily_limit" && !db.store.has("users/ca1/kindnessInbox/m1"), JSON.stringify(r));
  put("kindnessLedger/me", { outDay: "2026-11-15", outCount: PER_SENDER_PER_DAY });
  check("…and it starts again the next day", (await deliver(db)).delivered === true);
}

{
  const { db, put } = world();
  put("kindnessLedger/ca1", { inDay: DAY, inCount: PER_RECIPIENT_PER_DAY });
  put("kindnessLedger/in1", { inDay: DAY, inCount: PER_RECIPIENT_PER_DAY });
  const r = await deliver(db);
  check("nobody receives more than their day's share", r.toUid === "uk1", JSON.stringify(r));
}

{
  const { db, put } = world();
  put("users/me/blockedUsers/ca1", { name: "x" });
  put("users/in1/blockedUsers/me", { name: "me" });
  const r = await deliver(db);
  check("blocked either way, never chosen", r.toUid === "uk1", JSON.stringify(r));
}

{
  const { db, put } = world();
  put("users/me/follows/ca1", { uid: "ca1" });
  put("users/me/follows/in1", { uid: "in1" });
  const r = await deliver(db);
  check("a stranger before someone the sender follows", r.toUid === "uk1", JSON.stringify(r));
}

{
  const { db, put } = world();
  put("users/ca1", { country: "Canada" }); // half-way through sign-up
  db.store.delete("users/in1");            // a presence row for an account that is gone
  const r = await deliver(db);
  check("only finished, existing accounts receive", r.toUid === "uk1", JSON.stringify(r));
}

{
  const { db } = world();
  for (const id of ["uk1", "in1", "ca1"]) db.store.delete(`presence/${id}`);
  const r = await deliver(db);
  check("with no one else around, it says so and writes nothing", r.delivered === false && r.reason === "no_one" && !db.store.has("kindnessLedger/me"), JSON.stringify(r));
}

{
  const { db, put } = world();
  put("presence/ca1", { lastSeen: NOW - 90 * 86400000 });
  put("presence/in1", { lastSeen: NOW - 90 * 86400000 });
  const r = await deliver(db);
  check("someone not seen for months is not chosen", r.toUid === "uk1", JSON.stringify(r));
}

// ── What the recipient is told ───────────────────────────────────────────────────────────────
check("the push names a first name and a country", deliveryPush({ sender: "Mahiman Rathore", country: "United Kingdom" }).body === "Mahiman in the United Kingdom sent you a few kind words.", deliveryPush({ sender: "Mahiman Rathore", country: "United Kingdom" }).body);
check("…and leaves most countries as they are", deliveryPush({ sender: "Vidhi", country: "India" }).body === "Vidhi in India sent you a few kind words.");
check("the server and the app agree on which countries take \"the\"",
  SERVER_THE.size === CLIENT_THE.size && [...SERVER_THE].every((c) => CLIENT_THE.has(c)) && inCountry("Netherlands") === "the Netherlands");
check("a sender with no country on file is \"a stranger\"", deliveryPush({ sender: "Sam", country: null }).body === "A stranger sent you a few kind words.");

// ── The route ────────────────────────────────────────────────────────────────────────────────
const res = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
await handler({ method: "POST", headers: {}, body: { messageId: "m1" } }, res);
check("no signed-in caller, no delivery", res.code === 401 || res.code === 503, String(res.code));

let failed = 0;
for (const [pass, n] of results) { console.log(`${pass ? "  ok  " : "  FAIL"}  ${n}`); if (!pass) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} kindness delivery tests passed.`);
process.exit(failed ? 1 : 0);
