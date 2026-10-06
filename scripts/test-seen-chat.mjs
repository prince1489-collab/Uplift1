// test-seen-chat.mjs — Seen asks ONE question at a time, even when two parts of the app ask at
// once (the 3.15 double), and the duplicates already out there get cleaned up.
import { planQuestion, duplicateQuestionIds, questionIdFor, slotOf } from "../src/seenChat.js";
import { ANSWER_GAP_HOURS } from "../src/seenAsks.js";
const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);
const NOW = Date.parse("2026-10-06T12:25:00Z"), H = 3600000;

// A Firestore that behaves like the rules: a document can be created once; a different second
// version of it is refused.
const store = new Map();
const setDoc = (id, data) => {
  if (store.has(id) && JSON.stringify(store.get(id)) !== JSON.stringify(data)) return false;
  store.set(id, data); return true;
};

// The race from the recording: the app turns Seen on and asks the first question, while the
// Messages tab and the conversation both see a chat that hasn't caught up (only the hello).
const intro = { id: "i", role: "seen", kind: "intro", text: "Hi, I'm Seen.", createdAt: NOW };
const staleChat = [intro];
const enable = { id: questionIdFor(NOW), data: { role: "seen", kind: "question", qid: "recharge", text: "What helps you recharge when you get the chance?", createdAt: NOW + 1, read: false } };
setDoc(enable.id, enable.data);
const a = planQuestion({ uid: "u", chat: staleChat, now: NOW + 50 });
const b = planQuestion({ uid: "u", chat: staleChat, now: NOW + 80 });
if (a) setDoc(a.id, a.data);
if (b) setDoc(b.id, b.data);
const questions = [...store.values()].filter((d) => d.kind === "question");
check("enable + two stale callers → exactly one question", questions.length === 1, questions.length);
check("every caller in the same slot targets the same document", a?.id === enable.id && b?.id === enable.id);

// The in-session guard stops a caller before it even tries.
check("the slot already asked this session is not asked again", planQuestion({ uid: "u", chat: staleChat, now: NOW, lastSlot: slotOf(NOW) }) === null);
// Once the chat has caught up, nothing is due.
check("no new question while the last is recent", planQuestion({ uid: "u", chat: [intro, { id: enable.id, ...enable.data }], now: NOW + 3 * H }) === null);
// The next slot gets a new question, with a new id.
const later = NOW + (ANSWER_GAP_HOURS + 1) * H;
const next = planQuestion({ uid: "u", chat: [intro, { id: enable.id, ...enable.data }], now: later });
check("about twice a week, a new question", Boolean(next) && next.id !== enable.id);

// Cleaning up the doubles already in people's conversations.
const doubled = [intro,
  { id: "q1", role: "seen", kind: "question", text: "What helps you recharge when you get the chance?" },
  { id: "q2", role: "seen", kind: "question", text: "What helps you recharge when you get the chance?" }];
check("the later duplicate is found", duplicateQuestionIds(doubled).join() === "q2");
const answered = [intro, doubled[1], { id: "a", role: "me", kind: "answer", text: "walks" }, { id: "q3", role: "seen", kind: "question", text: "What helps you recharge when you get the chance?" }];
check("a question asked again after an answer is not a duplicate", duplicateQuestionIds(answered).length === 0);
check("different questions are left alone", duplicateQuestionIds([doubled[1], { id: "q4", role: "seen", kind: "question", text: "What's on your mind?" }]).length === 0);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} Seen chat tests passed.`);
process.exit(failed ? 1 : 0);
