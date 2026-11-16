// test-card-budget.mjs — at most one card a week after a kind act (3.22).
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
const { claimCard, cardFor, isQuietAct } = await import("../src/cardBudget.js");

const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);
const DAY = 86400000;
const t0 = Date.UTC(2026, 10, 16, 9);

check("the first act ever gets the Feel it card", claimCard("2026-11-16", 1, t0) === "feel");
check("…and it belongs to that act", cardFor("feel", "2026-11-16", 1) && !cardFor("feel", "2026-11-16", 2));
check("asking again for the same act is the same answer", claimCard("2026-11-16", 1, t0 + 1000) === "feel");
check("a second act the same day gets nothing — not even the question", claimCard("2026-11-16", 2, t0 + 3600000) === null);
check("the next day the question can come", claimCard("2026-11-17", 1, t0 + DAY) === "reflect");
check("…and then nothing else that week", claimCard("2026-11-18", 1, t0 + 2 * DAY) === null && claimCard("2026-11-21", 1, t0 + 5 * DAY) === null);
check("a week on, the Feel it card again", claimCard("2026-11-23", 1, t0 + 7 * DAY) === "feel");
check("and never both on one day", claimCard("2026-11-23", 2, t0 + 7 * DAY + 3600000) === null);

// 3.24 — after telling someone how their words landed, nothing more is asked. The day state is
// shaped the way hytState.markSentToday / completeSlot leave it.
check("telling someone how their words landed is followed by nothing", isQuietAct({ lastAct: { route: "reply", name: "Mona" } }));
check("…nor is a kind note to someone you follow", isQuietAct({ lastAct: { route: "note", name: "Vidhi" } }));
check("a message to a stranger can still get the week's card", !isQuietAct({ lastAct: { route: "sent" } }));
// 3.25 — "Done it" on something done in real life is one warm line and nothing to fill in.
check("something done in real life is followed by nothing", isQuietAct({ lastAct: { route: "act", name: null } }));
check("…nor is someone you named yesterday", isQuietAct({ lastAct: { route: "act", name: "Sam" } }));
check("a day saved before acts had a route is not quiet", !isQuietAct({ sent: true }) && !isQuietAct(null));

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} card budget tests passed.`);
process.exit(failed ? 1 : 0);
