// test-understand-api.mjs — /api/understand end to end, with an in-memory Firestore and a
// scripted model. Proves the server keeps the promises in _seen.js when it is actually wired up.
import { handle } from "../api/understand.js";
const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);
const DAY = 86400000, NOW = Date.parse("2026-10-06T12:00:00Z");

// ── A tiny Firestore ──
function fakeDb() {
  const store = new Map(); let auto = 0;
  const coll = (path) => ({
    doc: (id) => docRef(`${path}/${id ?? `auto${++auto}`}`),
    add: async (data) => { const id = `auto${++auto}`; store.set(`${path}/${id}`, { ...data }); return docRef(`${path}/${id}`); },
    orderBy: (field, dir = "asc") => ({ limit: (n) => ({ get: async () => {
      const docs = [...store.entries()].filter(([k]) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes("/"))
        .map(([k, v]) => ({ id: k.split("/").pop(), data: () => v }))
        .sort((a, b) => (Number(a.data()[field]) - Number(b.data()[field])) * (dir === "desc" ? -1 : 1)).slice(0, n);
      return { docs };
    } }) }),
  });
  const docRef = (path) => ({
    path, collection: (n) => coll(`${path}/${n}`),
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    set: async (data, opt) => store.set(path, opt?.merge ? { ...(store.get(path) || {}), ...data } : { ...data }),
  });
  return { collection: (n) => coll(n), store };
}
const chatOf = (db, uid = "u1") => [...db.store.entries()].filter(([k]) => k.startsWith(`users/${uid}/seenChat/`)).map(([, v]) => v).sort((a, b) => a.createdAt - b.createdAt);
const stateOf = (db, uid = "u1") => db.store.get(`users/${uid}/understanding/state`) || {};
const put = (db, path, data) => db.store.set(path, data);

function setup({ consent = true } = {}) {
  const db = fakeDb();
  put(db, "users/u1", { name: "Alex Doe", timezone: "Europe/London", seenAI: { consent }, activeDates: ["2026-10-05", "2026-10-04"], whosNext: { name: "Sam", day: "2026-10-05" } });
  put(db, "users/u1/feelings/f1", { feelings: ["proud"], route: "act", sentence: "I feel proud because I nearly didn't do it.", createdAt: NOW - DAY });
  return db;
}
const say = (db, id, msg) => put(db, `users/u1/seenChat/${id}`, { read: true, ...msg });

// 1. Off unless they said yes.
{
  const db = setup({ consent: false });
  say(db, "m1", { role: "me", kind: "ask", text: "hello", createdAt: NOW - 1000 });
  const r = await handle({ mode: "reply" }, { db, uid: "u1", ai: async () => "hi", now: NOW });
  check("nothing happens without consent", r.status === 403 && chatOf(db).length === 1);
}

// 2. A normal answer gets one specific reply.
{
  const db = setup(); let calls = 0;
  say(db, "q1", { role: "seen", kind: "question", text: "What's been keeping you busy lately?", createdAt: NOW - 3000 });
  say(db, "a1", { role: "me", kind: "answer", text: "Training for my first 10k", createdAt: NOW - 2000 });
  const r = await handle({ mode: "reply" }, { db, uid: "u1", ai: async ({ model, user }) => { calls++; return user.includes("10k") ? "Training for a first 10k is a big thing to take on. Thank you for telling me." : "?"; }, now: NOW });
  const last = chatOf(db).pop();
  check("an answer gets a reply", r.json.wrote === "reply" && last.role === "seen" && /10k/.test(last.text));
  check("one model call per reply", calls === 1);
  check("the reply count is kept", stateOf(db).replies?.n === 1);
}

// 3. A reply that breaks the rules is replaced, not shown.
{
  const db = setup();
  say(db, "a1", { role: "me", kind: "ask", text: "what do you think?", createdAt: NOW - 2000 });
  await handle({ mode: "reply" }, { db, uid: "u1", ai: async () => "You should take a break and see a therapist.", now: NOW });
  check("an instructing reply never reaches the person", /Thank you for telling me/.test(chatOf(db).pop().text));
}

// 4. Difficulty: no model at all, a kind line and support.
{
  const db = setup(); let calls = 0;
  say(db, "a1", { role: "me", kind: "answer", text: "honestly some days I want to die", createdAt: NOW - 2000 });
  const r = await handle({ mode: "reply" }, { db, uid: "u1", ai: async () => { calls++; return "x"; }, now: NOW });
  const last = chatOf(db).pop();
  check("crisis words → support message", r.json.wrote === "support" && last.kind === "support" && /crisis line|emergency/.test(last.text));
  check("…and the model is never called", calls === 0);
  // And no reflection for a few days afterwards.
  say(db, "a2", { role: "me", kind: "answer", text: "x", createdAt: NOW - 1000 });
  const rr = await handle({ mode: "reflect" }, { db, uid: "u1", ai: async () => { calls++; return "{}"; }, now: NOW + DAY });
  check("no analysis in the days after", rr.json.skipped === "care" || rr.json.skipped === "not_due", JSON.stringify(rr.json));
}

// 5. The daily cap, said once.
{
  const db = setup();
  put(db, "users/u1/understanding/state", { replies: { day: "2026-10-06", n: 5 } });
  say(db, "a1", { role: "me", kind: "ask", text: "one more thing", createdAt: NOW - 2000 });
  const r1 = await handle({ mode: "reply" }, { db, uid: "u1", ai: async () => "x", now: NOW });
  say(db, "a2", { role: "me", kind: "ask", text: "and another", createdAt: NOW + 1000 });
  const r2 = await handle({ mode: "reply" }, { db, uid: "u1", ai: async () => "x", now: NOW + 2000 });
  const said = chatOf(db).filter((m) => m.role === "seen");
  check("over the cap: one goodnight line, then quiet", r1.json.skipped === "daily_limit" && r2.json.skipped === "daily_limit" && said.length === 1 && /tomorrow/.test(said[0].text));
}

// 6. Reflection: only well-evidenced ones are written, with evidence labels and the Sam nudge.
{
  const db = setup();
  say(db, "q1", { role: "seen", kind: "question", text: "What's been keeping you busy lately?", createdAt: NOW - 3 * DAY });
  say(db, "a1", { role: "me", kind: "answer", text: "Training for my first 10k and work is full on", createdAt: NOW - 3 * DAY + 1 });
  say(db, "q2", { role: "seen", kind: "question", text: "Who's been on your side lately?", createdAt: NOW - DAY });
  say(db, "a2", { role: "me", kind: "answer", text: "My sister, every morning", createdAt: NOW - DAY + 1 });
  const model = JSON.stringify({ safety: "ok", followUp: "How is the 10k training going?", themes: ["running"],
    reflections: [
      { theme: "running", text: "You've mentioned training for your first 10k, and you felt proud after showing up anyway.", evidence: ["A1", "F1"] },
      { theme: "kindness", text: "You are a wonderfully kind person.", evidence: ["A2", "S1"] },
    ] });
  const r = await handle({ mode: "reflect" }, { db, uid: "u1", ai: async () => model, now: NOW });
  const msgs = chatOf(db).filter((m) => m.role === "seen" && m.kind !== "question");
  const refl = msgs.filter((m) => m.kind === "reflection");
  check("only the well-evidenced observation is written", r.json.wrote === 1 && refl.length === 1 && /10k/.test(refl[0].text));
  check("its evidence is shown in plain words", refl[0].evidence.some((e) => /You said on/.test(e.label)) && refl[0].evidence.some((e) => /You felt proud/.test(e.label)));
  check("a nudge towards Sam follows", msgs.some((m) => m.kind === "nudge" && m.name === "Sam"));
  check("the follow-up question is remembered", stateOf(db).followUp?.q === "How is the 10k training going?");
  check("the living themes are stored", stateOf(db).themes?.some((t) => t.name === "running"));
  const again = await handle({ mode: "reflect" }, { db, uid: "u1", ai: async () => model, now: NOW + DAY });
  check("not again the next day", again.json.skipped === "not_due");
}

// 7. Feedback is honoured on the next run.
{
  const db = setup();
  put(db, "users/u1/understanding/state", { lastReflect: NOW - 8 * DAY, themes: [{ name: "running", strength: 1, lastSeen: NOW - 8 * DAY, firstSeen: NOW - 8 * DAY }] });
  say(db, "r0", { role: "seen", kind: "reflection", theme: "running", text: "…", feedback: "forget", createdAt: NOW - 8 * DAY });
  say(db, "a1", { role: "me", kind: "answer", text: "Busy with my new job", createdAt: NOW - 2 * DAY });
  say(db, "a2", { role: "me", kind: "answer", text: "Learning the ropes", createdAt: NOW - DAY });
  await handle({ mode: "reflect" }, { db, uid: "u1", ai: async () => JSON.stringify({ safety: "ok", reflections: [], themes: ["new job"] }), now: NOW });
  const themes = stateOf(db).themes.map((t) => t.name);
  check("'Forget this' removed the theme", !themes.includes("running") && themes.includes("new job"), themes.join());
}

// 8. A model that's down never breaks anything.
{
  const db = setup();
  say(db, "a1", { role: "me", kind: "ask", text: "hi Seen", createdAt: NOW - 1000 });
  const r = await handle({ mode: "reply" }, { db, uid: "u1", ai: async () => { throw new Error("overloaded"); }, now: NOW });
  check("if the model is down, a kind fallback is written", r.json.fallback === true && chatOf(db).pop().role === "seen");
}

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} Seen API tests passed.`);
process.exit(failed ? 1 : 0);
