// test-conversations.mjs — grouping private replies into people and threads.
import { buildConversations, nextStep } from "../src/conversations.js";
const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);
const ME = "me", M = "mateo";
const msg = (id, from, to, ts, extra = {}) => ({ id, fromUid: from, toUid: to, ts, fromName: from === M ? "Mateo" : "Mahiman", text: id, read: true, ...extra });
const sent = [
  msg("X", ME, M, 100, { messageId: "post1", messageText: "October is for cozy moments" }),
  msg("Y", ME, M, 300, { messageId: "post2", messageText: "Be kind today" }),
  msg("X__final", ME, M, 250, { inReplyTo: "X", final: true }),
];
const received = [
  msg("X__reply", M, ME, 200, { inReplyTo: "X", read: false }),
  msg("Z", M, ME, 400, { messageId: null, messageText: "" }),
  msg("B1", "blocked", ME, 500, { messageId: "p" }),
];
const c = buildConversations(received, sent, ME, new Set(["blocked"]));
check("one conversation per person, blocked people hidden", c.length === 1 && c[0].uid === M, JSON.stringify(c.map((x) => x.uid)));
const p = c[0];
check("three threads with Mateo", p.threads.length === 3, p.threads.length);
check("threads ordered by latest activity", p.threads.map((t) => t.id).join() === "X,Y,Z", p.threads.map((t) => t.id).join());
check("X holds reply, answer and last word in order", p.threads[0].messages.map((m) => m.id).join() === "X,X__reply,X__final");
check("X is complete", p.threads[0].complete === true);
check("X quotes Mateo's post", p.threads[0].postText.startsWith("October") && p.threads[0].postByMe === false);
check("Z is a kind note", p.threads[2].isNote === true);
check("unread counts Mateo's unread answer", p.unread === 1, p.unread);
check("the name comes from his messages", p.name === "Mateo", p.name);
check("latest line is the newest message", p.last.id === "Z", p.last.id);
check("no next step on a finished thread", nextStep(p.threads[0], ME) === null);
check("on my unanswered reply, I wait", nextStep(p.threads[1], ME) === null);
check("on Mateo's note, I may answer", nextStep(p.threads[2], ME)?.mode === "answer");
const t2 = { id: "Q", messages: [msg("Q", ME, M, 1, { messageId: "p" }), msg("Q__reply", M, ME, 2, { inReplyTo: "Q" })] };
check("after his answer to my reply, I may write back once", nextStep(t2, ME)?.mode === "final");
// An old exchange that gets a new message moves to the bottom, next to the newest (3.11).
const late = buildConversations([...received, msg("Y__reply", M, ME, 900, { inReplyTo: "Y", read: false })], sent, ME, new Set(["blocked"]));
check("an old thread with a new reply sorts last", late[0].threads.map((t) => t.id).join() === "X,Z,Y", late[0].threads.map((t) => t.id).join());
let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} conversation tests passed.`);
process.exit(failed ? 1 : 0);
