// test-evening.mjs — guards the evening reminder's two decisions.
//
// WHY THIS ONE GETS A TEST. Every other notification in Seen is a statement about something that
// already happened — somebody replied, somebody hearted you. This one is about something the
// person has NOT done, which makes it the only place in the product where a bug becomes a nag.
//
// Two ways it can misfire, and they are the two things asserted here:
//
//   1. It sends when nothing is pending. Then it is a daily 8pm "write in your journal", which is
//      exactly the notification this design exists to avoid, and the app gets muted.
//   2. It sends about yesterday. The cue carries a DATE, and the whole of its expiry is that the
//      date stops matching at the recipient's own midnight. If the comparison is done in the
//      server's calendar instead of theirs, everybody east or west of UTC gets reminded of the
//      wrong day's promise for part of the year.
//
// Pure functions, no emulator, no network:  node scripts/test-evening.mjs

import { eveningMessage } from "../api/send-reminder.js";
import { cueDateKey } from "../src/eveningCue.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name}  — ${detail}`]);

// ── 1. Nothing pending means nothing sent ────────────────────────────────────────────────────
// The single most important property. Every falsy shape a missing cue can take.
for (const [label, cue] of [
  ["no cue at all", null],
  ["undefined", undefined],
  ["a cue with no kind", { date: "2026-09-16", text: "something" }],
  ["a cue with no text", { date: "2026-09-16", kind: "pinned" }],
  ["an empty text", { date: "2026-09-16", kind: "draft", text: "" }],
  ["an unknown kind", { date: "2026-09-16", kind: "streak", text: "x" }],
]) {
  check(`silent on ${label}`, eveningMessage(cue) === null, `got ${JSON.stringify(eveningMessage(cue))}`);
}

// ── 2. Each kind says something true, and lands somewhere ────────────────────────────────────
const pinned = eveningMessage({ kind: "pinned", text: "Who could use a kind word from you today?" });
check("a held prompt is quoted back", pinned?.body?.includes("Who could use a kind word from you today?"),
  JSON.stringify(pinned));
check("a held prompt opens Reflect", pinned?.open === "reflect", pinned?.open);

const draft = eveningMessage({ kind: "draft", text: "I was thinking about how my grandmother" });
check("a draft does NOT quote what was written", !draft?.body?.includes("grandmother"), draft?.body);
check("a draft opens Reflect", draft?.open === "reflect", draft?.open);

const planned = eveningMessage({ kind: "planned", text: "Have you tried… letting one person go ahead of you today?" });
check("a planned act names the act", planned?.body?.includes("letting one person go ahead of you"), planned?.body);
check("a planned act opens Practice", planned?.open === "practice", planned?.open);

// A lock screen truncates, so nothing here may run away. Every body is a headline, not a page.
for (const [name, msg] of [["pinned", pinned], ["draft", draft], ["planned", planned]]) {
  check(`${name} fits a lock screen`, msg.body.length <= 140, `${msg.body.length} chars`);
  check(`${name} has a title`, Boolean(msg.title), JSON.stringify(msg));
  // The roadmap rules guilt out as a mechanic, and a notification is the easiest place in a
  // product to break that by accident. No counting down, no naming what is about to be lost.
  check(`${name} carries no guilt`, !/streak|don't lose|running out|last chance|still haven't|miss/i.test(`${msg.title} ${msg.body}`),
    msg.body);
}

// ── 3. A draft must not leak into the notification ───────────────────────────────────────────
// A journal entry is the most private thing in this app and a lock screen is the least private
// place a phone has. The draft message is deliberately generic; this is the assertion that keeps
// it that way if someone later "improves" it by adding a preview.
const secret = "today I found out something I have not told anyone";
check("nothing a person wrote reaches the lock screen",
  !eveningMessage({ kind: "draft", text: secret }).body.includes("told anyone"),
  eveningMessage({ kind: "draft", text: secret }).body);

// ── 4. The date key is the recipient's calendar ──────────────────────────────────────────────
// cueDateKey is what the phone writes; the sender compares it against Intl's en-CA formatting of
// the same instant in the user's timezone. Both must produce YYYY-MM-DD or the comparison is
// always false and the feature silently never fires.
const key = cueDateKey(new Date(2026, 8, 16));
check("the client writes YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(key), key);
check("the client pads single digits", cueDateKey(new Date(2026, 0, 5)) === "2026-01-05", cueDateKey(new Date(2026, 0, 5)));

// The server side of the same comparison, spelled out rather than imported — localDateKey is not
// exported, and duplicating three lines is better than widening an endpoint's surface for a test.
const serverKey = (tz, at) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
check("the server formats the same way", /^\d{4}-\d{2}-\d{2}$/.test(serverKey("Europe/London", new Date())), serverKey("Europe/London", new Date()));

// 20:00 in Auckland on the 16th is still the 16th there and already the 16th in UTC — but at
// 20:00 in Los Angeles it is the 17th in UTC. A server-calendar comparison would refuse the
// second one, which is the bug this checks for.
const laEvening = new Date("2026-09-17T03:00:00Z"); // 20:00 on the 16th in Los Angeles
check("a Los Angeles evening is still the 16th to that user",
  serverKey("America/Los_Angeles", laEvening) === "2026-09-16", serverKey("America/Los_Angeles", laEvening));
check("…while the server's own date has already rolled over",
  laEvening.toISOString().slice(0, 10) === "2026-09-17", laEvening.toISOString().slice(0, 10));

// ── Report ───────────────────────────────────────────────────────────────────────────────────
let failed = 0;
for (const [ok, name] of results) {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}`);
  if (!ok) failed++;
}
console.log(`\n  ${results.length - failed}/${results.length} evening reminder tests passed.`);
process.exit(failed ? 1 : 0);
