// test-grow.mjs — the Grow tab speaks in moments and time, not counts (3.29).
//
//   node scripts/test-grow.mjs

import { weekMoments, timeToNext, latestReflection } from "../src/growMoments.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);
const DAY = 86400000;
const NOW = Date.parse("2026-11-19T18:00:00Z");

const acts = [
  { route: "sent", at: NOW - 2 * DAY, delivered: true, country: "Algeria", feeling: "Nervous" },
  { route: "act", at: NOW - DAY, text: "Thank someone who's just doing their job." },
  { route: "heart", at: NOW - 3600000 },
  { route: "reply", at: NOW - 9 * DAY, toName: "Mona" },
];
const replies = [{ fromName: "Mona Rathore", text: "This was exactly what I needed today, thank you so much", ts: NOW - 3 * DAY }];
const hearts = [{ reactorName: "Kalpana Rathore", reactedAt: NOW - DAY }, { reactorName: "Vidhi R", reactedAt: NOW - 2 * DAY }];

const m = weekMoments({ acts, replies, hearts, now: NOW });
check("three moments at most", m.length === 3, JSON.stringify(m));
check("what came back to you comes first, newest first", /Kalpana and Vidhi felt your words/.test(m[0].text) && /^Mona wrote back: “This was exactly/.test(m[1].text), JSON.stringify(m.map((x) => x.text)));
check("then what you did — with how it felt, if you said", /In real life: thank someone who's just doing their job/.test(m[2].text), m[2].text);
const mineOnly = weekMoments({ acts, now: NOW, max: 5 });
check("a delivered message says where, and how it felt", mineOnly.some((x) => x.text === "Your words reached someone in Algeria — it felt nervous"), JSON.stringify(mineOnly));
check("hearts you gave aren't 'moments'", !mineOnly.some((x) => /hearted/.test(x.text)));
check("older than a week isn't this week", !mineOnly.some((x) => /Mona/.test(x.text)));
check("one heart from someone unnamed", weekMoments({ hearts: [{ reactedAt: NOW - DAY }], now: NOW })[0]?.text === "Someone felt your words ❤️");
check("many hearts become one line", weekMoments({ hearts: [1, 2, 3].map((i) => ({ reactorName: `P${i}`, reactedAt: NOW - i * 3600000 })), now: NOW })[0]?.text === "3 people felt your words ❤️");
check("a quiet week is an empty list, not an error", weekMoments({ now: NOW }).length === 0);

// The founder's tree: 4,500 drops over 58 days, 24 of the last 30 active, 1,500 to Young tree —
// about 78 drops an active day, active 4 days in 5: about 25 days, so "about 4 weeks".
check("drops become time at your own pace", timeToNext({ remaining: 1500, balance: 4500, activeDays: 58, recentDays: 24 }) === "about 4 weeks", timeToNext({ remaining: 1500, balance: 4500, activeDays: 58, recentDays: 24 }));
check("close becomes days", timeToNext({ remaining: 200, balance: 4500, activeDays: 58, recentDays: 24 }) === "about 4 days");
check("no pace, no promise", timeToNext({ remaining: 100, balance: 0, activeDays: 0, recentDays: 0 }) === null && timeToNext({ remaining: 100, balance: 500, activeDays: 5, recentDays: 0 }) === null);
check("already there, nothing to say", timeToNext({ remaining: 0, balance: 500, activeDays: 5, recentDays: 5 }) === null);

const chat = [
  { role: "seen", kind: "reflection", text: "You keep reaching out to family on Sundays.", feedback: null },
  { role: "me", kind: "answer", text: "yes" },
  { role: "seen", kind: "reflection", text: "Something they turned away", feedback: "forget" },
];
check("the newest reflection they haven't turned away", latestReflection(chat)?.text === "You keep reaching out to family on Sundays.");
check("none yet, nothing shown", latestReflection([]) === null && latestReflection(undefined) === null);

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} grow tests passed.`);
process.exit(failed ? 1 : 0);
