// test-wellbeing-sweep.mjs — saved wellbeing scores are deleted (3.31).
//   node scripts/test-wellbeing-sweep.mjs

import { sweepWellbeing } from "../src/wellbeingSweep.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);

// A fake Firestore: records what would be written and deleted.
function fakeFs(savedIds = []) {
  const log = { updates: [], deletes: [], commits: 0 };
  const DEL = Symbol("deleteField");
  const fs = {
    doc: (_db, ...path) => ({ path: path.join("/") }),
    collection: (_db, ...path) => ({ path: path.join("/") }),
    deleteField: () => DEL,
    updateDoc: async (ref, data) => { log.updates.push({ path: ref.path, keys: Object.keys(data), allDeletes: Object.values(data).every((v) => v === DEL) }); },
    getDocs: async (ref) => ({ docs: savedIds.map((id) => ({ ref: { path: `${ref.path}/${id}` } })) }),
    writeBatch: () => ({ delete: (ref) => log.deletes.push(ref.path), commit: async () => { log.commits += 1; } }),
  };
  return { fs, log };
}

{
  const { fs, log } = fakeFs(["a1", "a2"]);
  const r = await sweepWellbeing({}, "u1", { wellbeing: { calm: 3 }, wellbeingAt: 123 }, fs);
  check("saved check-ins are deleted", r.deleted === 2 && log.deletes.join() === "users/u1/wellbeing/a1,users/u1/wellbeing/a2", JSON.stringify(log));
  check("…and the profile's scores and date are removed", r.fields && log.updates.length === 1 && log.updates[0].path === "users/u1"
    && log.updates[0].keys.join() === "wellbeing,wellbeingAt" && log.updates[0].allDeletes, JSON.stringify(log.updates));
}
{
  const { fs, log } = fakeFs([]);
  const r = await sweepWellbeing({}, "u1", { fullName: "A" }, fs);
  check("nothing saved: no writes at all", r.deleted === 0 && !r.fields && log.updates.length === 0 && log.commits === 0, JSON.stringify(log));
}
{
  const { fs, log } = fakeFs(Array.from({ length: 450 }, (_, i) => `x${i}`));
  const r = await sweepWellbeing({}, "u1", {}, fs);
  check("a long history is deleted in batches of 400", r.deleted === 450 && log.commits === 2, JSON.stringify({ deleted: r.deleted, commits: log.commits }));
}
{
  const { fs, log } = fakeFs(["a1"]);
  const r = await sweepWellbeing({}, null, { wellbeing: {} }, fs);
  check("no account, nothing happens", r.deleted === 0 && log.updates.length === 0 && log.deletes.length === 0);
}

let failed = 0;
for (const [ok, line] of results) { console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} wellbeing-sweep tests passed.`);
process.exit(failed ? 1 : 0);
