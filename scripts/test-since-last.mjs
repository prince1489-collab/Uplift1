// test-since-last.mjs — "Since you were last here" (3.32).
//   node scripts/test-since-last.mjs

import { sinceLastItems, sinceWindow, SINCE_FIRST_MS, SINCE_MAX_MS } from "../src/sinceLast.js";
import { heartPushDue, HEART_PUSH_GAP_MS } from "../api/notify-like.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);
const NOW = Date.parse("2026-11-18T12:00:00Z");
const H = 3600000;
const J = JSON.stringify;

// ── The window ──────────────────────────────────────────────────────────────────────────────
check("first visit on this device: the last three days", sinceWindow(0, NOW) === NOW - SINCE_FIRST_MS);
check("since the last visit", sinceWindow(NOW - 5 * H, NOW) === NOW - 5 * H);
check("never more than a week back", sinceWindow(NOW - 30 * 24 * H, NOW) === NOW - SINCE_MAX_MS);
check("a marker from the future (clock change) counts as none", sinceWindow(NOW + H, NOW) === NOW - SINCE_FIRST_MS);

// ── The lines ───────────────────────────────────────────────────────────────────────────────
const since = NOW - 10 * H;
const items = sinceLastItems({
  since, myUid: "me",
  replies: [
    { id: "r1", fromUid: "mona", fromName: "Mona Patel", text: "needed this today, thank you", messageId: "m1", ts: NOW - 2 * H },
    { id: "r2", fromUid: "sam", fromName: "Sam", text: "Thinking of you", messageId: null, ts: NOW - 3 * H },
    { id: "r0", fromUid: "old", fromName: "Old", text: "before", messageId: "m0", ts: NOW - 20 * H },
  ],
  hearts: [
    { reactorUid: "v", reactorName: "Vidhi Shah", reactedAt: NOW - H },
    { reactorUid: "r", reactorName: "Ravi", reactedAt: NOW - 4 * H },
    { reactorUid: "me", reactorName: "Me", reactedAt: NOW - H },
    { reactorUid: "x", reactorName: "Early", reactedAt: NOW - 30 * H },
  ],
  acts: [
    { route: "sent", delivered: true, country: "Kenya", at: NOW - 5 * H },
    { route: "sent", delivered: true, country: "United Kingdom", at: NOW - 6 * H },
    { route: "sent", delivered: false, at: NOW - 6 * H },
    { route: "act", text: "x", at: NOW - H },
  ],
  kindness: [{ id: "k1", fromName: "Priya", fromCountry: "India", deliveredAt: NOW - 7 * H, message: { text: "hi" } }],
  updates: [{ id: "u-week-2026-11-16", kind: "update", read: false, text: "Your week 🌱\n…", createdAt: NOW - 8 * H }],
});
const texts = items.map((i) => i.text);
check("at most five lines, newest first", items.length === 5 && items.every((x, i) => i === 0 || items[i - 1].at >= x.at), J(texts));
check("hearts are one line, with names, not counting your own", texts[0] === "Vidhi and Ravi felt your words", texts[0]);
check("a reply quotes their words and opens the conversation", texts.includes("Mona wrote back: “needed this today, thank you”") && items.find((i) => i.key === "r-r1").action.uid === "mona", J(texts));
check("a kind note says so", texts.includes("Sam sent you a kind note: “Thinking of you”"), J(texts));
check("where your words reached, every country in one line", texts.includes("Your words reached people in Kenya and the United Kingdom"), J(texts));
check("a stranger's delivered words", texts.includes("Priya in India sent you a few kind words"), J(texts));
check("nothing from before your last visit", !texts.some((t) => /Old|Early|before/.test(t)));

const six = sinceLastItems({ since, myUid: "me", max: 10, updates: [{ id: "u-week-2026-11-16", kind: "update", read: false, text: "Your week 🌱", createdAt: NOW - 8 * H }] });
check("Seen's weekly update reads as news", six[0]?.text === "Your week in Seen is ready" && six[0].action.type === "seen", J(six));
const readUpdate = sinceLastItems({ since, updates: [{ id: "u-stage-3", kind: "update", read: true, text: "x", createdAt: NOW - H }] });
check("an update already read isn't news", readUpdate.length === 0);

check("a quiet day is quiet: no lines, nothing invented", sinceLastItems({ since: NOW - H, myUid: "me" }).length === 0);
const many = sinceLastItems({ since, hearts: ["A", "B", "C", "D", "E"].map((n, i) => ({ reactorUid: n, reactorName: n, reactedAt: NOW - i * 60000 })) });
check("many hearts: two names and the rest counted", many[0].text === "A, B and 3 others felt your words", many[0]?.text);
const ts = sinceLastItems({ since, replies: [{ id: "t", fromUid: "a", fromName: "Ann", text: "x".repeat(200), messageId: "m", ts: { toMillis: () => NOW - H } }] });
check("long words are clipped, and Firestore timestamps work", ts.length === 1 && ts[0].text.length < 100 && ts[0].text.endsWith("…”"), ts[0]?.text);

// ── Heart notifications are batched (3.32) ──────────────────────────────────────────────────
check("the first heart's push goes", heartPushDue(undefined, NOW) && heartPushDue(0, NOW));
check("another within three hours waits", !heartPushDue(NOW - HEART_PUSH_GAP_MS + 60000, NOW));
check("…and goes once three hours have passed", heartPushDue(NOW - HEART_PUSH_GAP_MS, NOW));

let failed = 0;
for (const [ok, line] of results) { console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} since-last tests passed.`);
process.exit(failed ? 1 : 0);
