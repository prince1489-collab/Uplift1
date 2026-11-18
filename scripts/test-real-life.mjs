// test-real-life.mjs — "Today, in real life" (3.25): the acts, their words, and "when?".
//
// Shape only, like check-hyt.cjs: it can tell that every act has words and a full stop, never
// that the words are any good. That half is reading the bank — fifty lines, one sitting.
//
//   node scripts/test-real-life.mjs

import { REAL_LIFE, MOMENTS, momentsLeft, momentById, planFor, actAsPhrase, hourLabel, todaysRealLife, clearsPlanOnDone, withDoneText } from "../src/realLife.js";
import { pickDaily } from "../src/hytPrompts.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);
const words = (s) => String(s).trim().split(/\s+/).length;

// ── The bank ─────────────────────────────────────────────────────────────────────────────────
check("at least forty acts to choose from", REAL_LIFE.length >= 40, String(REAL_LIFE.length));
const bad = [];
const seenActs = new Set();
for (const [i, r] of REAL_LIFE.entries()) {
  const at = `#${i + 1} "${String(r?.act).slice(0, 40)}"`;
  if (!r || typeof r.act !== "string" || typeof r.say !== "string") { bad.push(`${at}: needs act and say`); continue; }
  if (/^Have you tried/i.test(r.act)) bad.push(`${at}: still a "Have you tried" question`);
  if (!/^[A-Z]/.test(r.act)) bad.push(`${at}: act starts with a capital (it is an instruction)`);
  if (!/\.$/.test(r.act)) bad.push(`${at}: act ends with a full stop`);
  if (words(r.act) < 4 || words(r.act) > 18) bad.push(`${at}: act is ${words(r.act)} words (4-18)`);
  if (words(r.say) > 12) bad.push(`${at}: the words to say are ${words(r.say)} words — too many to remember in the moment`);
  if (!/[.?!…]$/.test(r.say)) bad.push(`${at}: the words end with punctuation`);
  if (/^["“”']|["“”]$/.test(r.say)) bad.push(`${at}: the words carry no quotation marks — the card and the push add them`);
  for (const t of [r.act, r.say]) {
    if (/’/.test(t)) bad.push(`${at}: curly apostrophe — the banks use straight ones`);
    if (/\.\.\./.test(t)) bad.push(`${at}: three dots — use the single … character`);
    if (/ {2}/.test(t)) bad.push(`${at}: double space`);
  }
  const key = r.act.toLowerCase();
  if (seenActs.has(key)) bad.push(`${at}: duplicate act`);
  seenActs.add(key);
  // The push is title + "act Try: “say”" — keep it whole on a lock screen.
  if (`${r.act} Try: “${r.say}”`.length > 178) bad.push(`${at}: too long for a notification`);
}
check("every act is an instruction with the words to say, and fits a notification", bad.length === 0, bad.join("\n      "));

// ── When ─────────────────────────────────────────────────────────────────────────────────────
const at = (h, m = 0) => new Date(2026, 10, 16, h, m);
check("four moments, in the order of a day", MOMENTS.map((m) => m.id).join() === "morning,lunch,home,evening");
check("8:30 — all four are still ahead", momentsLeft(at(8, 30)).length === 4);
check("11:59 — lunch is still ahead", momentsLeft(at(11, 59)).some((m) => m.id === "lunch"));
check("12:05 — lunch has started, so it can't be reminded about", !momentsLeft(at(12, 5)).some((m) => m.id === "lunch"));
check("18:00 — only this evening", momentsLeft(at(18)).map((m) => m.id).join() === "evening");
check("19:30 — nothing left (the card says any time before bed counts)", momentsLeft(at(19, 30)).length === 0);
check("momentById finds and refuses", momentById("home")?.hour === 17 && momentById("nope") === null);
check("hours read like a person", hourLabel(9) === "9am" && hourLabel(12) === "noon" && hourLabel(17) === "5pm");

// ── The plan the reminder is sent from ───────────────────────────────────────────────────────
const item = { text: REAL_LIFE[0].act, say: REAL_LIFE[0].say };
const plan = planFor(item, momentById("home"), "2026-11-16");
check("a plan carries the act, the words, the moment, its hour and the local date",
  plan.text === item.text && plan.say === item.say && plan.moment === "home" && plan.hour === 17 && plan.date === "2026-11-16");
check("no moment or no date, no plan", planFor(item, null, "2026-11-16") === null && planFor(item, momentById("home"), "") === null);
check("an act without words plans with none", planFor({ text: "Do a thing." }, momentById("lunch"), "2026-11-16").say === null);

// ── What the bar shows and says ──────────────────────────────────────────────────────────────
const [kind] = pickDaily({ uid: "u1", date: at(9) });
check("the daily pick is an act with its words", REAL_LIFE.some((r) => r.act === kind.text && r.say === kind.say), JSON.stringify(kind));
check("…and the same all day on every device", pickDaily({ uid: "u1", date: at(21) })[0].text === kind.text);
const swapped = pickDaily({ uid: "u1", date: at(9), swaps: { kindness: 1 } })[0];
check("the swap gives a different act", swapped.text !== kind.text && Boolean(swapped.say));
const days = new Set(Array.from({ length: 30 }, (_, d) => pickDaily({ uid: "u1", date: new Date(2026, 10, 1 + d) })[0].text));
check("a month of days is mostly different acts", days.size >= 18, String(days.size));
check("an area's prompts are still plain lines", pickDaily({ uid: "u1", date: at(9), chosenArea: "home" })[0].say === null);
check("the act reads inside a sentence", actAsPhrase("Thank someone who's just doing their job — a driver.") === "thank someone who's just doing their job — a driver");

// ── Report ───────────────────────────────────────────────────────────────────────────────────
// ── 3.30.1: one act, everywhere ─────────────────────────────────────────────────────────────
{
  const pick = { slot: "kindness", text: "Learn the name of someone you see all the time — and use it.", say: null };
  const swapped = { text: "Apologise without adding a \"but\" on the end.", say: "I'm sorry. That wasn't fair of me." };
  const plan = { ...planFor(swapped, momentById("evening"), "2026-11-17"), at: 1 };
  let t = todaysRealLife({ item: pick, plan, day: "2026-11-17" });
  check("today's plan on the account is the card's act, even on a phone that lost the swap", t.text === swapped.text && t.say === swapped.say && t.moment === "evening" && t.fromPlan === true, JSON.stringify(t));
  t = todaysRealLife({ item: pick, plan, day: "2026-11-18" });
  check("yesterday's plan doesn't replace today's act", t.text === pick.text && t.moment === null && t.fromPlan === false);
  t = todaysRealLife({ item: pick, plan: null, day: "2026-11-17" });
  check("no plan: the phone's own pick", t.text === pick.text && !t.fromPlan);
  check("a plan with no act, or an unknown moment, is ignored",
    todaysRealLife({ item: pick, plan: { ...plan, text: " " }, day: "2026-11-17" }).text === pick.text
    && todaysRealLife({ item: pick, plan: { ...plan, moment: "x" }, day: "2026-11-17" }).text === pick.text);
  check("changing the moment keeps the plan's act", planFor(todaysRealLife({ item: pick, plan, day: "2026-11-17" }), momentById("home"), "2026-11-17").text === swapped.text);

  check("\"Done it\" on the real-life card always clears the plan", clearsPlanOnDone("kindness", {}) === true && clearsPlanOnDone("kindness", { planned: {} }) === true);
  check("…\"who's next\" clears only a plan it made", clearsPlanOnDone("who", {}) === false && clearsPlanOnDone("who", { planned: { who: true } }) === true);
  const s1 = withDoneText({ done: {}, swaps: {} }, "kindness", swapped.text);
  check("what was done is kept for the \"✓ Done today\" row", s1.doneText?.kindness === swapped.text && s1.swaps);
  check("…and nothing is stored without text", withDoneText({ a: 1 }, "kindness", "  ").doneText === undefined);
}

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} real-life tests passed.`);
process.exit(failed ? 1 : 0);
