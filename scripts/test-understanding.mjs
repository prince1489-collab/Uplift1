// test-understanding.mjs — every rule the "Seen" conversation promises (3.15).
// Pure functions from api/_seen.js; no network, no Firebase.
import { safetyLevel, supportMessage, guardReflection, guardReply, buildDigest, validateReflections, mergeThemes,
  reflectionDue, replyAllowed, nudgeFor, parseJson, replyPrompt, reflectPrompt, modelChat, REPLIES_PER_DAY } from "../api/_seen.js";
const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);
const DAY = 86400000, NOW = Date.parse("2026-10-06T12:00:00Z");

// ── Safety ──
check("crisis wording is caught", safetyLevel("some days I want to die") === "crisis" && safetyLevel("thinking of ending it all") === "crisis");
check("concern wording is caught", safetyLevel("I just can't cope with work") === "concern");
check("ordinary life is ok", safetyLevel("Training for my first 10k, work's full on") === "ok");
check("'dying to see them' is not a crisis", safetyLevel("I'm dying to see my sister") === "ok");
check("crisis message points to real help", /emergency|crisis line/.test(supportMessage("crisis")) && /AI/.test(supportMessage("crisis")));

// ── Wording ──
check("an observation passes", Boolean(guardReflection("You've mentioned training for a 10k, and you've made someone feel seen on 18 of the last 30 days.")));
check("'You are a…' is dropped", guardReflection("You are a natural carer.") === null);
check("'You seem to be someone who…' is dropped", guardReflection("You seem to be someone who shows up.") === null);
check("instructions are dropped", guardReflection("You should rest more this week.") === null);
check("diagnosis is dropped", guardReflection("This sounds like burnout from work.") === null && guardReflection("Signs of anxiety disorder here.") === null);
check("special categories are dropped", guardReflection("Your faith seems central to your week.") === null);
check("a race is not an ethnicity", Boolean(guardReflection("You've mentioned the race next month, and you've felt proud four times.")));
check("too long is dropped", guardReflection("x".repeat(300)) === null);
check("a reply may echo their own words", Boolean(guardReply("Diwali prep and a new job — that's a full week. Thank you for telling me.")));
check("but a reply never instructs", guardReply("You should take a break.") === null);

// ── Evidence ──
const answers = [
  { question: "What's been keeping you busy lately?", text: "Training for my first 10k and work is full on", createdAt: NOW - 3 * DAY },
  { question: "Who's been on your side lately?", text: "My sister Kalpana, she checks in every morning", createdAt: NOW - 1 * DAY },
  { question: "old", text: "ancient", createdAt: NOW - 40 * DAY },
];
const feelings = [
  { feelings: ["proud"], route: "act", sentence: "I feel proud because I nearly didn't do it.", createdAt: NOW - 2 * DAY },
  { feelings: ["warm"], route: "note", toName: "Kalpana", sentence: "I feel warm because they deserve to hear it.", createdAt: NOW - DAY },
  { feelings: ["warm", "nervous"], route: "note", toName: "Kalpana", sentence: "I feel warm and nervous.", createdAt: NOW - DAY / 2 },
];
const user = { activeDates: Array.from({ length: 18 }, (_, i) => new Date(NOW - i * DAY).toISOString().slice(0, 10)), whosNext: { name: "Sam", day: "2026-10-05" } };
const items = buildDigest({ answers, feelings, user, now: NOW });
check("answers older than 30 days are left out", !items.some((i) => /ancient/.test(i.text)));
check("answers and feelings are 'said', patterns are 'did'", items.filter((i) => i.kind === "said").length === 5 && items.some((i) => i.kind === "did"));
check("the rhythm is counted", items.some((i) => /18 of the last 30 days/.test(i.label)), items.map((i) => i.label).join(" | "));
check("the people they're kind to are named", items.some((i) => /Kalpana/.test(i.label) && i.kind === "did"));
check("labels are in plain words for the person", items.every((i) => /^You/.test(i.label)));

const good = { theme: "running", text: "You've mentioned training for your first 10k, and you've felt proud after showing up anyway.", evidence: ["A1", "F1"] };
const v = validateReflections([
  good,
  { theme: "x", text: "You've been kind a lot.", evidence: ["S1", "S2"] },              // only 'did'
  { theme: "x", text: "You've mentioned work.", evidence: ["A1"] },                      // one id
  { theme: "x", text: "You've mentioned work.", evidence: ["A1", "Z9"] },                // made-up id
  { theme: "family", text: "You are a devoted sister.", evidence: ["A2", "S3"] },         // a label
], items);
check("a well-evidenced observation survives", v.length === 1 && v[0].theme === "running");
check("behaviour alone is not enough", !v.some((r) => /kind a lot/.test(r.text)));
check("evidence comes back as labels the person can read", v[0].evidence.length === 2 && v[0].evidence.every((e) => /^You/.test(e.label)));
check("at most two reflections", validateReflections([good, good, good], items).length === 2);

// ── Living themes ──
let t = mergeThemes([], ["running", "family"], [], NOW);
check("new themes appear", t.map((x) => x.name).sort().join() === "family,running");
t = mergeThemes(t, ["running"], [], NOW + DAY);
check("a theme seen again gets stronger", t.find((x) => x.name === "running").strength === 2);
check("'Forget this' removes a theme", !mergeThemes(t, [], [{ theme: "family", feedback: "forget" }], NOW + DAY).some((x) => x.name === "family"));
check("'Not quite' weakens a weak theme away", !mergeThemes(t, [], [{ theme: "family", feedback: "no" }], NOW + DAY).some((x) => x.name === "family"));
check("themes fade after 30 days unseen", mergeThemes(t, [], [], NOW + 32 * DAY).length === 0);

// ── Timing ──
check("no reflection from a single answer", reflectionDue({ answers: answers.slice(0, 1), lastReflect: 0, now: NOW }) === false);
check("two answers → first reflection", reflectionDue({ answers: answers.slice(0, 2), lastReflect: 0, now: NOW }) === true);
check("not twice in five days", reflectionDue({ answers: answers.slice(0, 2), lastReflect: NOW - 2 * DAY, now: NOW }) === false);
check("replies are capped per day", replyAllowed({ replies: { day: "2026-10-06", n: REPLIES_PER_DAY } }, "2026-10-06") === false && replyAllowed({ replies: { day: "2026-10-05", n: 9 } }, "2026-10-06") === true);
check("who's-next nudge the day after", /Yesterday you said you'd like to make Sam feel seen/.test(nudgeFor(user, "2026-10-06")?.text || ""));
check("…not the same day", nudgeFor(user, "2026-10-05") === null);

// ── Prompts and parsing ──
check("JSON is found inside chatter", parseJson('Sure! {"safety":"ok","reflections":[]} hope that helps')?.safety === "ok");
check("broken JSON is null, not a crash", parseJson("{nope") === null);
const rp = reflectPrompt({ items });
check("the reflection prompt forbids labels and demands evidence", /NEVER "You are/.test(rp.system) && /at least two evidence ids/.test(rp.system));
const rep = replyPrompt({ chat: [{ role: "me", text: "why do you think that?" }], themes: [{ name: "running" }], evidence: items });
check("the reply prompt answers from evidence only", /only from the evidence/.test(rep.system) && /A1/.test(rep.user));

// 3.29 — answers to the bar's old questions, and the acts themselves, are evidence now
{
  const fs = [{ route: "act", question: "Did you nearly not do it?", answer: "Very nearly", createdAt: NOW - DAY }];
  const acts = [
    { route: "reply", toName: "Mona", text: "Needed this today", at: NOW - 2 * DAY },
    { route: "heart", at: NOW - DAY }, { route: "heart", at: NOW - DAY },
  ];
  const d = buildDigest({ answers: [], feelings: fs, user: {}, now: NOW, acts });
  const R = d.find((i) => i.id === "R1"), K = d.find((i) => i.id === "K1");
  check("a stored answer to the bar's question reaches Seen as something they said", R?.kind === "said" && /Very nearly/.test(R.text) && /Very nearly/.test(R.label));
  check("an act from the kindness log is something they did, in plain words", K?.kind === "did" && /told Mona how their words landed/.test(K.text) && /Needed this today/.test(K.text) && /^You told Mona/.test(K.label));
  check("hearts are counted, not listed one by one", !d.some((i) => /^K/.test(i.id) && /heart/i.test(i.text)) && d.some((i) => /^S/.test(i.id) && /hearted 2 messages/.test(i.text)));
  check("the people they were kind to include those from the log", d.some((i) => /^S/.test(i.id) && /Mona ×1/.test(i.text)));
}

// 3.29.1 — an adverb doesn't hide a label, and drinking stays off the record
check("\"you're also the kind of person who…\" is a label, and is dropped", guardReflection("You've mentioned work, and you're also the kind of person who tackles problems.") === null);
check("\"you are really someone who…\" too", guardReflection("You are really someone who keeps going.") === null);
check("a reflection about drinking is dropped", guardReflection("You've noticed real shifts — drinking differently, mornings clearer.") === null);
check("an observation is still fine", typeof guardReflection("You've mentioned your brother twice this week, and you wrote to him on Sunday.") === "string");
const longA = { createdAt: NOW - DAY, text: "I have made progress in terms of my running and stopping when I do need a rest, which feels good, honestly", question: "What's changed?" };
const dLong = buildDigest({ answers: [longA], feelings: [], user: {}, now: NOW });
check("a reason is kept whole, not cut at 70 characters", /which feels good, honestly”$/.test(dLong.find((i) => i.id === "A1")?.label || ""), dLong.find((i) => i.id === "A1")?.label);

// 3.30 — the app's own updates never reach the model; journal entries can make a reflection due
const withUpdate = [{ role: "me", kind: "answer", text: "Training", createdAt: 1 }, { role: "seen", kind: "update", text: "Your week 🌱\n💬 Mona wrote back: “needed this”", createdAt: 2 }];
check("the app's updates are not part of what the model sees", modelChat(withUpdate).length === 1 && modelChat(withUpdate)[0].kind === "answer");
check("…messages without a kind are kept", modelChat([{ role: "me", text: "hi" }]).length === 1);
check("…and nothing breaks on an empty or missing chat", modelChat(null).length === 0);
const p2 = replyPrompt({ chat: modelChat(withUpdate) });
check("…so another person's words in an update never go to the model", !/Mona/.test(p2.user));
const jn = [{ text: "Rang my brother", createdAt: NOW - DAY }, { text: "A long walk", createdAt: NOW - 2 * DAY }];
check("two new journal entries make a reflection due", reflectionDue({ answers: [], lastReflect: NOW - 8 * DAY, now: NOW, journal: jn }) === true);
check("…not when they're older than the last reflection", reflectionDue({ answers: [], lastReflect: NOW - 8 * DAY, now: NOW, journal: jn.map((j) => ({ ...j, createdAt: NOW - 9 * DAY })) }) === false);
check("…and not on one entry alone", reflectionDue({ answers: [], lastReflect: 0, now: NOW, journal: jn.slice(0, 1) }) === false);
const dJ = buildDigest({ answers: [], feelings: [], user: {}, now: NOW, journal: [{ text: "Rang my brother for the first time in months.", createdAt: NOW - DAY }] });
check("a journal reason quotes what they wrote", /^You wrote in your journal on .+: “Rang my brother for the first time in months\.”$/.test(dJ.find((i) => i.id === "J1")?.label || ""), dJ.find((i) => i.id === "J1")?.label);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} understanding tests passed.`);
process.exit(failed ? 1 : 0);
