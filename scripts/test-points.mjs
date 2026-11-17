// test-points.mjs — a tree can never be shrunk by an empty device (3.29.1).
//
// The founder's tree went from 57,330 drops to about 4,500: after a reinstall (and 3.27's
// clearing of another account's data), the day's first award was mirrored as an absolute 0 + 50
// over the account's total before the sync had read it.
//
//   node scripts/test-points.mjs

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = { dispatchEvent: () => true };
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
const { syncPoints, awardPoints, getPoints } = await import("../src/points.js");

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);

// A stand-in for the account: reads take a moment; writes only ever raise (like the transaction).
function account(total, { failRead = false } = {}) {
  const acc = { total, writes: [] };
  acc.io = {
    read: () => new Promise((res, rej) => setTimeout(() => (failRead ? rej(new Error("offline")) : res(acc.total)), 20)),
    raise: async (_db, _uid, t) => { acc.writes.push(t); if (t > acc.total) acc.total = t; },
  };
  return acc;
}
const DB = {};

// 1. The reinstall: an empty device, an account holding 57,330.
store.clear();
let acc = account(57330);
const syncing = syncPoints(DB, "me", acc.io);
awardPoints("dailyOpen", { oncePerDay: true, io: acc.io });   // the start-up award, during the read
check("an award while the sync is still reading writes nothing to the account", acc.writes.length === 0, JSON.stringify(acc.writes));
await syncing;
check("the account keeps its 57,330", acc.total === 57330, String(acc.total));
check("…and the device gets it back", getPoints() === 57330, String(getPoints()));

// 2. After the sync, awards go up from there.
awardPoints("send", { io: acc.io });
check("the next award raises the account from the real total", acc.total === 57430 && getPoints() === 57430, `${acc.total} / ${getPoints()}`);

// 3. Nothing smaller is ever sent, whatever happens to the device.
store.set("seen_v2_points", "10");                             // the device's ledger is emptied
awardPoints("like", { io: acc.io });
check("a device with an emptied ledger can't send a smaller total", acc.total === 57430 && acc.writes.every((w) => w >= 57330), JSON.stringify(acc.writes));

// 4. Offline at sign-in: nothing is written until a sync has read the account.
store.clear();
acc = account(57330, { failRead: true });
await syncPoints(DB, "me", acc.io);
awardPoints("send", { io: acc.io });
check("if the account can't be read, nothing is written to it", acc.writes.length === 0 && acc.total === 57330);

// 5. A new account: the device's points become the account's.
store.clear(); store.set("seen_v2_points", "300");
acc = account(0);
await syncPoints(DB, "new", acc.io);
check("a device ahead of the account raises the account", acc.total === 300);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} tree-points tests passed.`);
process.exit(failed ? 1 : 0);
