// test-kind-feel.mjs — the kindness log's entries and lines, and Seen's "How did that feel?" (3.29).
//
//   node scripts/test-kind-feel.mjs

import { kindEntry, kindLine, ROUTES } from "../src/kindLog.js";
import { kindFeelQuestion, kindFeelText, whenLabel, kindFeelEntryId, FEEL_OPTIONS, KIND_FEEL_GAP_MS } from "../src/kindFeel.js";
import { planQuestion, questionIdFor } from "../src/seenChat.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);
const DAY = 86400000;
const NOW = new Date(2026, 10, 19, 18, 0).getTime(); // Thursday 19 Nov 2026, 6pm local
const tue = new Date(2026, 10, 17, 9, 0).getTime();

// ── Entries ──
const e = kindEntry({ route: "sent", text: "  Someone in the world   is rooting for you ", at: tue });
check("an entry keeps the kind, time, local day and tidy words", e.route === "sent" && e.at === tue && e.day === "2026-11-17" && e.text === "Someone in the world is rooting for you");
check("words and names are clipped to what the rules allow", kindEntry({ route: "reply", text: "x".repeat(400), toName: "y".repeat(80) }).text.length === 240 && kindEntry({ route: "reply", toName: "y".repeat(80) }).toName.length === 40);
check("empty fields aren't written", !("text" in kindEntry({ route: "act" })) && !("toName" in kindEntry({ route: "act", toName: "  " })));
check("an unknown kind of act isn't logged", kindEntry({ route: "spam" }) === null && ROUTES.size === 5);

// ── Lines (Grow's "This week", and Seen's evidence labels) ──
check("a delivered message says where", kindLine({ route: "sent", delivered: true, country: "United Kingdom" }) === "Your words reached someone in the United Kingdom");
check("…an undelivered one doesn't pretend", kindLine({ route: "sent" }) === "You sent kind words to someone in the world");
check("replies and notes name the person", kindLine({ route: "reply", toName: "Mona" }) === "You told Mona how their words landed" && kindLine({ route: "note", toName: "Vidhi" }) === "You sent Vidhi a kind note");
check("a real-life act says what it was", kindLine({ route: "act", text: "Thank someone who's just doing their job." }) === "In real life: thank someone who's just doing their job");

// ── When ──
check("today / yesterday / a weekday", whenLabel(NOW - 3600000, NOW) === "Today" && whenLabel(NOW - DAY, NOW) === "Yesterday" && whenLabel(tue, NOW) === "On Tuesday");

// ── The question ──
const log = [
  { id: "heart_m9", route: "heart", at: NOW - 3600000 },
  { id: "sent_m1", route: "sent", at: tue, delivered: true, country: "Algeria" },
  { id: "reply_r1", route: "reply", toName: "Mona", at: tue - DAY },
  { id: "old", route: "act", text: "Smile at someone", at: NOW - 10 * DAY },
];
const q = kindFeelQuestion({ entries: log, chat: [], now: NOW });
check("asks about the newest act worth asking about — not a heart", q?.entryId === "sent_m1", JSON.stringify(q));
check("…in plain words, about that act", q?.q === "On Tuesday, your words reached someone in Algeria. How did sending them feel?", q?.q);
check("…with five one-tap answers", JSON.stringify(q?.options) === JSON.stringify(FEEL_OPTIONS) && FEEL_OPTIONS.length === 5);
check("…and an id that leads back to the act", kindFeelEntryId(q?.id) === "sent_m1" && kindFeelEntryId("busy") === null);
const askedChat = [{ role: "seen", kind: "question", qid: "kindfeel:sent_m1", createdAt: NOW - 2 * DAY }];
check("at most once a week", kindFeelQuestion({ entries: log, chat: askedChat, now: NOW }) === null);
const later = NOW + KIND_FEEL_GAP_MS;
const log2 = [...log, { id: "note_x", route: "note", toName: "Vidhi", at: later - DAY }];
const q2 = kindFeelQuestion({ entries: log2, chat: askedChat, now: later });
check("a week on, a different act — never the same one twice", q2?.entryId === "note_x", JSON.stringify(q2));
check("an act already given a feeling isn't asked about", kindFeelQuestion({ entries: [{ id: "a", route: "act", at: NOW - DAY, feeling: "Warm" }], chat: [], now: NOW }) === null);
check("nothing in the last week, nothing asked", kindFeelQuestion({ entries: [log[3]], chat: [], now: NOW }) === null);
check("every kind of act reads as a question", ["sent", "reply", "note", "act"].every((route) => /\?$/.test(kindFeelText({ route, at: tue, toName: "Sam", text: "Hold a door." }, NOW))));

// ── In Seen's schedule ──
const chat = [{ id: "q-old", role: "seen", kind: "question", qid: "busy", text: "What's keeping you busy?", createdAt: NOW - 4 * DAY }, { id: "a1", role: "me", kind: "answer", text: "Work", createdAt: NOW - 4 * DAY + 1000 }];
const plan = planQuestion({ uid: "u1", chat, state: {}, now: NOW, kindEntries: log });
check("when Seen is due to ask, this week's question is about an act", plan?.data?.qid === "kindfeel:sent_m1" && plan.id === questionIdFor(NOW) && plan.data.options?.length === 5, JSON.stringify(plan?.data));
const planF = planQuestion({ uid: "u1", chat, state: { followUp: { q: "How did the 10k go?", at: NOW - DAY } }, now: NOW, kindEntries: log });
check("…but the server's own follow-up comes first", planF?.data?.qid === "followup" && !("options" in planF.data), JSON.stringify(planF?.data));
const planN = planQuestion({ uid: "u1", chat, state: {}, now: NOW, kindEntries: [] });
check("…and with no acts, the usual question, with no options", planN?.data?.qid && !String(planN.data.qid).startsWith("kindfeel:") && !("options" in planN.data));
check("…and never before a question is due", planQuestion({ uid: "u1", chat: [{ id: "q", role: "seen", kind: "question", qid: "x", createdAt: NOW - DAY }], state: {}, now: NOW, kindEntries: log }) === null);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} kind-feel tests passed.`);
process.exit(failed ? 1 : 0);
